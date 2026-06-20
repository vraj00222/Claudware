import { estimateFromTris } from "@/server/openscad";
import { buildPrintPlanFromTris, parseStlAuto, DEFAULT_BED } from "@/server/printPlan";
import { uploadFinalStl } from "@/server/storage";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { AgentEvent } from "@/lib/agentEvent";
import type { ModelResult } from "@/server/modelSearch/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PUBLIC = path.join(process.cwd(), "public", "generated");

/** Download the STL bytes. Direct fetch (repo CDN links are public); times out. */
async function downloadStl(url: string, timeoutMs = 20_000): Promise<Buffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) throw new Error(`download ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally { clearTimeout(t); }
}

export async function POST(req: Request) {
  const { result } = (await req.json().catch(() => ({}))) as { result?: ModelResult };
  const jobId = `imp_${Date.now().toString(36)}`;
  const jobDir = path.join(PUBLIC, jobId);
  const t0 = Date.now();
  const ts = () => { const s = Math.floor((Date.now() - t0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: AgentEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        const stlSrc = result?.stlUrl;
        if (!stlSrc) throw new Error("no direct STL — open on the source site to download");
        send({ t: ts(), kind: "plan", text: `Importing “${(result?.title || "model").slice(0, 60)}” from ${result?.sourceSite}…` });
        send({ t: ts(), kind: "tool", name: "generate_mesh", status: "running", detail: "fetching the model file…" });
        await mkdir(jobDir, { recursive: true });

        const buf = await downloadStl(stlSrc);
        const stlPath = path.join(jobDir, "model.stl");
        await writeFile(stlPath, buf);
        const meshUrl = `/generated/${jobId}/model.stl`;
        send({ t: ts(), kind: "tool", name: "generate_mesh", status: "done", detail: `${(buf.length / 1024).toFixed(0)} KB` });
        send({ t: ts(), kind: "mesh", url: meshUrl, label: "imported model", stage: 1, totalStages: 1 });

        const tris = parseStlAuto(buf);
        send({ t: ts(), kind: "tool", name: "validate", status: tris.length ? "done" : "warn", detail: tris.length ? `${tris.length} triangles` : "could not analyze mesh" });
        if (tris.length) {
          try { const est = estimateFromTris(tris); send({ t: ts(), kind: "estimate", grams: est.grams, minutes: est.minutes, layers: est.layers, material: est.material }); } catch { /* best-effort */ }
        }
        const durableUrl = await uploadFinalStl(jobId, stlPath);
        if (tris.length) {
          try { send({ t: ts(), kind: "printplan", plan: buildPrintPlanFromTris(tris, DEFAULT_BED, { stlUrl: meshUrl, storageUrl: durableUrl }) }); } catch { /* best-effort */ }
        }
        send({ t: ts(), kind: "summary", text: `${result?.title} — imported from ${result?.sourceSite}`, engine: "imported", meshUrl: durableUrl });
      } catch (err) {
        send({ t: ts(), kind: "tool", name: "generate_mesh", status: "error", detail: (err as Error).message.slice(0, 120) });
        send({ t: ts(), kind: "summary", text: "couldn't import this one — try another result or design it instead" });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
