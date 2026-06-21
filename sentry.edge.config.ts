/**
 * Sentry Edge runtime configuration (sponsor: Sentry).
 *
 * Loaded by @sentry/nextjs for edge/middleware routes.
 * Key-gated: when SENTRY_DSN is missing, Sentry is a no-op.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",

    // Structured logs
    enableLogs: true,

    // Tracing
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  });
}
