import { NextResponse } from "next/server";
import { redisStatus } from "@/server/redis";
import { getStats, recentTurns } from "@/server/agentMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Redis health + live stats (sponsor visibility / demo). Shows the connection, the vector engine in
 * use, the cache/reuse counters, and the most recent generations the agent remembers. Works with zero
 * keys too — it just reports the in-memory fallback.
 */
export async function GET() {
  const [status, stats, recent] = await Promise.all([
    redisStatus(),
    getStats(),
    recentTurns(undefined, 10),
  ]);
  const totalLookups = stats.cacheHits + stats.semanticHits + stats.cacheMisses;
  const reuseRate = totalLookups ? Math.round(((stats.cacheHits + stats.semanticHits) / totalLookups) * 100) : 0;
  return NextResponse.json({ status, stats: { ...stats, reuseRate }, recent });
}
