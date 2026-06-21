import { describe, it, expect, beforeEach } from "vitest";
import { __resetMemoryStores } from "../redis";
import { recordTurn, recentTurns, bumpStat, getStats, type MemoryTurn } from "../agentMemory";

const turn = (prompt: string): MemoryTurn => ({ prompt, engine: "openscad", served: "fresh", ts: Date.now() });

describe("agentMemory", () => {
  beforeEach(() => __resetMemoryStores());

  it("starts at zero and increments stats", async () => {
    expect(await getStats()).toEqual({ generations: 0, cacheHits: 0, semanticHits: 0, cacheMisses: 0, tokensSaved: 0 });
    await bumpStat("generations");
    await bumpStat("cacheHits", 2);
    await bumpStat("tokensSaved", 12000);
    const s = await getStats();
    expect(s.generations).toBe(1);
    expect(s.cacheHits).toBe(2);
    expect(s.tokensSaved).toBe(12000);
  });

  it("records per-session turns newest-first and isolates sessions", async () => {
    await recordTurn("sess-1", turn("first"));
    await recordTurn("sess-1", turn("second"));
    await recordTurn("sess-2", turn("other"));
    const s1 = await recentTurns("sess-1", 10);
    expect(s1.map((t) => t.prompt)).toEqual(["second", "first"]);
    const s2 = await recentTurns("sess-2", 10);
    expect(s2.map((t) => t.prompt)).toEqual(["other"]);
  });

  it("mirrors every turn into the global feed", async () => {
    await recordTurn("sess-1", turn("alpha"));
    await recordTurn(undefined, turn("beta"));
    const global = await recentTurns(undefined, 10);
    expect(global.map((t) => t.prompt)).toEqual(["beta", "alpha"]);
  });
});
