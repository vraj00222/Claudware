/**
 * Arize AX — OpenTelemetry tracing setup (sponsor: Arize).
 *
 * Configures a NodeTracerProvider that exports OpenInference-compliant spans to
 * Arize via OTLP/proto, then attaches the Anthropic auto-instrumentor so every
 * Claude messages.create() call emits an LLM span with prompts, responses, and
 * token usage — zero manual work on the hot path.
 *
 * Key-gated: if ARIZE_SPACE_ID or ARIZE_API_KEY are missing, this module is a
 * silent no-op (the app runs with no tracing overhead).
 *
 * Import order matters: this module MUST be loaded before the first Anthropic
 * client is constructed — Next.js's `instrumentation.ts` hook guarantees that.
 */

import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { SimpleSpanProcessor, BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { SEMRESATTRS_PROJECT_NAME } from "@arizeai/openinference-semantic-conventions";
import { AnthropicInstrumentation } from "@arizeai/openinference-instrumentation-anthropic";
import Anthropic from "@anthropic-ai/sdk";

const ARIZE_SPACE_ID = process.env.ARIZE_SPACE_ID ?? "";
const ARIZE_API_KEY = process.env.ARIZE_API_KEY ?? "";
const PROJECT_NAME = "claudware";
const COLLECTOR_ENDPOINT = "https://otlp.arize.com";

export const arizeConfigured = Boolean(ARIZE_SPACE_ID && ARIZE_API_KEY);

let _provider: NodeTracerProvider | undefined;

if (arizeConfigured) {
  const exporter = new OTLPTraceExporter({
    url: `${COLLECTOR_ENDPOINT}/v1/traces`,
    headers: {
      "arize-space-id": ARIZE_SPACE_ID,
      "arize-api-key": ARIZE_API_KEY,
    },
  });

  _provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: PROJECT_NAME,
      [SEMRESATTRS_PROJECT_NAME]: PROJECT_NAME,
    }),
    spanProcessors: [
      process.env.NODE_ENV === "production"
        ? new BatchSpanProcessor(exporter)
        : new SimpleSpanProcessor(exporter),
    ],
  });

  _provider.register();

  // Auto-instrument the Anthropic SDK — patches messages.create() to emit LLM spans.
  const anthropicInstrumentation = new AnthropicInstrumentation({
    tracerProvider: _provider,
  });
  anthropicInstrumentation.manuallyInstrument(Anthropic);

  console.log("[arize] Tracing enabled → project 'claudware' on Arize AX");
} else {
  console.log("[arize] ARIZE_SPACE_ID / ARIZE_API_KEY not set → tracing disabled (no-op)");
}

export const tracerProvider = _provider;
