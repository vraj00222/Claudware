/**
 * Sentry helpers for Claudware server routes (sponsor: Sentry).
 *
 * Provides wrappers for structured logging, custom spans, and error capture
 * around the 3D generation pipeline. Key-gated: all helpers are safe to call
 * even when Sentry is not configured (they become silent no-ops).
 *
 * Metrics are emitted as structured logs (Sentry.logger) since the Sentry SDK v9
 * uses structured logs for application-level telemetry.
 */

import * as Sentry from "@sentry/nextjs";

export const sentryConfigured = Boolean(
  process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
);

/** Wrap an async function in a Sentry span for performance tracing. */
export async function withSentrySpan<T>(
  op: string,
  description: string,
  fn: () => Promise<T>,
): Promise<T> {
  return Sentry.startSpan({ op, name: description }, async () => {
    return fn();
  });
}

/** Record a distribution metric via structured log. */
export function recordMetric(
  name: string,
  value: number,
  tags?: Record<string, string>,
) {
  Sentry.logger.info(`metric.${name}`, { value, ...tags });
}

/** Increment a counter metric via structured log. */
export function incrementMetric(
  name: string,
  value = 1,
  tags?: Record<string, string>,
) {
  Sentry.logger.info(`metric.${name}`, { increment: value, ...tags });
}

/** Capture a non-fatal error as a Sentry event with extra context. */
export function captureError(
  err: unknown,
  context?: Record<string, unknown>,
) {
  Sentry.captureException(err, { extra: context });
}

/** Set user context for Sentry (e.g. from InsForge auth). */
export function setSentryUser(user: { id?: string; email?: string }) {
  Sentry.setUser(user.id ? user : null);
}

export { Sentry };
