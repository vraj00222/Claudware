import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AgentEvent, SplitResult } from "@/lib/agentEvent";
import { parseStlAuto, boundingBox, type Bed } from "@/server/printPlan";
import { GENERIC_BED, BAMBU_A1 } from "@/server/printReady/bed";
import { planSplitParts, renderSplitParts } from "@/server/split";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PUBLIC = path.join(process.cwd(), "public", "generated");

/** Resolve mesh bytes — a local /generated path or an http durable storage URL (timed). */
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
 * SPLIT-FOR-PRINT — cut a finished mesh into printable parts joined by PUSH-FIT connectors.
 * Body: { meshUrl, parts?, clearance?, bed? }.
 *  - `parts` forces an N-part "print version" even when the model fits the bed (the user's ask).
 *  - omit `parts` for AUTO: only splits when the model is bigger than the bed.
 * Streams tool events while OpenSCAD cuts each part, then a `split` event with per-part STL URLs +
 * the exact connector measurements + a plain join guide. Never throws past the stream.
 */
export async function POST(req: Request) {
  const { meshUrl, parts, clearance, bed = "generic" } = (await req.json().catch(() => ({}))) as {
    meshUrl?: string; parts?: number; clearance?: number; bed?: string;
  };
  const jobId = `split_${Date.now().toString(36)}`;
  const jobDir = path.join(PUBLIC, jobId);
  const t0 = Date.now();
  const ts = () => { const s = Math.floor((Date.now() - t0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
  const profile: Bed = bed === "bambu" ? BAMBU_A1 : GENERIC_BED;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: AgentEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (!meshUrl) throw new Error("missing mesh");
        send({ t: ts(), kind: "plan", text: parts && parts >= 2 ? `Making a ${parts}-part push-fit print version…` : "Checking whether this needs splitting for your bed…" });
        await mkdir(jobDir, { recursive: true });

        const mesh = await readMesh(meshUrl);
        const tris = parseStlAuto(mesh);
        if (!tris.length) throw new Error("couldn't read the model mesh");
        const bbox = boundingBox(tris);

        const plan = planSplitParts(bbox, { parts, clearance, bed: profile });
        if (!plan) {
          send({ t: ts(), kind: "tool", name: "validate", status: "done", detail: `Fits the bed in one piece (${Math.round(bbox.w)}×${Math.round(bbox.d)}×${Math.round(bbox.h)}mm) — no split needed.` });
          send({ t: ts(), kind: "summary", text: "This model fits your bed in one piece. Ask for a print-in-parts version if you want to split it anyway." });
          controller.close();
          return;
        }

        send({ t: ts(), kind: "tool", name: "validate", status: "running", detail: plan.reason });
        send({ t: ts(), kind: "tool", name: "export", status: "running", detail: `cutting ${plan.parts.length} parts with push-fit connectors (Ø${plan.connector.pegDiameter}mm pegs, ${plan.connector.clearance}mm clearance)…` });

        const rendered = await renderSplitParts(mesh, plan, jobDir);

        const result: SplitResult = {
          mode: plan.mode,
          axis: plan.axis,
          parts: rendered.map((r) => ({ index: r.index, label: r.label, url: `/generated/${jobId}/${path.basename(r.stlPath)}`, w: r.w, d: r.d, h: r.h })),
          connector: {
            type: "push-fit",
            pegDiameter: plan.connector.pegDiameter,
            socketDiameter: plan.connector.socketDiameter,
            clearance: plan.connector.clearance,
            pegLength: plan.connector.pegLength,
            count: plan.connector.positions.length,
          },
          reason: plan.reason,
          guide: plan.guide,
          wholeUrl: meshUrl,
        };
        send({ t: ts(), kind: "tool", name: "export", status: "done", detail: `${rendered.length} parts ready — ${result.connector.count} push-fit peg(s) per seam` });
        send({ t: ts(), kind: "split", result });
        send({ t: ts(), kind: "summary", text: plan.guide });
      } catch (err) {
        send({ t: ts(), kind: "tool", name: "export", status: "error", detail: (err as Error).message.slice(0, 120) });
        send({ t: ts(), kind: "summary", text: "couldn't split this model into parts — try preparing it for print first" });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
