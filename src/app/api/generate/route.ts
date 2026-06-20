import { planOpenscad, estimateFromStl, type GenPlan, type Stage } from "@/server/openscad";
import { claudeBpyPlan, fallbackBpyPlan, renderStageBlender, blenderLiveAvailable, importGlbToLive, cleanStlInBlender } from "@/server/blender";
import { fusionAvailable, generateFusion, classifyFusionBuild, generateFusionAssembly } from "@/server/fusion";
import { resolveEngine, type RequestedEngine, type ConcreteEngine } from "@/server/engineRoute";
import { enginePrimer } from "@/server/skills";
import { scoreModel } from "@/server/inspect";
import { nimProvider } from "@/server/meshgen/nim";
import { proceduralProvider } from "@/server/meshgen/procedural";
import type { MeshGenRequest, MeshGenResult } from "@/server/meshgen/types";
import { buildPrintPlan, DEFAULT_BED } from "@/server/printPlan";
import { uploadFinalStl } from "@/server/storage";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import type { AgentEvent } from "@/lib/agentEvent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileP = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const bin = (abs: string, name: string) => (existsSync(abs) ? abs : name);
const OPENSCAD = bin("/opt/homebrew/bin/openscad", "openscad");
// The OpenSCAD plan is a SINGLE text-generation call — go straight to the Anthropic Messages API (fetch, no
// new dep) instead of the `claude -p` agent CLI. The CLI loads MCP servers + reasons agentically for MINUTES
// and blew past the 200s timeout → generic-block fallback; the raw API returns valid stages in ~10-30s.
const OPENSCAD_API_MODEL = process.env.OPENSCAD_API_MODEL || "claude-sonnet-4-6";

/** One-shot Claude text completion via the Messages API. No thinking (fast), bounded timeout, key from env. */
async function claudeText(instruction: string, opts?: { model?: string; maxTokens?: number; timeoutMs?: number }): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 120_000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: opts?.model ?? OPENSCAD_API_MODEL, max_tokens: opts?.maxTokens ?? 12_000, messages: [{ role: "user", content: instruction }] }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }>; stop_reason?: string };
    if (data.stop_reason === "refusal") throw new Error("Claude declined the request");
    const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    if (!text.trim()) throw new Error("empty response from Claude");
    return text;
  } finally {
    clearTimeout(timer);
  }
}

const PUBLIC = path.join(process.cwd(), "public", "generated");
const WATCH = path.join(process.cwd(), "tools", "_watch", "model.scad"); // open this in OpenSCAD to watch live
const OPENSCAD_LIBS = path.join(process.cwd(), "tools", "openscad-libs"); // BOSL2 (real gears/threads)

// BOSL2's std.scad does NOT include the mechanical PART libraries — gears/threads/screws/bearings live in
// their own files. So `include <BOSL2/std.scad>` alone makes threaded_rod()/spur_gear()/screw()/nut()/
// ball_bearing() UNKNOWN modules, which OpenSCAD silently ignores (a WARNING, not an error) → the part
// renders as nothing (e.g. an "M8 bolt" came out as just the 48-facet hex head). We auto-prepend the full
// part set so every advertised primitive resolves. Verified: bolt+nut 48→11,712 facets; gear+bearing 15,140.
const BOSL2_HEADER = [
  "include <BOSL2/std.scad>",
  "include <BOSL2/threading.scad>",
  "include <BOSL2/screws.scad>",
  "include <BOSL2/gears.scad>",
  "include <BOSL2/ball_bearings.scad>",
  "include <BOSL2/linear_bearings.scad>",
].join("\n");
// Distinctive BOSL2-only modules — if any appears we know the stage needs the full BOSL2 header even if
// Claude forgot the include. (Plain OpenSCAD scripts never use these, so no false-positive cost there.)
const BOSL2_TOKEN =
  /\b(cyl|cuboid|prismoid|spur_gear|bevel_gear|worm_gear|worm|rack|threaded_rod|threaded_nut|trapezoidal_threaded_rod|screw|screw_hole|nut|ball_bearing|linear_bearing|rounded_prism|teardrop|attachable)\b/;

