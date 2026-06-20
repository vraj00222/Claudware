import { estimateFromTris } from "@/server/openscad";
import { buildPrintPlanFromTris, parseStlAuto, boundingBox, DEFAULT_BED } from "@/server/printPlan";
import { uploadFinalStl } from "@/server/storage";
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AgentEvent } from "@/lib/agentEvent";
import type { SizeEdit } from "@/server/sizeEdit";
import type { Tri } from "@/server/printPlan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PUBLIC = path.join(process.cwd(), "public", "generated");

/** Resolve the base mesh bytes — a local /generated path (the fast same-session URL) or an http
 *  durable storage URL. */
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

/** Write triangles as a minimal ascii STL (Z-up, matching the rest of the pipeline). */
function trisToAsciiStl(tris: Tri[]): string {
  let s = "solid scaled\n";
  for (const [a, b, c] of tris) {
    s += " facet normal 0 0 0\n  outer loop\n";
    for (const v of [a, b, c]) s += `   vertex ${v.x} ${v.y} ${v.z}\n`;
    s += "  endloop\n endfacet\n";
  }
  return s + "endsolid scaled\n";
}

/**
 * DETERMINISTIC SIZE EDIT: scale the EXISTING mesh instead of regenerating. Meshgen (TRELLIS) has no
 * editable recipe, so "make it smaller" via regen yields a DIFFERENT object — here we just scale the
 * current triangles, so the result is the same model at the requested size. Reuses the estimate /
 * print-plan / storage pipeline and emits the SAME AgentEvents as a generation (→ studio saves a v2).
 */
export async function POST(req: Request) {
  const { meshUrl, edit } = (await req.json().catch(() => ({}))) as { meshUrl?: string; edit?: SizeEdit };
  const jobId = `xf_${Date.now().toString(36)}`;
  const jobDir = path.join(PUBLIC, jobId);
  const t0 = Date.now();
  const ts = () => { const s = Math.floor((Date.now() - t0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: AgentEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (!meshUrl || !edit) throw new Error("missing mesh or edit");
        send({ t: ts(), kind: "plan", text: "Resizing the current model…" });
        send({ t: ts(), kind: "tool", name: "render_preview", status: "running", detail: "scaling geometry…" });
        await mkdir(jobDir, { recursive: true });

        const tris = parseStlAuto(await readMesh(meshUrl));
        if (!tris.length) throw new Error("could not read the current mesh");
        const bb = boundingBox(tris);
        const k = edit.kind === "height" ? (bb.h > 0 ? edit.mm / bb.h : 1) : edit.factor;
        const scaled: Tri[] = tris.map(([a, b, c]) => [
          { x: a.x * k, y: a.y * k, z: a.z * k },
          { x: b.x * k, y: b.y * k, z: b.z * k },
          { x: c.x * k, y: c.y * k, z: c.z * k },
        ]);

        const stlPath = path.join(jobDir, "model.stl");
        await writeFile(stlPath, trisToAsciiStl(scaled));
        const meshOut = `/generated/${jobId}/model.stl`;
        const nb = boundingBox(scaled);
        send({ t: ts(), kind: "tool", name: "render_preview", status: "done", detail: `${nb.w.toFixed(0)}×${nb.d.toFixed(0)}×${nb.h.toFixed(0)} mm` });
        send({ t: ts(), kind: "mesh", url: meshOut, label: "resized", stage: 1, totalStages: 1 });

        try { const est = estimateFromTris(scaled); send({ t: ts(), kind: "estimate", grams: est.grams, minutes: est.minutes, layers: est.layers, material: est.material }); } catch { /* best-effort */ }
        const durableUrl = await uploadFinalStl(jobId, stlPath);
        try { send({ t: ts(), kind: "printplan", plan: buildPrintPlanFromTris(scaled, DEFAULT_BED, { stlUrl: meshOut, storageUrl: durableUrl }) }); } catch { /* best-effort */ }
        send({ t: ts(), kind: "summary", text: `resized — now ${nb.w.toFixed(0)}×${nb.d.toFixed(0)}×${nb.h.toFixed(0)} mm`, engine: "blender", meshUrl: durableUrl });
      } catch (err) {
        send({ t: ts(), kind: "tool", name: "render_preview", status: "error", detail: (err as Error).message.slice(0, 120) });
        send({ t: ts(), kind: "summary", text: "couldn't resize — try regenerating instead" });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
