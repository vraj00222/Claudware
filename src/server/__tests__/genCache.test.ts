import { describe, it, expect, beforeEach } from "vitest";
import { __resetMemoryStores } from "../redis";
import {
  normalizePrompt, exactKey, embed, EMBED_DIM,
  getExact, putGeneration, findSimilar, SEMANTIC_THRESHOLD,
  type GenCacheRequest, type CachedGeneration,
} from "../genCache";

function cosine(a: number[], b: number[]): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) d += a[i] * b[i];
  return d; // both vectors are L2-normalized
}

const mk = (over: Partial<CachedGeneration> = {}): CachedGeneration => ({
  prompt: "phone stand",
  engine: "openscad",
  source: "claude",
  summaryText: "model ready",
  mesh: { url: "/generated/abc/stage2.stl", label: "model" },
  createdAt: Date.now(),
  ...over,
});

describe("genCache", () => {
  beforeEach(() => __resetMemoryStores());

  it("normalizes prompts", () => {
    expect(normalizePrompt("  A Phone-STAND!! ")).toBe("a phone stand");
  });

  it("derives a deterministic exact key that varies by request shape", () => {
    const base: GenCacheRequest = { prompt: "phone stand", engine: "auto" };
    expect(exactKey(base)).toBe(exactKey({ ...base }));
    expect(exactKey(base)).not.toBe(exactKey({ ...base, engine: "blender" }));
    expect(exactKey(base)).not.toBe(exactKey({ ...base, sizeMm: 200 }));
  });

  it("produces normalized embeddings of the right size", () => {
    const v = embed("a chubby dragon");
    expect(v).toHaveLength(EMBED_DIM);
    expect(cosine(v, v)).toBeCloseTo(1, 5);
  });

  it("scores rephrasings high and different objects low", () => {
    const stand = embed("phone stand");
    expect(cosine(stand, embed("a stand for my phone"))).toBeGreaterThan(SEMANTIC_THRESHOLD);
    expect(cosine(stand, embed("a keychain with my name"))).toBeLessThan(0.3);
  });

  it("round-trips an exact cache entry", async () => {
    const req: GenCacheRequest = { prompt: "phone stand", engine: "auto" };
    expect(await getExact(req)).toBeNull();
    await putGeneration(req, mk());
    const got = await getExact(req);
    expect(got?.summaryText).toBe("model ready");
    expect(got?.mesh.url).toBe("/generated/abc/stage2.stl");
  });

  it("finds a semantically-similar prior generation and ignores unrelated prompts", async () => {
    const req: GenCacheRequest = { prompt: "phone stand", engine: "auto" };
    await putGeneration(req, mk());
    const hit = await findSimilar("a stand for my phone");
    expect(hit).not.toBeNull();
    expect(hit!.score).toBeGreaterThanOrEqual(SEMANTIC_THRESHOLD);
    expect(hit!.result.summaryText).toBe("model ready");
    expect(await findSimilar("a keychain with my name")).toBeNull();
  });
});
