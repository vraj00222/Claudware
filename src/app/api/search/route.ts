import { pickModelSearch } from "@/server/modelSearch";
import type { ModelResult } from "@/server/modelSearch/types";
import { Sentry, incrementMetric, captureError } from "@/server/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchEvent =
  | { kind: "result"; model: ModelResult }
  | { kind: "searchdone"; count: number }
  | { kind: "searcherror"; message: string };

export async function POST(req: Request) {
  const { query = "" } = (await req.json().catch(() => ({}))) as { query?: string };
  const provider = pickModelSearch();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: SearchEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        const results = await provider.search(query.trim(), 12);
        for (const model of results) send({ kind: "result", model });
        send({ kind: "searchdone", count: results.length });
        incrementMetric("search.completed", 1, { results: String(results.length) });
        Sentry.logger.info("Model search completed", { query: query.trim().slice(0, 80), results: results.length });
      } catch (err) {
        captureError(err, { query });
        send({ kind: "searcherror", message: (err as Error).message.slice(0, 120) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
