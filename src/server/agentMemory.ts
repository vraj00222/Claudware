/**
 * Agent memory + live counters (sponsor: Redis).
 *
 * Every generation is recorded as a "turn" in Redis — a per-session list (the agent's short-term
 * memory of what this user has been building) plus a global recent feed for the landing/demo. Live
 * counters (generations, cache hits, semantic reuses, tokens saved) live in a Redis hash so the
 * /api/redis route and the demo can show Redis working in real time.
 *
 * Key-gated with an in-memory fallback (see redis.ts) — never throws.
 */

import { rLPushCapped, rLRange, rHIncrBy, rHGetAll } from "./redis";

const STATS_KEY = "cw:stats";
const GLOBAL_MEM = "cw:mem:global";
const SESSION_CAP = 50;
const GLOBAL_CAP = 100;

export interface MemoryTurn {
  prompt: string;
  engine: string;
  meshUrl?: string;
  served: "fresh" | "exact-cache" | "semantic-cache";
  ts: number;
}

function sessionKey(sessionId: string): string {
  return `cw:mem:${sessionId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anon"}`;
}

/** Record one generation turn into the session + global memory. */
export async function recordTurn(sessionId: string | undefined, turn: MemoryTurn): Promise<void> {
  const payload = JSON.stringify(turn);
  if (sessionId) await rLPushCapped(sessionKey(sessionId), payload, SESSION_CAP);
  await rLPushCapped(GLOBAL_MEM, payload, GLOBAL_CAP);
}

/** Most-recent turns for a session (newest first). */
export async function recentTurns(sessionId: string | undefined, n = 10): Promise<MemoryTurn[]> {
  const key = sessionId ? sessionKey(sessionId) : GLOBAL_MEM;
  const raw = await rLRange(key, n);
  return raw.map((r) => { try { return JSON.parse(r) as MemoryTurn; } catch { return null; } }).filter((t): t is MemoryTurn => t !== null);
}

export type StatField = "generations" | "cacheHits" | "semanticHits" | "cacheMisses" | "tokensSaved";

export async function bumpStat(field: StatField, by = 1): Promise<void> {
  await rHIncrBy(STATS_KEY, field, by);
}

export interface AgentStats {
  generations: number;
  cacheHits: number;
  semanticHits: number;
  cacheMisses: number;
  tokensSaved: number;
}

export async function getStats(): Promise<AgentStats> {
  const h = await rHGetAll(STATS_KEY);
  const num = (k: StatField) => parseInt(h[k] ?? "0", 10) || 0;
  return {
    generations: num("generations"),
    cacheHits: num("cacheHits"),
    semanticHits: num("semanticHits"),
    cacheMisses: num("cacheMisses"),
    tokensSaved: num("tokensSaved"),
  };
}
