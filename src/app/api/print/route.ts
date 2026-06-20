/**
 * POST /api/print — Send a model directly to the Bambu A1 printer.
 *
 * Body: { meshUrl: string, modelName?: string }
 *   meshUrl   = the /generated/… path or storage URL of the finished mesh (STL or 3MF)
 *   modelName = human label for the print job (defaults to "model")
 *
 * Flow:
 *   1. Read the mesh file
 *   2. If STL → parse tris → auto-recipe → build 3MF with embedded settings
 *   3. Upload 3MF to printer via FTPS + start print via MQTT
 *   4. Stream progress events back to the client
 */
import { parseStlAuto } from "@/server/printPlan";
import { trisTo3mf } from "@/server/printReady/exportFormats";
import { buildPrintRecipe } from "@/server/printReady/recipe";
import { BAMBU_A1 } from "@/server/printReady/bed";
import { bambuConfigured, bambuReachable, sendToPrinter } from "@/server/bambuPrint";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AgentEvent } from "@/lib/agentEvent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function POST(req: Request) {
  const { meshUrl, modelName = "model" } = (await req.json().catch(() => ({}))) as { meshUrl?: string; modelName?: string };
  const t0 = Date.now();
  const ts = () => { const s = Math.floor((Date.now() - t0) / 1000); return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: AgentEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (!meshUrl) throw new Error("missing mesh URL");

        // Check printer config
        send({ t: ts(), kind: "tool", name: "send_to_printer", status: "running", detail: "checking Bambu printer connection…" });
        if (!bambuConfigured()) {
          throw new Error("Bambu printer not configured — set BAMBU_PRINTER_IP, BAMBU_ACCESS_CODE, BAMBU_SERIAL in .env.local");
        }

        const reachable = await bambuReachable();
        if (!reachable) {
          throw new Error("Bambu printer not reachable on the network — is it powered on and on the same WiFi?");
        }
        send({ t: ts(), kind: "tool", name: "send_to_printer", status: "done", detail: "printer online" });

        // Read the mesh
        send({ t: ts(), kind: "tool", name: "send_to_printer", status: "running", detail: "reading model…" });
        const meshData = await readMesh(meshUrl);
        if (!meshData.length) throw new Error("empty mesh file");

        // If it's an STL, convert to 3MF with auto recipe
        let printData: Buffer;
        let recipeSummary: string;
        const isStl = meshUrl.toLowerCase().endsWith(".stl") || !meshUrl.toLowerCase().endsWith(".3mf");
        if (isStl) {
          send({ t: ts(), kind: "tool", name: "send_to_printer", status: "running", detail: "building print recipe…" });
          const tris = parseStlAuto(meshData);
          if (!tris.length) throw new Error("couldn't parse the mesh");
          const recipe = buildPrintRecipe(tris, BAMBU_A1);
          printData = trisTo3mf(tris, recipe);
          recipeSummary = `${recipe.modelClass} · ${recipe.layerHeight}mm · ${recipe.infillPercent}% · ${recipe.supportStyle} supports · ~${recipe.estimateMinutes}min`;
          send({ t: ts(), kind: "tool", name: "send_to_printer", status: "done", detail: recipeSummary });
        } else {
          printData = meshData;
          recipeSummary = "pre-configured 3MF";
        }

        // Upload + print
        send({ t: ts(), kind: "tool", name: "send_to_printer", status: "running", detail: "uploading to printer…" });
        const result = await sendToPrinter(printData, modelName, 60_000);
        send({ t: ts(), kind: "tool", name: "send_to_printer", status: "done", detail: `sent to Bambu A1 as ${result.filename}` });

        send({ t: ts(), kind: "summary", text: `Print started on your Bambu A1. ${recipeSummary}. The printer will heat up and begin — watch the build plate.` });
      } catch (err) {
        send({ t: ts(), kind: "tool", name: "send_to_printer", status: "error", detail: (err as Error).message.slice(0, 120) });
        send({ t: ts(), kind: "summary", text: `Couldn't send to printer: ${(err as Error).message.slice(0, 200)}` });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
