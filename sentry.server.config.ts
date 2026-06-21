/**
 * Sentry server-side configuration (sponsor: Sentry).
 *
 * Loaded by @sentry/nextjs via the instrumentation hook on Node.js startup.
 * Key-gated: when SENTRY_DSN is missing, Sentry is a no-op.
 */

import * as Sentry from "@sentry/nextjs";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",

    integrations: [
      nodeProfilingIntegration(),
    ],

    // Structured logs
    enableLogs: true,

    // Tracing — capture 100% in dev, 20% in prod
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

    // Profiling
    profileSessionSampleRate: 1.0,
    profileLifecycle: "trace",
  });
}
