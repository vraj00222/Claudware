import { parseStlAuto } from "@/server/printPlan";
import { buildPrintReadiness } from "@/server/printReady/readiness";
import { BAMBU_A1, GENERIC_BED, type PrinterBed } from "@/server/printReady/bed";
import { trisToObj, trisTo3mf } from "@/server/printReady/exportFormats";
import { buildPrintRecipe } from "@/server/printReady/recipe";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AgentEvent, ExportFormat } from "@/lib/agentEvent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PUBLIC = path.join(process.cwd(), "public", "generated");

/** Resolve the mesh bytes — a local /generated path or an http durable storage URL (timed). */
async function readMesh(meshUrl: string): Promise<Buffer> {
  if (/^https?:\/\//i.test(meshUrl)) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    try {
      const res = await fetch(meshUrl, { signal: ctrl.signal, redirect: "follow" });
      if (!res.ok) throw new Error(`fetch ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } finally { clearTimeout(t); }
  }
  return readFile(path.join(process.cwd(), "public", meshUrl.replace(/^\//, "")));
}

/**
 * "PREPARE FOR PRINT" — the per-version Print-Readiness v2 action (NOT part of the build stream).
 * Reads a finished mesh → DIAGNOSE (4 checks + score) → ORIENT (best pose) → DECOMPOSE decision →
 * EXPORT (writes OBJ + 3MF, STL already exists) → streams a `printready` package + a plain narrative.
 * Pure compute + file writes (no subprocess); the heavy Blender transforms (auto-thicken/repair) land
 * in a later phase. See docs/superpowers/specs/2026-06-17-print-readiness-pipeline-v2-design.md.
 */
export async function POST(req: Request) {
  const { meshUrl, bed = "bambu" } = (await req.json().catch(() => ({}))) as { meshUrl?: string; bed?: string };
  const jobId = `prep_${Date.now().toString(36)}`;
  const jobDir = path.join(PUBLIC, jobId);
  const t0 = Date.now();
  const ts = () => { const s = Math.floor((Date.now() - t0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  const profile: PrinterBed = bed === "generic" ? GENERIC_BED : BAMBU_A1;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: AgentEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (!meshUrl) throw new Error("missing mesh");
        send({ t: ts(), kind: "plan", text: `Preparing this model for print on the ${profile.name}…` });
        await mkdir(jobDir, { recursive: true });

        send({ t: ts(), kind: "tool", name: "validate", status: "running", detail: "checking walls · holes · overhangs · orientation…" });
        const tris = parseStlAuto(await readMesh(meshUrl));
        if (!tris.length) throw new Error("couldn't read the model mesh");

        // RECIPE: auto-decide print settings from geometry before export
        send({ t: ts(), kind: "tool", name: "export", status: "running", detail: "analyzing model for optimal print settings…" });
        const recipe = buildPrintRecipe(tris, profile);
        send({ t: ts(), kind: "tool", name: "export", status: "done", detail: `${recipe.modelClass} → ${recipe.layerHeight}mm layers, ${recipe.infillPercent}% infill, ${recipe.supportStyle} supports` });

        // EXPORT: write OBJ + 3MF (with embedded settings) in parallel (STL already exists at meshUrl).
        send({ t: ts(), kind: "tool", name: "export", status: "running", detail: "writing 3MF (with print settings) + OBJ…" });
        await Promise.all([
          writeFile(path.join(jobDir, "model.obj"), trisToObj(tris)),
          writeFile(path.join(jobDir, "model.3mf"), trisTo3mf(tris, recipe)),
        ]);
        const formats: ExportFormat[] = [
          { format: "stl", url: meshUrl, label: "STL" },
          { format: "obj", url: `/generated/${jobId}/model.obj`, label: "OBJ (keeps geometry)" },
          { format: "3mf", url: `/generated/${jobId}/model.3mf`, label: `3MF (${profile.name} — settings embedded, one-click print)` },
        ];
        send({ t: ts(), kind: "tool", name: "export", status: "done", detail: `STL · OBJ · 3MF ready — ~${recipe.estimateMinutes}min, ~${recipe.estimateGrams}g ${recipe.material}` });

        const readiness = buildPrintReadiness(tris, profile, formats);
        send({ t: ts(), kind: "tool", name: "validate", status: readiness.grade === "needs_work" ? "warn" : "done", detail: `readiness ${readiness.score}/100 · ${readiness.grade.replace("_", " ")} · orient: ${readiness.orientation.label}` });
        send({ t: ts(), kind: "printready", readiness });
        send({ t: ts(), kind: "summary", text: readiness.narrative });
      } catch (err) {
        send({ t: ts(), kind: "tool", name: "validate", status: "error", detail: (err as Error).message.slice(0, 120) });
        send({ t: ts(), kind: "summary", text: "couldn't prepare this model for print — try regenerating it first" });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
