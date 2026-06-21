import { planOpenscad, estimateFromStl, type GenPlan, type Stage } from "@/server/openscad";
import { claudeBpyPlan, fallbackBpyPlan, renderStageBlender, blenderLiveAvailable, importGlbToLive, cleanStlInBlender, validateStl } from "@/server/blender";
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
import { claudeText, getTtcStats } from "@/server/claude";
import { OPENSCAD_BIN as OPENSCAD } from "@/server/bin";
import { getExact, findSimilar, putGeneration, type CachedGeneration, type GenCacheRequest } from "@/server/genCache";
import { recordTurn, bumpStat } from "@/server/agentMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileP = promisify(execFile);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const EST_TOKENS_PER_REUSE = 12_000; // representative design-pass output budget saved per cache reuse
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

// ───────────────────────── common sense for printable design ─────────────────────────
// Injected into BOTH OpenSCAD and Blender prompts so Claude "knows" how physical objects work.
// This is the DESIGN INTELLIGENCE that makes our output demo-worthy: Claude acts like an
// experienced product designer who knows how things are actually made and used.
const COMMON_SENSE_BLOCK =
  `\n**DESIGN INTELLIGENCE — how real-world printable objects MUST work (non-negotiable):**\n` +
  `\n--- FUNCTIONAL FEATURES ---\n` +
  `- KEYCHAINS/TAGS: MUST have a THROUGH-HOLE (not blind) near one end for a keyring — ` +
  `diameter ~5-6mm, all the way through. Add rounded edges on the hole. Without a through-hole ` +
  `it is NOT a keychain. Typical size: 50-70mm long, 25-35mm wide, 4-5mm thick.\n` +
  `- PHONE STANDS/DOCKS: Back support angled 60-75°. Front lip ≥5mm tall to hold phone. ` +
  `Cable/charging slot at bottom center (~15×8mm). Wide stable base (≥80mm). ` +
  `Optional: tablet mode (steeper angle), landscape notch.\n` +
  `- CABLE CLIPS/ORGANIZERS: Channel diameter should match cable size (USB-C ~3.5mm, Lightning ~3mm, ` +
  `power ~6-8mm). Add a snap-fit slot (slight undercut) so cable clicks in. Wall ≥2mm.\n` +
  `- WALL HOOKS: Hook opening 25-35mm. Mounting: either flat back with 2 screw holes (4mm dia, ` +
  `countersunk), or a keyhole slot. Hook curve radius ≥8mm (no sharp bends). Load-bearing ` +
  `thickness ≥4mm.\n` +
  `- HEADPHONE STANDS: Tall enough for over-ear headphones (~200mm). Wide stable base (≥100mm). ` +
  `Curved top cradle (~50mm wide). Optional cable-wrap hooks on the stem.\n` +
  `- PEN/PENCIL HOLDERS: Inner diameter ≥15mm for pens, ≥12mm for pencils. Multiple holes for ` +
  `organizer style. Wall ≥2mm. Weighted/wide base for stability.\n` +
  `- BOOKENDS: L-shaped, heavy base (≥100×80mm), tall back (≥150mm). Wall ≥4mm for strength. ` +
  `Anti-slip ridge on the bottom.\n` +
  `\n--- TEXT & BRANDING ---\n` +
  `- TEXT/SPELLING: Copy the EXACT spelling from the prompt — every single character. ` +
  `"CLAUDE HARDWARE" is NOT "CLAUDWARE" or "CLUDE". Read the prompt again before writing text.\n` +
  `- Use linear_extrude on text() (OpenSCAD). Make text ≥1.5mm tall and ≥0.8mm deep/raised. ` +
  `Emboss (raised) preferred over engrave for small text — it's more visible on prints.\n` +
  `- For logos/text on curved surfaces, project onto the surface, don't float above it.\n` +
  `- COINS/MEDALS/TOKENS: 35-45mm diameter, 3-4mm thick. Raised rim (0.5mm). Both faces ` +
  `can have detail. Text ≥8pt equivalent. Center the main text/logo.\n` +
  `\n--- CONTAINERS & ENCLOSURES ---\n` +
  `- BOXES/CONTAINERS: Wall ≥1.5mm. If it has a lid, add a press-fit lip (~0.3mm clearance ` +
  `all around). Rounded interior corners (fillet ≥2mm) for easier printing.\n` +
  `- VASES: Wall ≥2mm. If it should hold water, make it a SOLID shell (no infill gaps). ` +
  `Flat stable base ≥40mm dia. Smooth interior.\n` +
  `- PLANTERS/POTS: Drainage holes in the bottom (3-4 holes, ~5mm each). Optional saucer/tray. ` +
  `Wall ≥2.5mm for outdoor durability.\n` +
  `- DESK ORGANIZERS/TRAYS: Compartment walls ≥1.5mm. Slightly rounded bottoms so items ` +
  `don't get stuck. Chamfered top edges for comfort.\n` +
  `\n--- MECHANICAL & FUNCTIONAL ---\n` +
  `- BRACKETS/MOUNTS: Screw holes with countersink (M3=3.2mm, M4=4.2mm, M5=5.2mm — add ` +
  `0.2mm clearance). Fillets at stress corners ≥2mm. Minimum wall at holes ≥2× hole diameter.\n` +
  `- HINGES/JOINTS: Print-in-place clearance 0.3-0.4mm. Pin diameter ≥3mm. ` +
  `Knuckle wall ≥1.5mm.\n` +
  `- SNAP-FITS: Cantilever beam thickness 1-2mm, overhang 0.3-0.5mm, ` +
  `45° lead-in angle on the catch.\n` +
  `- GEARS: Use BOSL2 spur_gear() for real involute profiles. Mesh clearance ` +
  `0.1-0.2mm between teeth. Bore with keyway or D-shaft flat.\n` +
  `- THREADED PARTS: Use BOSL2 threaded_rod()/threaded_nut(). Print clearance 0.2mm ` +
  `on thread diameter. Vertical threads print best.\n` +
  `\n--- DECORATIVE & FIGURES ---\n` +
  `- FIGURINES/STATUES: Solid base ≥15mm diameter for stability. No floating parts. ` +
  `Minimum feature size 1.5mm. Avoid extreme overhangs (≤60° from vertical).\n` +
  `- LITHOPHANES/PHOTO FRAMES: Frame border ≥5mm. Easel back or wall-mount keyhole. ` +
  `Stand angle ~15° back from vertical.\n` +
  `- ORNAMENTS/DECORATIONS: Include a hanging hole or hook (3-4mm hole at top). ` +
  `Keep weight under 50g for Christmas tree ornaments.\n` +
  `- DESK TOYS/FIDGETS: Smooth edges everywhere (fillet ≥1mm). Moving parts need ` +
  `0.3mm clearance. Comfortable grip size 30-50mm.\n` +
  `\n--- UNIVERSAL RULES ---\n` +
  `- All THROUGH-HOLES: use difference() — never blind pockets unless explicitly asked.\n` +
  `- All sharp edges: fillet/chamfer 0.5-1mm for printability and safety.\n` +
  `- Minimum wall: 1.2mm (nozzle-dependent). Minimum feature: 1mm.\n` +
  `- Flat bottom for bed adhesion. Contact patch ≥8mm diameter.\n` +
  `- No unsupported bridges longer than 20mm. No overhangs past 60° without support.\n` +
  `- When in doubt, make it THICKER and STURDIER — thin fragile prints break.\n`;

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
    COMMON_SENSE_BLOCK +
    `Rules: millimetres; watertight & printable; keep $fn ≤ 64 (gears/threads render slowly otherwise); ` +
    `stage 1 = rough base, last stage = finished model; each stage's code stands alone and renders ` +
    `non-empty. No prose, no markdown, no backticks. Begin your reply immediately with "@@@STAGE".`;
  // Single text-generation call → the Messages API directly (fetch). The `claude -p` agent CLI was loading
  // MCP servers and reasoning agentically for MINUTES on this instruction, hitting the timeout → fallback.
  const stdout = await claudeText(instruction, { maxTokens: 12_000 });

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