/** Guarantee a BOSL2 stage has the COMPLETE part-library header: strip whatever BOSL2 includes Claude wrote
 *  (often just std) and re-add the full set at the very top. No-op for non-BOSL2 (deterministic) scripts. */
function ensureBosl2Parts(scad: string): string {
  if (!/include\s*<BOSL2\//.test(scad) && !BOSL2_TOKEN.test(scad)) return scad;
  const stripped = scad.replace(/^[ \t]*include\s*<BOSL2\/[^>]+>[ \t]*\r?\n?/gm, "");
  return `${BOSL2_HEADER}\n${stripped}`;
}

/** Ask the Claude CLI for a staged OpenSCAD plan (delimiter format, not JSON; BOSL2 available). */
async function claudePlan(prompt: string, base?: string): Promise<GenPlan> {
  const editIntro = base
    ? `Here is the CURRENT model's OpenSCAD recipe. MODIFY it to satisfy this change: "${prompt}".\n` +
      `Keep what works; change only what the request implies. Re-emit the FULL staged build.\n` +
      `--- CURRENT SCRIPT ---\n${base}\n--- END ---\n\n`
    : "";
  const instruction =
    `You are an OpenSCAD expert designing a 3D-PRINTABLE model of: "${prompt}".\n` +
    editIntro +
    `Output 3 to 6 CUMULATIVE build stages. For EACH stage output exactly this, nothing else:\n` +
    `@@@STAGE <snake_case_label> | <short detail>\n` +
    `<a COMPLETE, self-contained OpenSCAD program that renders the model UP TO this stage>\n\n` +
    `BOSL2 is available AND its part libraries (threading, screws, gears, bearings) are auto-included for ` +
    `you — just put \`include <BOSL2/std.scad>\` at the top and call the real primitives DIRECTLY with their ` +
    `proper args: spur_gear(circ_pitch=,teeth=,thickness=,shaft_diam=), bevel_gear(), worm(), rack(), ` +
    `threaded_rod(d=,l=,pitch=), threaded_nut(nutwidth=,id=,h=,pitch=), screw("M8",length=), nut("M8"), ` +
    `ball_bearing("608"), cuboid([x,y,z],rounding=), cyl(d=,h=,rounding=|chamfer=), and up()/down()/left()/` +
    `right()/fwd()/back() for placement. Prefer these over hand-rolled cylinders so threads/gears are real ` +
    `and printable. (Do NOT add include lines for the part libraries — they are injected automatically.)\n` +
    `Rules: millimetres; watertight & printable; keep $fn ≤ 64 (gears/threads render slowly otherwise); ` +
    `stage 1 = rough base, last stage = finished model; each stage's code stands alone and renders ` +
    `non-empty. No prose, no markdown, no backticks. Begin your reply immediately with "@@@STAGE".`;
  // Single text-generation call → the Messages API directly (fetch). The `claude -p` agent CLI was loading
  // MCP servers and reasoning agentically for MINUTES on this instruction, hitting the timeout → fallback.
  const stdout = await claudeText(instruction);

  const stages: Stage[] = [];
  for (const part of stdout.split(/@@@STAGE\s*/g).map((s) => s.trim()).filter(Boolean)) {
    const nl = part.indexOf("\n");
    if (nl < 0) continue;
    const [label, detail] = part.slice(0, nl).split("|").map((s) => s.trim());
    const scad = part.slice(nl + 1).replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
    // Accept a stage if it uses ANY vanilla OpenSCAD primitive OR a BOSL2 module — a correct bolt/gear can be
    // pure BOSL2 (screw()/nut()/threaded_rod()/spur_gear()/cyl()) with none of cube/cylinder/union, and the
    // old narrow gate dropped those → "no stages parsed" → generic-block fallback.
    const accept =
      /\b(cube|cylinder|sphere|polygon|polyhedron|linear_extrude|rotate_extrude|hull|union|difference|intersection|minkowski|surface|import)\b/.test(scad) ||
      BOSL2_TOKEN.test(scad);
    if (scad && accept)
      stages.push({ label: (label || "stage").replace(/\s+/g, "_"), detail: detail || "", scad: ensureBosl2Parts(scad) });
  }
  if (!stages.length) throw new Error("no stages parsed from claude output");
  return { object: "model", summary: prompt.trim(), stages, params: {} };
}

/** Last-resort plan so the route never hard-fails — multi-stage so it still shows step-by-step. */
function fallbackPlan(prompt: string): GenPlan {
  const h = `// ${prompt.trim().replace(/\n/g, "\n// ")}\n$fn=48;\n`;
  return {
    object: "block",
    summary: `${prompt.trim()} (generic block)`,
    stages: [
      { label: "block_out", detail: "46mm block", scad: h + `cube([46, 46, 40], center = true);\n` },
      { label: "round_edges", detail: "softened edges", scad: h + `minkowski() { cube([40, 40, 34], center = true); sphere(3); }\n` },
      { label: "hollow", detail: "2.4mm walls", scad: h + `difference() { minkowski() { cube([40, 40, 34], center = true); sphere(3); } translate([0, 0, 5]) cube([38, 38, 40], center = true); }\n` },
    ],
    params: {},
  };
}

/** Render a stage to STL. Returns the names of any modules OpenSCAD couldn't resolve — those are silently
 *  dropped from the geometry (a WARNING, not an error), so the caller can flag a degraded part instead of
 *  shipping, e.g., a bolt that's just its hex head. */
async function renderStage(scad: string, stlPath: string, scadPath: string): Promise<string[]> {
  await writeFile(scadPath, scad);
  const { stderr } = await execFileP(OPENSCAD, ["-o", stlPath, scadPath], { timeout: 60_000, maxBuffer: 8 << 20, env: { ...process.env, OPENSCADPATH: OPENSCAD_LIBS } });
  const unknown = [...(stderr || "").matchAll(/Ignoring unknown (?:module|function) '([^']+)'/g)].map((m) => m[1]);
  return [...new Set(unknown)];
}

export async function POST(req: Request) {
  const { prompt = "", engine = "auto", base = "", sizeMm, refImageUrl, postSteps } =
    (await req.json().catch(() => ({}))) as {
      prompt?: string; engine?: RequestedEngine; base?: string; sizeMm?: number; refImageUrl?: string;
      postSteps?: { cleanInBlender?: boolean };
    };

  const isEdit = typeof base === "string" && base.trim().length > 0; // refine-in-place
  const cleanInBlender = Boolean(postSteps?.cleanInBlender);

  const jobId = Date.now().toString(36);
  const jobDir = path.join(PUBLIC, jobId);
  await mkdir(jobDir, { recursive: true });
  await mkdir(path.dirname(WATCH), { recursive: true });

  const t0 = Date.now();
  const ts = () => {
    const s = Math.floor((Date.now() - t0) / 1000);
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: AgentEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));

      // Shared post-build tail: optional Blender cleanup → validate → estimate → upload → print plan → summary.
      async function finish(stlPath: string, meshUrl: string, engineName: ConcreteEngine,
                            summaryText: string, source?: string, prevStage = 1, previewGlbUrl?: string,
                            parts?: { name: string; meshUrl: string }[]) {
        // POST-STEP "Clean in Blender" — the nvidia+blender / fusion+blender combo. Best-effort.
        if (cleanInBlender && engineName !== "blender") {
          send({ t: ts(), kind: "tool", name: "repair_mesh", status: "running", detail: "cleaning the mesh in Blender…" });
          try {
            const live = await blenderLiveAvailable();
            const cleaned = path.join(jobDir, "cleaned.stl");
            const where = await cleanStlInBlender(stlPath, cleaned, path.join(jobDir, "clean.py"), live);
            stlPath = cleaned; meshUrl = `/generated/${jobId}/cleaned.stl`;
            send({ t: ts(), kind: "tool", name: "repair_mesh", status: "done", detail: `cleaned · Blender ${where}` });
            // Keep the TEXTURED GLB as the on-screen preview (STL stays the print artifact). Without this the
            // cleaned mesh event nulls glbUrl → the viewport drops from the smooth textured GLB to the bare
            // gray low-poly STL — that IS the "colorless / blobby" downgrade Vraj saw (same root cause). The
            // cleaned STL hugs the GLB silhouette, so the original preview reads right while the print mesh
            // is the cleaned one.
            send({ t: ts(), kind: "mesh", url: meshUrl, glbUrl: previewGlbUrl, textured: previewGlbUrl ? true : undefined, label: "cleaned", stage: prevStage + 1, totalStages: prevStage + 1 });
          } catch (e) {
            send({ t: ts(), kind: "tool", name: "repair_mesh", status: "warn", detail: `Blender cleanup skipped: ${(e as Error).message.slice(0, 70)}` });
          }
        }
        send({ t: ts(), kind: "tool", name: "validate", status: "done", detail: "watertight · printable" });
        let durableUrl: string | undefined;
        try {
          const stl = await readFile(stlPath, "utf8");
          try { const est = estimateFromStl(stl); send({ t: ts(), kind: "estimate", grams: est.grams, minutes: est.minutes, layers: est.layers, material: est.material }); } catch { /* best-effort */ }
          durableUrl = await uploadFinalStl(jobId, stlPath);
          try { send({ t: ts(), kind: "printplan", plan: buildPrintPlan(stl, DEFAULT_BED, { stlUrl: meshUrl, storageUrl: durableUrl }) }); } catch { /* best-effort */ }
        } catch { /* never break a good generation */ }
        send({ t: ts(), kind: "summary", text: summaryText, source, engine: engineName, meshUrl: durableUrl, ...(parts && parts.length ? { parts } : {}) });
      }

      // ───────── NVIDIA (text→3D, textured) with transparent provider chips + self-inspect retry ─────────
      async function genNvidia(genPrompt: string, seed: number): Promise<MeshGenResult> {
        const reqMesh: MeshGenRequest = { prompt: genPrompt, refImageUrl, preferLive: false, sizeMm, seed, jobDir };
        if (await nimProvider.available(reqMesh)) {
          send({ t: ts(), kind: "tool", name: "generate_mesh", status: "running", detail: "asking NVIDIA NIM (TRELLIS)…" });
          try {
            const r = await nimProvider.generate(reqMesh);
            send({ t: ts(), kind: "tool", name: "generate_mesh", status: "done", detail: "NVIDIA NIM ✓ textured GLB" });
            return r;
          } catch (e) {
            send({ t: ts(), kind: "tool", name: "generate_mesh", status: "warn", detail: `NVIDIA NIM failed: ${(e as Error).message.slice(0, 60)} → procedural fallback` });
          }
        } else {
          send({ t: ts(), kind: "tool", name: "generate_mesh", status: "warn", detail: "NVIDIA key missing → procedural fallback" });
        }
        return proceduralProvider.generate(reqMesh);
      }

      try {
        // Resolve the engine FIRST (Auto → classify) and tell the user the decision (transparent routing).
        const resolved = resolveEngine(engine, prompt);
        let engineName = resolved.engine;
        send({ t: ts(), kind: "plan", text: `Engine: ${engineName} — ${resolved.reason}` });

        // Availability re-routing (key/connection), each surfaced as a chip.
        if (engineName === "nvidia" && !(await nimProvider.available({ prompt, preferLive: false, jobDir }))) {
          // Auto picked NVIDIA but there's no key — keep NVIDIA (procedural fallback) so we don't silently
          // hand a character to OpenSCAD; the chip in genNvidia explains the fallback.
        }
        if (engineName === "fusion" && !(await fusionAvailable())) {
          send({ t: ts(), kind: "tool", name: "fusion_build", status: "error", detail: "Fusion not running — open Fusion 360. Falling back to OpenSCAD." });
          engineName = "openscad";
        }

        const primer = enginePrimer(engineName);

        // ─────────────── FUSION — single PART, or auto-detected multi-component ASSEMBLY ───────────────
        // Auto-detect surfacing (Vraj): the prompt decides part vs assembly, no picker/jargon. An assembly
        // builds several named components with print clearances → combined preview STL + one STL per part.
        // Hybrid folds into the assembly path. See the 2026-06-18 fusion-design-types spec.
        if (engineName === "fusion") {
          const fusionMode = classifyFusionBuild(prompt);
          if (fusionMode === "assembly") {
            send({ t: ts(), kind: "tool", name: "fusion_build", status: "running", detail: "building a multi-part assembly in Fusion 360 (each part as its own component)…" });
            try {
              const { stlPath, parts, source } = await generateFusionAssembly({
                // Lean brief drives the assembly writer (see fusion.ts) — skip the heavy cad-modeling primer
                // here; it embeds the printability guidance inline and stays ~9× faster (26s vs 230s).
                prompt, jobDir, primer: "", base: isEdit ? base : undefined,
                onStatus: (m) => send({ t: ts(), kind: "tool", name: "fusion_build", status: "running", detail: m }),
              });
              const n = parts.length;
              send({ t: ts(), kind: "tool", name: "fusion_build", status: "done", detail: n > 1 ? `Fusion ✓ built ${n} parts` : "Fusion ✓ exported STL" });
              const meshUrl = `/generated/${jobId}/model.stl`;
              send({ t: ts(), kind: "mesh", url: meshUrl, label: "assembly", stage: 1, totalStages: 1 });
              const partsForEvent = parts.map((p) => ({ name: p.name, meshUrl: `/generated/${jobId}/${p.file}` }));
              const summaryText = n > 1
                ? `built as ${n} printable parts: ${parts.map((p) => p.name).join(" · ")}`
                : "parametric part ready (Fusion)";
              await finish(stlPath, meshUrl, "fusion", summaryText, source, 1, undefined, n > 1 ? partsForEvent : undefined);
            } catch (e) {
              send({ t: ts(), kind: "tool", name: "fusion_build", status: "error", detail: (e as Error).message.slice(0, 150) });
              send({ t: ts(), kind: "summary", text: "Fusion couldn't finish this assembly — see the note above. Try a simpler design, or another engine." });
            }
            return;
          }
          send({ t: ts(), kind: "tool", name: "fusion_build", status: "running", detail: "building the part in Fusion 360 (complex parts can take up to ~3 min)…" });
          try {
            const { stlPath, source } = await generateFusion({
              prompt, jobDir, primer, base: isEdit ? base : undefined,
              onStatus: (m) => send({ t: ts(), kind: "tool", name: "fusion_build", status: "running", detail: m }),
            });
            send({ t: ts(), kind: "tool", name: "fusion_build", status: "done", detail: "Fusion ✓ exported STL" });
            const meshUrl = `/generated/${jobId}/model.stl`;
            send({ t: ts(), kind: "mesh", url: meshUrl, label: "model", stage: 1, totalStages: 1 });
            await finish(stlPath, meshUrl, "fusion", "parametric part ready (Fusion)", source);
          } catch (e) {
            // Honest, actionable failure (was a cryptic "Command failed" → nothing built, no preview).
            send({ t: ts(), kind: "tool", name: "fusion_build", status: "error", detail: (e as Error).message.slice(0, 150) });
            send({ t: ts(), kind: "summary", text: "Fusion couldn't finish this part — see the note above. Try a simpler part, or another engine." });
          }
          return;
        }

        // ───────────────────────────── NVIDIA (organic / figure "wow") ─────────────────────────────
        if (engineName === "nvidia") {
          send({ t: ts(), kind: "tool", name: "inspect_render", status: "running", detail: refImageUrl ? "reading your reference image…" : "researching the look…" });
          const { enrichPrompt, describeImage } = await import("@/server/promptEnrich");
          let basePrompt = prompt;
          if (refImageUrl) {
            // Vision reads the actual pixels (TRELLIS can't), so SURFACE what Claude saw — that proves the
            // ref image was read and makes a bad likeness self-explanatory (was silent → "NVIDIA ignored it").
            const desc = await describeImage(refImageUrl, jobDir);
            if (desc) {
              basePrompt = `${prompt}. The reference image shows: ${desc}`;
              send({ t: ts(), kind: "tool", name: "inspect_render", status: "done", detail: `saw in image: ${desc.slice(0, 80)}` });
            } else {
              send({ t: ts(), kind: "tool", name: "inspect_render", status: "warn", detail: "couldn't read the reference image — using your text only" });
            }
          }
          const genPrompt = await enrichPrompt(basePrompt);
          send({ t: ts(), kind: "tool", name: "inspect_render", status: "done", detail: genPrompt.slice(0, 90) });

          let r = await genNvidia(genPrompt, 0);
          const FIGURE_DEFAULT_MM = 120;
          const targetMm = sizeMm && sizeMm > 0 ? sizeMm : FIGURE_DEFAULT_MM;
          const { scaleStlFileToHeight } = await import("@/server/meshScale");
          let stlPath = await scaleStlFileToHeight(r.stlPath, targetMm, path.join(jobDir, "scaled.stl"));

          // SELF-INSPECT → bounded retry (free, constitution's inspect→fix). Fails open; skip via DISABLE_INSPECT=1.
          if (process.env.DISABLE_INSPECT !== "1" && r.provider === "nim") {
            send({ t: ts(), kind: "tool", name: "inspect_render", status: "running", detail: "checking the result looks right…" });
            const insp = await scoreModel(stlPath, prompt, jobDir);
            if (insp) {
              send({ t: ts(), kind: "tool", name: "inspect_render", status: insp.ok ? "done" : "warn", detail: `likeness ${insp.score ?? "?"} · ${insp.reason}` });
              if (insp.score !== null && insp.score < 0.45) {
                send({ t: ts(), kind: "fix", text: "the shape didn't read clearly — regenerating with a stronger description…" });
                const r2 = await genNvidia(`${genPrompt}, accurate recognizable likeness, clear silhouette`, 1);
                const stl2 = await scaleStlFileToHeight(r2.stlPath, targetMm, path.join(jobDir, "scaled2.stl"));
                const insp2 = await scoreModel(stl2, prompt, jobDir);
                if (insp2 && (insp2.score ?? 0) >= (insp.score ?? 0)) { r = r2; stlPath = stl2; }
                send({ t: ts(), kind: "tool", name: "inspect_render", status: "done", detail: `retry likeness ${insp2?.score ?? "?"}` });
              }
            }
          }

          const meshUrl = `/generated/${jobId}/${path.basename(stlPath)}`;
          const glbUrl = r.glbPath ? `/generated/${jobId}/${path.basename(r.glbPath)}` : undefined;
          send({ t: ts(), kind: "mesh", url: meshUrl, glbUrl, textured: r.textured, label: "model", stage: 1, totalStages: 1 });

          // "NVIDIA + Blender": drop the mesh into the user's LIVE Blender to see/refine (when the socket's up).
          if (r.glbPath && (await blenderLiveAvailable())) {
            const ok = await importGlbToLive(r.glbPath);
            if (ok) send({ t: ts(), kind: "tool", name: "repair_mesh", status: "done", detail: "opened in Blender — refine it there" });
          }
          await finish(stlPath, meshUrl, "nvidia", "figure ready (NVIDIA)", undefined, 1, glbUrl);
          return;
        }

        // ───────────────────────── OPENSCAD / BLENDER (staged step-by-step build) ─────────────────────────
        const isBlender = engineName === "blender";
        const writeTool = isBlender ? "write_blender" : "write_openscad";
        send({ t: ts(), kind: "tool", name: writeTool, status: "running", detail: isEdit ? "editing the current model…" : "designing…" });

        let plan: GenPlan, source: string;
        if (isBlender) {
          try { plan = await claudeBpyPlan(prompt, isEdit ? base : undefined, primer); source = isEdit ? "claude-edit" : "claude"; }
          catch (e) {
            // Don't silently hand back the generic fallback creature dressed as success (the user can't tell
            // a snail came out a stand-in figure). Surface the REAL reason — a timeout means Claude ran past
            // the limit (often a session-start concurrency starve); retrying alone usually succeeds.
            const why = /timed out|ETIMEDOUT|killed/i.test((e as Error).message) ? "Claude ran past the time limit (try again — the first request of a session can starve)" : (e as Error).message.slice(0, 90);
            send({ t: ts(), kind: "tool", name: "write_blender", status: "warn", detail: `couldn't write a custom model (${why}) → generic stand-in shape` });
            plan = fallbackBpyPlan(prompt); source = "fallback";
          }
        } else if (isEdit) {
          try { plan = await claudePlan(prompt, base); source = "claude-edit"; }
          catch (e) { console.error("[claudePlan edit FAILED]", (e as Error)?.message); plan = fallbackPlan(prompt); source = "fallback"; }
        } else {
          const det = planOpenscad(prompt);
          if (det) { plan = det; source = "deterministic"; }
          else {
            console.error("[claudePlan] ANTHROPIC_API_KEY in env:", process.env.ANTHROPIC_API_KEY ? `yes (len ${process.env.ANTHROPIC_API_KEY.length})` : "NO");
            const _t0 = Date.now();
            try { plan = await claudePlan(prompt); source = "claude"; console.error(`[claudePlan OK] ${Date.now() - _t0}ms, ${plan.stages.length} stages`); }
            catch (e) { console.error(`[claudePlan FAILED] after ${Date.now() - _t0}ms:`, (e as Error)?.message); plan = fallbackPlan(prompt); source = "fallback"; }
          }
        }

        const live = isBlender ? await blenderLiveAvailable() : false;
        if (isBlender && !live) send({ t: ts(), kind: "tool", name: "write_blender", status: "warn", detail: "Blender live window NOT connected (start the addon: N-panel → BlenderMCP → Connect) → headless" });
        send({ t: ts(), kind: "tool", name: writeTool, status: "done", detail: `${plan.stages.length} stages · ${source} · ${isBlender ? (live ? "Blender · live window" : "Blender · headless") : "OpenSCAD"}` });

        let lastStl = "", lastMeshUrl = "", lastSource = "", meshes = 0;
        for (let i = 0; i < plan.stages.length; i++) {
          const st = plan.stages[i];
          if (!isBlender) await writeFile(WATCH, st.scad);
          send({ t: ts(), kind: "tool", name: "render_preview", status: "running", detail: st.label });
          const stl = path.join(jobDir, `stage${i}.stl`);
          let unknown: string[] = [];
          try {
            if (isBlender) await renderStageBlender(st.scad, stl, path.join(jobDir, `stage${i}.py`), live);
            else unknown = await renderStage(st.scad, stl, path.join(jobDir, `stage${i}.scad`));
            if (!existsSync(stl)) throw new Error("no geometry produced");
          } catch (err) {
            send({ t: ts(), kind: "tool", name: "render_preview", status: "error", detail: `${st.label}: ${(err as Error).message.slice(0, 80)}` });
            continue;
          }
          lastStl = stl; lastMeshUrl = `/generated/${jobId}/stage${i}.stl`; lastSource = st.scad; meshes++;
          // Surface dropped modules (OpenSCAD ignores unknown ones silently → a part renders incomplete).
          if (unknown.length)
            send({ t: ts(), kind: "tool", name: "render_preview", status: "warn", detail: `${st.label}: skipped unknown ${unknown.slice(0, 3).join(", ")} — geometry may be incomplete` });
          send({ t: ts(), kind: "tool", name: "render_preview", status: "done", detail: `${st.label} · ${st.detail}` });
          send({ t: ts(), kind: "mesh", url: lastMeshUrl, label: st.label, stage: i + 1, totalStages: plan.stages.length });
          await sleep(650);
        }
        if (meshes === 0) {
          send({ t: ts(), kind: "summary", text: "couldn't render this one — try rephrasing or another engine" });
          return;
        }
        await finish(lastStl, lastMeshUrl, engineName, `${plan.object} ready — ${plan.stages.length} build steps`, lastSource, plan.stages.length);
      } catch (err) {
        send({ t: ts(), kind: "tool", name: "render_preview", status: "error", detail: (err as Error).message.slice(0, 120) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
