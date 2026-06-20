import type { ModelResult } from "@/server/modelSearch/types";
import type { Player } from "./mockStream";

export type SearchEvent =
  | { kind: "result"; model: ModelResult }
  | { kind: "searchdone"; count: number }
  | { kind: "searcherror"; message: string };

/** POST a query to /api/search and stream SearchEvents back. Returns a Player whose cancel() aborts. */
export function playSearchStream(query: string, onEvent: (e: SearchEvent) => void): Player {
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await fetch("/api/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }), signal: ctrl.signal,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
          const data = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!data) continue;
          try { onEvent(JSON.parse(data.slice(5).trim()) as SearchEvent); } catch { /* skip */ }
        }
      }
    } catch { /* aborted */ }
  })();
  return { cancel() { ctrl.abort(); } };
}
