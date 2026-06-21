import { describe, it, expect, beforeEach } from "vitest";
import {
  redisConfigured, redisStatus, __resetMemoryStores,
  rGet, rSet, rDel, rHIncrBy, rHGetAll, rLPushCapped, rLRange,
  rVectorUpsert, rVectorKnn,
} from "../redis";

// REDIS_URL is deleted in test setup → the adapter runs entirely on its in-memory fallback here.
describe("redis adapter (in-memory fallback)", () => {
  beforeEach(() => __resetMemoryStores());

  it("reports not-configured / memory backend without a URL", async () => {
    expect(redisConfigured).toBe(false);
    const s = await redisStatus();
    expect(s).toMatchObject({ configured: false, connected: false, backend: "memory" });
  });

  it("round-trips KV values and deletes them", async () => {
    await rSet("k1", "hello");
    expect(await rGet("k1")).toBe("hello");
    await rDel("k1");
    expect(await rGet("k1")).toBeNull();
  });

  it("expires KV values past their TTL", async () => {
    await rSet("k2", "soon", -1); // already expired
    expect(await rGet("k2")).toBeNull();
  });

  it("increments hash counters", async () => {
    expect(await rHIncrBy("h", "n", 1)).toBe(1);
    expect(await rHIncrBy("h", "n", 4)).toBe(5);
    expect((await rHGetAll("h")).n).toBe("5");
  });

  it("keeps a capped, newest-first list", async () => {
    for (const v of ["a", "b", "c", "d"]) await rLPushCapped("L", v, 3);
    expect(await rLRange("L", 10)).toEqual(["d", "c", "b"]);
  });

  it("returns nearest vectors first by cosine similarity", async () => {
    await rVectorUpsert("id-x", [1, 0, 0], { prompt: "x", engine: "openscad", key: "id-x" });
    await rVectorUpsert("id-y", [0, 1, 0], { prompt: "y", engine: "openscad", key: "id-y" });
    const hits = await rVectorKnn([0.95, 0.05, 0], 2);
    expect(hits[0].id).toBe("id-x");
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
    expect(hits[0].score).toBeGreaterThan(0.9);
    expect(hits[0].meta.prompt).toBe("x");
  });
});
