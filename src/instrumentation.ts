/**
 * Next.js Instrumentation Hook — Arize AX Tracing (sponsor: Arize).
 *
 * Next.js calls `register()` once on server startup (before any route handler runs).
 * We use it to initialise OpenTelemetry and the Anthropic auto-instrumentor so every
 * Claude call is traced to Arize AX automatically. Manual CHAIN/TOOL spans are added
 * in the generation pipeline (see src/server/tracing.ts).
 *
 * Key-gated: when ARIZE_SPACE_ID + ARIZE_API_KEY are missing, tracing is a no-op.
 */

export async function register() {
  // Only instrument in the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./server/arize");
  }
}
