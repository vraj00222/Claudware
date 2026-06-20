import type { ModelResult } from "./types";
import { mergeResults } from "./merge";
import { SOURCES } from "./sources";
import { fallbackSearch } from "./fallback";

/** Fan out across all sources IN PARALLEL; a failing/slow source is dropped, the rest still return.
 *  Always-importable library matches (verified direct STLs) are surfaced FIRST so "Use this" has working
 *  options even when live repos gate their downloads; live web results follow for breadth. */
export async function browserbaseSearch(query: string, limit = 12): Promise<ModelResult[]> {
  const [settled, curated] = await Promise.all([
    Promise.allSettled(SOURCES.map((s) => s.run(query))),
    fallbackSearch(query, 4),
  ]);
  const live = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
  return mergeResults([curated, ...live], limit);
}