/** One-shot self-repair: feed a failed stage's OpenSCAD + the compiler error back to Claude and ask for a
 *  corrected program (the constitution's "inspect its own render, fix its own mistakes"). Returns null on any
 *  failure so the caller falls back. BOSL2 part libraries are re-injected via ensureBosl2Parts. */
async function repairOpenscad(prompt: string, brokenScad: string, errText: string): Promise<string | null> {
  const instruction =
    `This OpenSCAD program, meant to render a 3D-printable "${prompt}", FAILED with:\n` +
    `${(errText || "empty geometry").slice(0, 700)}\n\n` +
    `--- PROGRAM ---\n${brokenScad}\n--- END ---\n\n` +
    `Return ONLY a corrected, complete OpenSCAD program that compiles and renders NON-EMPTY geometry. ` +
    `Fix the specific error (wrong BOSL2 args, undefined variables, bad syntax). BOSL2 part libraries are ` +
    `auto-included — do NOT add include lines for them. Keep $fn ≤ 64. No prose, no markdown, no backticks.`;
  try {
    const out = await claudeText(instruction, { maxTokens: 8_000 });
    const scad = out.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
    return scad ? ensureBosl2Parts(scad) : null;
  } catch { return null; }
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

/** Render an OpenSCAD stage, treating a compile error OR empty output as a SOFT failure (returning the error
 *  text) instead of throwing — so the caller can self-repair or fall back rather than dead-ending. */
async function tryRenderOpenscad(scad: string, stlPath: string, scadPath: string): Promise<{ ok: boolean; unknown: string[]; err?: string }> {
  try {
    const unknown = await renderStage(scad, stlPath, scadPath);
    if (!existsSync(stlPath) || !validateStl(stlPath)) return { ok: false, unknown, err: "rendered empty geometry" };
    return { ok: true, unknown };
  } catch (e) {
    const err = (e as { stderr?: string }).stderr?.trim() || (e as Error).message;
    return { ok: false, unknown: [], err };
  }
}

export async function POST(req: Request) {
  const { prompt = "", engine = "auto", base = "", sizeMm, refImageUrl, postSteps, sessionId } =
    (await req.json().catch(() => ({}))) as {
      prompt?: string; engine?: RequestedEngine; base?: string; sizeMm?: number; refImageUrl?: string;
      postSteps?: { cleanInBlender?: boolean }; sessionId?: string;
    };

  const isEdit = typeof base === "string" && base.trim().length > 0; // refine-in-place
  const cleanInBlender = Boolean(postSteps?.cleanInBlender);
  // Redis reuse-before-regenerate: only cache fresh, text-only prompts (edits + ref-image jobs vary too
  // much to safely replay). The cache key still includes engine/size so different requests don't collide.
  const cacheable = !isEdit && !refImageUrl;
  const cacheReq: GenCacheRequest = { prompt, engine, sizeMm, base, refImageUrl, cleanInBlender };

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
      // Capture the tail events as we stream them so a finished build can be cached in Redis for reuse.
      let capMesh: CachedGeneration["mesh"] | undefined;
      let capEstimate: CachedGeneration["estimate"];
      let capSummary: Extract<AgentEvent, { kind: "summary" }> | undefined;
      let servedFromCache = false;
      const send = (e: AgentEvent) => {
        if (e.kind === "mesh") capMesh = { url: e.url, glbUrl: e.glbUrl, textured: e.textured, label: e.label };
        else if (e.kind === "estimate") capEstimate = { grams: e.grams, minutes: e.minutes, layers: e.layers, material: e.material };
        else if (e.kind === "summary") capSummary = e;
        controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      };

      // ───────── Redis: reuse-before-regenerate (exact + semantic vector search) ─────────
      // A finished model for this prompt (or a near-identical one) is replayed instantly from Redis —
      // 0 Claude tokens, no OpenSCAD/Blender/NVIDIA work. This is Redis "beyond caching": vector KNN
      // drives the agent's reuse decision. Best-effort: any failure just proceeds to a normal build.
      async function replayCached(cached: CachedGeneration, how: "exact" | "semantic", score?: number, matched?: string) {
        const label = how === "exact"
          ? "served from Redis — exact cache hit · 0 Claude tokens"
          : `served from Redis — semantic match (${Math.round((score ?? 0) * 100)}% similar to “${matched}”) · 0 Claude tokens`;
        send({ t: ts(), kind: "plan", text: `Engine: ${cached.engine} — reused from Redis (${how} cache)` });
        send({ t: ts(), kind: "tool", name: "redis_cache", status: "done", detail: label });
        send({ t: ts(), kind: "mesh", url: cached.mesh.url, glbUrl: cached.mesh.glbUrl, textured: cached.mesh.textured, label: cached.mesh.label, stage: 1, totalStages: 1 });
        send({ t: ts(), kind: "tool", name: "validate", status: "done", detail: "watertight · printable (cached)" });
        if (cached.estimate) send({ t: ts(), kind: "estimate", ...cached.estimate });
        // Recompute the Print Plan from the cached mesh file when it's still on disk (same machine).
        try {
          if (cached.mesh.url.startsWith("/generated/")) {
            const stlPath = path.join(process.cwd(), "public", cached.mesh.url);
            if (existsSync(stlPath)) {
              const stl = await readFile(stlPath, "utf8");
              send({ t: ts(), kind: "printplan", plan: buildPrintPlan(stl, DEFAULT_BED, { stlUrl: cached.mesh.url, storageUrl: cached.durableMeshUrl }) });
            }
          }
        } catch { /* best-effort */ }
        send({ t: ts(), kind: "summary", text: cached.summaryText, source: cached.source, engine: cached.engine, meshUrl: cached.durableMeshUrl ?? cached.mesh.url, ...(cached.parts && cached.parts.length ? { parts: cached.parts } : {}) });
      }

      if (cacheable) {
        try {
          const exact = await getExact(cacheReq);
          const semantic = exact ? null : await findSimilar(prompt);
          const cached = exact ?? semantic?.result ?? null;
          if (cached && cached.mesh?.url) {
            servedFromCache = true;
            await replayCached(cached, exact ? "exact" : "semantic", semantic?.score, semantic?.matchedPrompt);
            await bumpStat(exact ? "cacheHits" : "semanticHits");
            // each reuse avoids the design pass (a Claude script call, ~12k max output tokens)
            await bumpStat("tokensSaved", EST_TOKENS_PER_REUSE);
            await recordTurn(sessionId, { prompt, engine: cached.engine, meshUrl: cached.mesh.url, served: exact ? "exact-cache" : "semantic-cache", ts: Date.now() });
            controller.close();
            return;
          }
        } catch { /* never let the cache break a generation */ }
      }

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
        // TTC compression stats chip (sponsor visibility — only shown when TTC is active)
        const ttcStats = getTtcStats();
        if (ttcStats.enabled && ttcStats.totalSaved > 0) {
          send({ t: ts(), kind: "tool", name: "ttc_compress", status: "done",
            detail: `Token Company: ${ttcStats.totalSaved} tokens saved (${ttcStats.ratio.toFixed(1)}x compression across ${ttcStats.calls} calls)` });
        }
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
        // Wrapped in try/catch: if the ENTIRE NVIDIA path fails (scale, inspect, export — not just NIM),
        // fall through to the Blender engine so the demo never dead-ends on a figure prompt.
        if (engineName === "nvidia") {
          try {
            send({ t: ts(), kind: "tool", name: "inspect_render", status: "running", detail: refImageUrl ? "reading your reference image…" : "researching the look…" });
            const { enrichPrompt, describeImage, webResearchImage } = await import("@/server/promptEnrich");
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
            } else {
              // No user ref image — use Browserbase to web-research a reference image of the subject,
              // so TRELLIS gets a visual descriptor instead of just a text guess (the Tesla-robot fix).
              const webRef = await webResearchImage(prompt, jobDir);
              if (webRef) {
                basePrompt = `${prompt}. Web reference shows: ${webRef.description}`;
                send({ t: ts(), kind: "tool", name: "inspect_render", status: "done", detail: `web research: ${webRef.description.slice(0, 80)}` });
              }
            }
            const genPrompt = await enrichPrompt(basePrompt);
            send({ t: ts(), kind: "tool", name: "inspect_render", status: "done", detail: genPrompt.slice(0, 90) });

            // MULTI-SEED: try with seed 0 first, inspect, retry up to 2 more seeds if the result is a blob.
            // TRELLIS quality varies wildly by seed — trying 2-3 seeds lifts success from ~40% to ~80%.
            const FIGURE_DEFAULT_MM = 120;
            const targetMm = sizeMm && sizeMm > 0 ? sizeMm : FIGURE_DEFAULT_MM;
            const { scaleStlFileToHeight } = await import("@/server/meshScale");

            let r = await genNvidia(genPrompt, 0);
            let stlPath = await scaleStlFileToHeight(r.stlPath, targetMm, path.join(jobDir, "scaled.stl"));

            // SELF-INSPECT → bounded retry with different seeds AND simpler prompts.
            // Threshold raised from 0.45 → 0.55 to catch more blobs. On retry, use a SHORTER prompt
            // (TRELLIS produces better results with fewer words, not more).
            if (process.env.DISABLE_INSPECT !== "1" && r.provider === "nim") {
              send({ t: ts(), kind: "tool", name: "inspect_render", status: "running", detail: "checking the result looks right…" });
              const insp = await scoreModel(stlPath, prompt, jobDir);
              if (insp) {
                send({ t: ts(), kind: "tool", name: "inspect_render", status: insp.ok ? "done" : "warn", detail: `likeness ${insp.score ?? "?"} · ${insp.reason}` });
                // Retry with different seeds if score < 0.55 (was 0.45 — caught too few blobs)
                if (insp.score !== null && insp.score < 0.55) {
                  // Retry 1: simpler, shorter prompt + seed 42 (TRELLIS does BETTER with fewer words)
                  const shortPrompt = `${prompt}, 3D figurine, detailed, on round base`;
                  send({ t: ts(), kind: "fix", text: "the shape didn't read clearly — trying with a cleaner prompt…" });
                  const r2 = await genNvidia(shortPrompt, 42);
                  const stl2 = await scaleStlFileToHeight(r2.stlPath, targetMm, path.join(jobDir, "scaled2.stl"));
                  const insp2 = await scoreModel(stl2, prompt, jobDir);
                  const score2 = insp2?.score ?? 0;
                  if (score2 > (insp.score ?? 0)) { r = r2; stlPath = stl2; }
                  send({ t: ts(), kind: "tool", name: "inspect_render", status: "done", detail: `retry 1 likeness ${score2.toFixed(2)}` });

                  // Retry 2: if still bad, try the raw user prompt (no enrichment) + seed 7
                  if (Math.max(score2, insp.score ?? 0) < 0.55) {
                    send({ t: ts(), kind: "fix", text: "still not right — trying the raw prompt directly…" });
                    const r3 = await genNvidia(prompt, 7);
                    const stl3 = await scaleStlFileToHeight(r3.stlPath, targetMm, path.join(jobDir, "scaled3.stl"));
                    const insp3 = await scoreModel(stl3, prompt, jobDir);
                    const score3 = insp3?.score ?? 0;
                    const bestSoFar = Math.max(insp.score ?? 0, score2);
                    if (score3 > bestSoFar) { r = r3; stlPath = stl3; }
                    send({ t: ts(), kind: "tool", name: "inspect_render", status: "done", detail: `retry 2 likeness ${score3.toFixed(2)}` });
                  }
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
            // If after all retries the best score is still very low, fall to Blender for a better figure
            if (process.env.DISABLE_INSPECT !== "1" && r.provider === "nim") {
              const finalInsp = await scoreModel(stlPath, prompt, jobDir);
              if (finalInsp && finalInsp.score !== null && finalInsp.score < 0.3) {
                send({ t: ts(), kind: "tool", name: "inspect_render", status: "warn", detail: `NVIDIA output unrecognizable (${finalInsp.score.toFixed(2)}) — building in Blender instead` });
                throw new Error("NVIDIA output too low quality — Blender fallback");
              }
            }

            await finish(stlPath, meshUrl, "nvidia", "figure ready (NVIDIA)", undefined, 1, glbUrl);
            return;
          } catch (nvidiaErr) {
            // NVIDIA path failed entirely — fall through to Blender so the demo never dead-ends.
            send({ t: ts(), kind: "tool", name: "generate_mesh", status: "warn", detail: `NVIDIA didn't produce a clear result — building in Blender instead` });
            engineName = "blender";
            // Fall through to the Blender/OpenSCAD staged build below
          }
        }

        // ───────────────────────── OPENSCAD / BLENDER (staged step-by-step build) ─────────────────────────
        const isBlender = engineName === "blender";
        const writeTool = isBlender ? "write_blender" : "write_openscad";
        send({ t: ts(), kind: "tool", name: writeTool, status: "running", detail: isEdit ? "editing the current model…" : "designing…" });

        let plan: GenPlan, source: string;
        if (isBlender) {
          // Named-subject likeness (e.g. the Claude mascot, dressed in any outfit) flows to the Blender
          // build too — not just NVIDIA. This is what fixes "NVIDIA was down → Blender built a generic
          // creature": the canonical Clawd descriptor is fed to the bpy planner so the fallback is on-brand.
          const { canonicalDescriptor } = await import("@/server/promptEnrich");
          const canon = isEdit ? "" : canonicalDescriptor(prompt);
          const buildPrompt = canon ? `${canon}. ${prompt}`.slice(0, 900) : prompt;
          try { plan = await claudeBpyPlan(buildPrompt, isEdit ? base : undefined, primer); source = isEdit ? "claude-edit" : "claude"; }
          catch (e) {
            // Don't silently hand back the generic fallback creature dressed as success (the user can't tell
            // a snail came out a stand-in figure). Surface the REAL reason — a timeout means Claude ran past
            // the limit (often a session-start concurrency starve); retrying alone usually succeeds.
            const why = /timed out|ETIMEDOUT|killed/i.test((e as Error).message) ? "Claude ran past the time limit (try again — the first request of a session can starve)" : (e as Error).message.slice(0, 90);
            send({ t: ts(), kind: "tool", name: "write_blender", status: "warn", detail: `couldn't write a custom model (${why}) → generic stand-in shape` });
            plan = fallbackBpyPlan(buildPrompt); source = "fallback";
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
          const isFinalStage = i === plan.stages.length - 1;
          if (!isBlender) await writeFile(WATCH, st.scad);
          send({ t: ts(), kind: "tool", name: "render_preview", status: "running", detail: st.label });
          const stl = path.join(jobDir, `stage${i}.stl`);
          const scadPath = path.join(jobDir, `stage${i}.scad`);
          let unknown: string[] = [];
          try {
            if (isBlender) {
              await renderStageBlender(st.scad, stl, path.join(jobDir, `stage${i}.py`), live, isFinalStage);
              if (!existsSync(stl)) throw new Error("no geometry produced");
              // Validate STL has real geometry (not just a header / empty file)
              if (!validateStl(stl)) {
                // On edit, keep the previous good mesh instead of emitting a broken one
                if (isEdit && lastStl) {
                  send({ t: ts(), kind: "tool", name: "render_preview", status: "warn", detail: `${st.label}: produced empty mesh — kept the previous version` });
                  continue;
                }
                throw new Error("empty STL (no geometry)");
              }
            } else {
              // OpenSCAD: render; on a compile error / empty geometry from a Claude-written stage, ask Claude
              // to fix its own mistake once and re-render before giving up (never dead-end a good prompt).
              let res = await tryRenderOpenscad(st.scad, stl, scadPath);
              if (!res.ok && source.startsWith("claude")) {
                send({ t: ts(), kind: "fix", text: `${st.label} didn't render — fixing the design…` });
                const fixed = await repairOpenscad(prompt, st.scad, res.err || "");
                if (fixed) {
                  const res2 = await tryRenderOpenscad(fixed, stl, scadPath);
                  if (res2.ok) { st.scad = fixed; await writeFile(WATCH, fixed); res = res2; }
                }
              }
              if (!res.ok) throw new Error(res.err || "no geometry produced");
              unknown = res.unknown;
            }
          } catch (err) {
            // On edit failure: keep previous good mesh, warn instead of dead-ending
            if (isEdit && lastStl) {
              send({ t: ts(), kind: "tool", name: "render_preview", status: "warn", detail: `${st.label}: ${(err as Error).message.slice(0, 60)} — kept previous version` });
              continue;
            }
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
          // Edit produced nothing — never dead-end, provide actionable guidance
          if (isEdit) {
            send({ t: ts(), kind: "summary", text: "couldn't apply that edit cleanly — try a simpler change or regenerate from scratch" });
            return;
          }
          // Fresh prompt produced nothing (Claude/Blender/NVIDIA all failed on this box). GUARANTEE a
          // printable result with the deterministic OpenSCAD plan — a clean solid beats a dead-end so the
          // demo can always proceed to print. (OpenSCAD is the always-present engine.)
          send({ t: ts(), kind: "fix", text: "the custom design wouldn't render — falling back to a clean printable shape…" });
          const fb = fallbackPlan(prompt);
          for (let i = 0; i < fb.stages.length; i++) {
            const st = fb.stages[i];
            await writeFile(WATCH, st.scad);
            send({ t: ts(), kind: "tool", name: "render_preview", status: "running", detail: st.label });
            const stl = path.join(jobDir, `fb${i}.stl`);
            const res = await tryRenderOpenscad(st.scad, stl, path.join(jobDir, `fb${i}.scad`));
            if (!res.ok) { send({ t: ts(), kind: "tool", name: "render_preview", status: "error", detail: `${st.label}: ${(res.err || "").slice(0, 80)}` }); continue; }
            lastStl = stl; lastMeshUrl = `/generated/${jobId}/fb${i}.stl`; lastSource = st.scad; meshes++;
            send({ t: ts(), kind: "tool", name: "render_preview", status: "done", detail: `${st.label} · ${st.detail}` });
            send({ t: ts(), kind: "mesh", url: lastMeshUrl, label: st.label, stage: i + 1, totalStages: fb.stages.length });
            await sleep(650);
          }
          if (meshes > 0) {
            await finish(lastStl, lastMeshUrl, "openscad", `${fb.object} ready — printable fallback (${fb.stages.length} steps)`, lastSource, fb.stages.length);
            return;
          }
          send({ t: ts(), kind: "summary", text: "couldn't render this one — try rephrasing or another engine" });
          return;
        }
        await finish(lastStl, lastMeshUrl, engineName, `${plan.object} ready — ${plan.stages.length} build steps`, lastSource, plan.stages.length);
      } catch (err) {
        send({ t: ts(), kind: "tool", name: "render_preview", status: "error", detail: (err as Error).message.slice(0, 120) });
      } finally {
        // Persist the finished build to Redis so the next identical/similar prompt is reused instantly.
        if (!servedFromCache && cacheable && capSummary?.engine && capMesh) {
          try {
            const cached: CachedGeneration = {
              prompt,
              engine: capSummary.engine,
              source: capSummary.source,
              summaryText: capSummary.text,
              mesh: capMesh,
              durableMeshUrl: capSummary.meshUrl,
              estimate: capEstimate,
              parts: capSummary.parts,
              createdAt: Date.now(),
            };
            await putGeneration(cacheReq, cached);
            await bumpStat("generations");
            await bumpStat("cacheMisses");
            await recordTurn(sessionId, { prompt, engine: cached.engine, meshUrl: capMesh.url, served: "fresh", ts: Date.now() });
            send({ t: ts(), kind: "tool", name: "redis_memory", status: "done", detail: "cached to Redis · semantic vector index updated" });
          } catch { /* best-effort persistence */ }
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
