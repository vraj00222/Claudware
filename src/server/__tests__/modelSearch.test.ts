import { describe, it, expect } from "vitest";
import { mergeResults } from "@/server/modelSearch/merge";
import { fallbackSearch } from "@/server/modelSearch/fallback";
import type { ModelResult } from "@/server/modelSearch/types";

const r = (id: string, site: ModelResult["sourceSite"], url: string): ModelResult => ({
  id, title: id, author: "a", license: "CC-BY", sourceSite: site, sourceUrl: url, thumbUrl: "",
});

describe("mergeResults", () => {
  it("flattens by source priority, dedupes by sourceUrl, caps at limit", () => {
    const out = mergeResults([
      [r("p1", "printables", "u1"), r("p2", "printables", "u2")],
      [r("t1", "thangs", "u1"), r("t2", "thangs", "u3")], // u1 dupes p1 → dropped
    ], 3);
    expect(out.map((x) => x.id)).toEqual(["p1", "p2", "t2"]);
  });
});

describe("fallbackSearch (zero-key library)", () => {
  it("keyword-matches the importable library", async () => {
    const hits = await fallbackSearch("benchy bracket");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].sourceSite).toBe("curated");
    expect(hits[0].stlUrl).toBeTruthy(); // every library entry is directly importable
  });
  it("returns [] for nonsense", async () => {
    expect(await fallbackSearch("zzqqxx")).toEqual([]);
  });
});
