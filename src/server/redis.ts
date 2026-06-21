/**
 * Redis — the realtime/state + memory + cache backbone (sponsor: Redis).
 *
 * Key-gated adapter, exactly like every other external service in this app (see ARCHITECTURE.md
 * "Integration layer"): when REDIS_URL is set we talk to a real Redis (Redis Cloud / OSS / Stack),
 * otherwise everything transparently falls back to an in-process store so the app still boots and
 * demos with ZERO keys. NOTHING in here ever throws — a Redis hiccup must never break a generation.
 *
 * Used for (Redis "beyond caching"):
 *  - genCache.ts   — a semantic generation cache + VECTOR SEARCH (reuse-before-regenerate).
 *  - agentMemory.ts — per-session agent memory + live counters.
 *
 * The public surface is a tiny async KV / hash / list / vector API; callers never see the client.
 */

import { createClient, type RedisClientType } from "redis";

// Tolerate a pasted `redis-cli -u redis://…` command (or surrounding whitespace) — pull the URL out.
const RAW_URL = (process.env.REDIS_URL?.match(/rediss?:\/\/\S+/) ?? [])[0];
/** True only when a real, well-formed connection URL is present — a bare token/password does NOT count. */
export const redisConfigured = Boolean(RAW_URL);

export type RedisBackend = "redis" | "memory";

// ───────────────────────── connection (lazy, self-healing, never throws) ─────────────────────────
let client: RedisClientType | undefined;
let connectOnce: Promise<RedisClientType | undefined> | undefined;
let connected = false;
/** undefined = not probed yet; otherwise the native vector engine this Redis offers. */
let vectorEngine: "vectorset" | "brute-force" | undefined;

async function connect(): Promise<RedisClientType | undefined> {
  if (!redisConfigured) return undefined;
  if (client && connected) return client;
  if (connectOnce) return connectOnce;
  connectOnce = (async () => {
    try {
      const c: RedisClientType = createClient({
        url: RAW_URL,
        socket: { connectTimeout: 8_000, reconnectStrategy: (n) => (n > 5 ? false : Math.min(n * 200, 1500)) },
      });
      c.on("error", (e) => {
        // Surface once; the reconnect strategy + per-call fallback handle the rest. Don't spam.
        if (connected) console.warn(`[redis] ${(e as Error).message?.slice(0, 120)}`);
        connected = false;
      });
      c.on("ready", () => { connected = true; });
      await c.connect();
      connected = true;
      client = c;
      await probeVector(c);
      console.log(`[redis] connected (vector engine: ${vectorEngine})`);
      return c;
    } catch (e) {
      console.warn(`[redis] connect failed → in-memory fallback: ${(e as Error).message?.slice(0, 120)}`);
      connected = false;
      client = undefined;
      return undefined;
    } finally {
      connectOnce = undefined;
    }
  })();
  return connectOnce;
}

async function probeVector(c: RedisClientType): Promise<void> {
  try {
    const mods = (await c.sendCommand(["MODULE", "LIST"])) as unknown[];
    const flat = JSON.stringify(mods).toLowerCase();
    // Redis 8 native Vector Sets (VADD/VSIM) — the modern Redis vector-search primitive.
    vectorEngine = flat.includes("vectorset") ? "vectorset" : "brute-force";
  } catch {
    vectorEngine = "brute-force";
  }
}

/** Status for the /api/redis health route + demo chips. Connects on first call. */
export async function redisStatus(): Promise<{ configured: boolean; connected: boolean; backend: RedisBackend; vectorEngine: "vectorset" | "brute-force" }> {
  if (redisConfigured) await connect();
  const live = Boolean(client && connected);
  return {
    configured: redisConfigured,
    connected: live,
    backend: live ? "redis" : "memory",
    vectorEngine: live ? (vectorEngine ?? "brute-force") : "brute-force",
  };
}

