/**
 * Next.js Instrumentation Hook — Sentry + Arize AX Tracing.
 *
 * Next.js calls `register()` once on server startup (before any route handler runs).
 * We use it to initialise Sentry (error monitoring, tracing, profiling, logs, metrics)
 * and OpenTelemetry / Arize AX (LLM tracing). Manual CHAIN/TOOL spans are added in the
 * generation pipeline (see src/server/tracing.ts).
 *
 * Both are key-gated: Sentry needs SENTRY_DSN; Arize needs ARIZE_SPACE_ID + ARIZE_API_KEY.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Sentry must init before anything else so it can capture all errors + spans
    await import("../sentry.server.config");
    await import("./server/arize");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

// Automatically report server-side request errors to Sentry (Next.js 15+)
export { captureRequestError as onRequestError } from "@sentry/nextjs";
