/**
 * Generation cache + semantic VECTOR SEARCH — "reuse before regenerate" (sponsor: Redis).
 *
 * The most expensive thing this app does is turn a prompt into a printable model (a Claude call +
 * 60s of OpenSCAD/Blender/NVIDIA work). This caches the finished result in Redis keyed two ways:
 *
 *   1. EXACT   — a hash of {prompt, engine, size, …}. Same request twice → instant, 0 Claude tokens.
 *   2. SEMANTIC — a vector embedding of the prompt indexed in Redis. A *different* phrasing of the
 *      same idea ("a stand for my phone" ≈ "phone stand") is found by cosine KNN and reused.
 *
 * This is Redis "beyond caching": vector search + context retrieval driving the agent's reuse policy.
 * All Redis-backed, all key-gated with an in-memory fallback (see redis.ts) — never throws.
 */

import { createHash } from "node:crypto";
import { rGet, rSet, rVectorUpsert, rVectorKnn, type VectorHit } from "./redis";

const TTL_SEC = 7 * 24 * 3600; // a week — plenty for a demo / hackathon weekend
const GEN_PREFIX = "cw:gen:";
export const EMBED_DIM = 256;
/** Cosine ≥ this auto-serves a semantically-similar prior generation. With the keyword-weighted
 *  embedding below, genuine rephrasings/reorderings ("a stand for my phone" ≈ "a simple phone stand")
 *  score ~0.78–1.0 while different objects sharing a noun (phone stand vs phone case) stay ≤0.51 — so
 *  this sits in the wide gap between them. */
export const SEMANTIC_THRESHOLD = 0.65;

export interface GenCacheRequest {
  prompt: string;
  engine: string;
  sizeMm?: number;
  base?: string;
  refImageUrl?: string;
  cleanInBlender?: boolean;
}

/** The replayable result of a finished build (mirrors the tail AgentEvents). */
export interface CachedGeneration {
  prompt: string;
  engine: "openscad" | "blender" | "fusion" | "nvidia" | "imported";
  source?: string;
  summaryText: string;
  mesh: { url: string; glbUrl?: string; textured?: boolean; label: string };
  durableMeshUrl?: string;
  estimate?: { grams: number; minutes: number; layers: number; material: string };
  parts?: { name: string; meshUrl: string }[];
  createdAt: number;
}

// ───────────────────────── normalization + keys ─────────────────────────
export function normalizePrompt(p: string): string {
  return p.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

export function exactKey(req: GenCacheRequest): string {
  const canon = JSON.stringify({
    p: normalizePrompt(req.prompt),
    e: req.engine || "auto",
    s: req.sizeMm ?? 0,
    b: (req.base ?? "").trim(),
    r: (req.refImageUrl ?? "").trim(),
    c: Boolean(req.cleanInBlender),
  });
  return GEN_PREFIX + createHash("sha256").update(canon).digest("hex").slice(0, 24);
}

// ───────────────────────── lexical embedding (no extra API needed) ─────────────────────────
// A deterministic bag-of-features hash embedding: whole tokens + character trigrams (so near-spellings
// and word-order changes still land close). L2-normalized → cosine ∈ [0,1]. Good enough to catch
// "phone stand" ≈ "a stand for my phone" without standing up a separate embeddings provider.
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function embed(text: string): number[] {
  const v = new Array<number>(EMBED_DIM).fill(0);
  const norm = normalizePrompt(text);
  const tokens = norm.split(" ").filter(Boolean);
  const stop = new Set(["a", "an", "the", "of", "for", "to", "my", "me", "with", "and", "in", "on", "it", "that", "this"]);
  for (const tok of tokens) {
    if (!stop.has(tok)) v[hashStr("t:" + tok) % EMBED_DIM] += 4; // whole-word identity dominates trigram noise
    const padded = `#${tok}#`;
    for (let i = 0; i + 3 <= padded.length; i++) v[hashStr("g:" + padded.slice(i, i + 3)) % EMBED_DIM] += 1;
  }
  let mag = 0;
  for (const x of v) mag += x * x;
  mag = Math.sqrt(mag) || 1;
  return v.map((x) => x / mag);
}

// ───────────────────────── public API ─────────────────────────
/** Exact cache lookup. Returns the replayable result or null. */
export async function getExact(req: GenCacheRequest): Promise<CachedGeneration | null> {
  const raw = await rGet(exactKey(req));
  if (!raw) return null;
  try { return JSON.parse(raw) as CachedGeneration; } catch { return null; }
}

export interface SemanticMatch { score: number; matchedPrompt: string; result: CachedGeneration }

/** Semantic lookup: nearest prior generation by cosine. Returns the best match ≥ threshold (or null). */
export async function findSimilar(prompt: string, threshold = SEMANTIC_THRESHOLD): Promise<SemanticMatch | null> {
  const hits: VectorHit[] = await rVectorKnn(embed(prompt), 3);
  for (const h of hits) {
    if (h.score < threshold) break;
    const raw = await rGet(h.meta.key);
    if (!raw) continue;
    try {
      const result = JSON.parse(raw) as CachedGeneration;
      return { score: h.score, matchedPrompt: h.meta.prompt || result.prompt, result };
    } catch { /* try next */ }
  }
  return null;
}

/** Persist a finished generation under both the exact key and the semantic vector index. */
export async function putGeneration(req: GenCacheRequest, result: CachedGeneration): Promise<void> {
  // Only the EXACT-match key is request-shape-sensitive; the semantic index is prompt-only so any
  // phrasing of the same idea can find it. Edits / reference-image jobs are not indexed (caller-gated).
  const key = exactKey(req);
  await rSet(key, JSON.stringify(result), TTL_SEC);
  await rVectorUpsert(key, embed(req.prompt), {
    prompt: normalizePrompt(req.prompt),
    engine: result.engine,
    key,
  });
}