// ───────────────────────── in-memory fallback stores ─────────────────────────
const memKV = new Map<string, { v: string; exp?: number }>();
const memHash = new Map<string, Map<string, string>>();
const memList = new Map<string, string[]>();

function memAlive(rec: { exp?: number } | undefined): boolean {
  if (!rec) return false;
  if (rec.exp && rec.exp < Date.now()) return false;
  return true;
}

// ───────────────────────── KV ─────────────────────────
export async function rGet(key: string): Promise<string | null> {
  const c = await connect();
  if (c) { try { return await c.get(key); } catch { /* fall through */ } }
  const rec = memKV.get(key);
  if (!memAlive(rec)) { memKV.delete(key); return null; }
  return rec!.v;
}

export async function rSet(key: string, value: string, ttlSec?: number): Promise<void> {
  const c = await connect();
  if (c) { try { await c.set(key, value, ttlSec ? { EX: ttlSec } : undefined); return; } catch { /* fall through */ } }
  memKV.set(key, { v: value, exp: ttlSec ? Date.now() + ttlSec * 1000 : undefined });
}

export async function rDel(key: string): Promise<void> {
  const c = await connect();
  if (c) { try { await c.del(key); return; } catch { /* fall through */ } }
  memKV.delete(key); memHash.delete(key); memList.delete(key);
}

// ───────────────────────── hashes (counters) ─────────────────────────
export async function rHIncrBy(key: string, field: string, by: number): Promise<number> {
  const c = await connect();
  if (c) { try { return await c.hIncrBy(key, field, by); } catch { /* fall through */ } }
  const h = memHash.get(key) ?? new Map<string, string>();
  const next = (parseInt(h.get(field) ?? "0", 10) || 0) + by;
  h.set(field, String(next)); memHash.set(key, h);
  return next;
}

export async function rHGetAll(key: string): Promise<Record<string, string>> {
  const c = await connect();
  if (c) { try { return (await c.hGetAll(key)) as Record<string, string>; } catch { /* fall through */ } }
  const h = memHash.get(key);
  return h ? Object.fromEntries(h) : {};
}

export async function rHSet(key: string, field: string, value: string): Promise<void> {
  const c = await connect();
  if (c) { try { await c.hSet(key, field, value); return; } catch { /* fall through */ } }
  const h = memHash.get(key) ?? new Map<string, string>();
  h.set(field, value); memHash.set(key, h);
}

// ───────────────────────── lists (recent memory) ─────────────────────────
export async function rLPushCapped(key: string, value: string, cap: number): Promise<void> {
  const c = await connect();
  if (c) {
    try { await c.lPush(key, value); await c.lTrim(key, 0, cap - 1); return; } catch { /* fall through */ }
  }
  const l = memList.get(key) ?? [];
  l.unshift(value);
  memList.set(key, l.slice(0, cap));
}

export async function rLRange(key: string, n: number): Promise<string[]> {
  const c = await connect();
  if (c) { try { return await c.lRange(key, 0, n - 1); } catch { /* fall through */ } }
  return (memList.get(key) ?? []).slice(0, n);
}

// ───────────────────────── vector search ─────────────────────────
// Native path: Redis 8 Vector Sets (VADD/VSIM) — a first-class Redis vector-search data type, COSINE
// similarity in the engine. Fallback path (older Redis / in-memory): the SAME vectors are stored and
// KNN is computed client-side. Either way every vector lives in Redis. Never throws.

const VEC_SET = "cw:vset"; // native Vector Set
const VEC_STORE = "cw:vecstore"; // fallback HASH: id -> JSON{v,meta}

export interface VectorMeta { prompt: string; engine: string; key: string }
export interface VectorHit { id: string; score: number; meta: VectorMeta }

