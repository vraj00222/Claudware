import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // OTel + Arize packages must NOT be bundled by Next.js — they use Node-only APIs.
  serverExternalPackages: [
    "@opentelemetry/sdk-trace-node",
    "@opentelemetry/sdk-trace-base",
    "@opentelemetry/exporter-trace-otlp-proto",
    "@opentelemetry/resources",
    "@opentelemetry/api",
    "@arizeai/openinference-instrumentation-anthropic",
    "@arizeai/openinference-semantic-conventions",
    "@arizeai/openinference-core",
    "@sentry/profiling-node",
  ],
  async rewrites() {
    return {
      // `/` serves the animated landing page (static, in public/); the studio lives at /app behind
      // the Google auth gate. beforeFiles so it intercepts the root before the app router.
      beforeFiles: [{ source: "/", destination: "/landing.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default withSentryConfig(nextConfig, {
  // Suppress noisy source-map-upload warnings when SENTRY_AUTH_TOKEN is not set
  silent: !process.env.SENTRY_AUTH_TOKEN,

  // Upload a larger set of source maps for readable stack traces in Sentry
  widenClientFileUpload: true,

  // Tunnel Sentry events through a Next.js rewrite to avoid ad-blockers
  tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements in production
  disableLogger: true,
});
