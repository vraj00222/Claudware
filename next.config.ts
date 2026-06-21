import type { NextConfig } from "next";

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

export default nextConfig;