/** Insert a vector + its metadata. Re-adding the same id is a no-op (deterministic embedding). Never throws. */
export async function rVectorUpsert(id: string, vec: number[], meta: VectorMeta): Promise<void> {
  const c = await connect();
  if (c) {
    try {
      if (vectorEngine === "vectorset") {
        await c.sendCommand(["VADD", VEC_SET, "VALUES", String(vec.length), ...vec.map(String), id]);
        await c.sendCommand(["VSETATTR", VEC_SET, id, JSON.stringify({ prompt: meta.prompt, engine: meta.engine })]);
        return;
      }
      await c.hSet(VEC_STORE, id, JSON.stringify({ v: vec, meta }));
      return;
    } catch { /* fall through to memory */ }
  }
  const h = memHash.get(VEC_STORE) ?? new Map<string, string>();
  h.set(id, JSON.stringify({ v: vec, meta })); memHash.set(VEC_STORE, h);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** K-nearest by cosine similarity (1 = identical). Returns [] on any failure. */
export async function rVectorKnn(vec: number[], k: number): Promise<VectorHit[]> {
  const c = await connect();
  if (c) {
    try {
      if (vectorEngine === "vectorset") {
        const reply = await c.sendCommand([
          "VSIM", VEC_SET, "VALUES", String(vec.length), ...vec.map(String), "WITHSCORES", "COUNT", String(k),
        ]);
        return await resolveVsim(c, reply);
      }
      const all = (await c.hGetAll(VEC_STORE)) as Record<string, string>;
      return bruteForce(all, vec, k);
    } catch { /* fall through to memory */ }
  }
  const h = memHash.get(VEC_STORE);
  const all = h ? Object.fromEntries(h) : {};
  return bruteForce(all, vec, k);
}

function bruteForce(all: Record<string, string>, vec: number[], k: number): VectorHit[] {
  const hits: VectorHit[] = [];
  for (const [id, raw] of Object.entries(all)) {
    try {
      const { v, meta } = JSON.parse(raw) as { v: number[]; meta: VectorMeta };
      hits.push({ id, score: cosine(vec, v), meta });
    } catch { /* skip bad record */ }
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, k);
}

/** VSIM WITHSCORES replies as a RESP3 map {id: score} or a RESP2 flat array [id, score, …]. */
function vsimPairs(reply: unknown): [string, number][] {
  if (reply && typeof reply === "object" && !Array.isArray(reply)) {
    if (reply instanceof Map) return [...reply.entries()].map(([k, v]) => [String(k), Number(v)]);
    return Object.entries(reply as Record<string, unknown>).map(([k, v]) => [k, Number(v)]);
  }
  const out: [string, number][] = [];
  if (Array.isArray(reply)) for (let i = 0; i + 1 < reply.length; i += 2) out.push([String(reply[i]), Number(reply[i + 1])]);
  return out;
}

async function resolveVsim(c: RedisClientType, reply: unknown): Promise<VectorHit[]> {
  const pairs = vsimPairs(reply);
  const hits: VectorHit[] = [];
  for (const [id, vsimScore] of pairs) {
    // Redis Vector Sets report similarity as (1 + cosine) / 2 ∈ [0,1]. Map it back to raw cosine so
    // VectorHit.score has the SAME meaning here as in the brute-force/in-memory path (and callers'
    // thresholds work identically regardless of which Redis backend served the query).
    const score = 2 * vsimScore - 1;
    let meta: VectorMeta = { prompt: "", engine: "", key: id };
    try {
      const attr = (await c.sendCommand(["VGETATTR", VEC_SET, id])) as string | null;
      if (attr) { const a = JSON.parse(attr) as { prompt?: string; engine?: string }; meta = { prompt: a.prompt ?? "", engine: a.engine ?? "", key: id }; }
    } catch { /* attribute optional */ }
    hits.push({ id, score, meta });
  }
  return hits;
}

/** Test-only: clear the in-memory fallback stores between tests. */
export function __resetMemoryStores(): void {
  memKV.clear(); memHash.clear(); memList.clear();
}
