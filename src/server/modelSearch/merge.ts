import type { ModelResult } from "./types";

/** Flatten per-source result lists preserving source order (priority), dedupe by sourceUrl, cap. */
export function mergeResults(perSource: ModelResult[][], limit = 12): ModelResult[] {
  const seen = new Set<string>();
  const out: ModelResult[] = [];
  for (const list of perSource) {
    for (const m of list) {
      const key = m.sourceUrl || m.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(m);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
