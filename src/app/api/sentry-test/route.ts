/**
 * Sentry verification endpoint — triggers a test error, log, and metric.
 *
 * GET /api/sentry-test          → throws an intentional error (captured by Sentry)
 * GET /api/sentry-test?check=1  → returns Sentry connection status (no error thrown)
 */

import * as Sentry from "@sentry/nextjs";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const url = new URL(req.url);

  if (url.searchParams.get("check") === "1") {
    return Response.json({
      sentry: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
      dsn: (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "").replace(/\/\/.*@/, "//***@"),
    });
  }

  Sentry.logger.info("User triggered test error", {
    action: "test_error_endpoint",
    timestamp: new Date().toISOString(),
  });

  throw new Error("Sentry test error — this is intentional!");
}
