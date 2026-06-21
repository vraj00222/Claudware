/**
 * Sentry client-side configuration (sponsor: Sentry).
 *
 * Loaded automatically by @sentry/nextjs in the browser bundle.
 * Key-gated: when NEXT_PUBLIC_SENTRY_DSN is missing, Sentry is a no-op.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",

    // Tracing — capture 100% of transactions in dev, 20% in prod
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

    // Session Replay — capture errors + a sample of all sessions
    integrations: [
      Sentry.replayIntegration(),
      Sentry.browserTracingIntegration(),
      Sentry.feedbackIntegration({ colorScheme: "light" }),
    ],
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Structured logs
    enableLogs: true,
  });
}
