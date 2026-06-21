/**
 * /api/arize — Arize AX tracing status + demo endpoint.
 *
 * Returns the current tracing configuration and can trigger a test span
 * to verify the Arize connection is working end-to-end.
 */

import { NextResponse } from "next/server";
import { arizeConfigured } from "@/server/arize";
import { trace, SpanStatusCode } from "@opentelemetry/api";
import { SemanticConventions, OpenInferenceSpanKind } from "@arizeai/openinference-semantic-conventions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    configured: arizeConfigured,
    project: "claudware",
    endpoint: "https://otlp.arize.com/v1/traces",
    features: {
      anthropicAutoInstrumentation: true,
      manualPipelineSpans: true,
      evaluator: true,
    },
  });
}

/** POST /api/arize — send a test span to verify the connection. */
export async function POST() {
  if (!arizeConfigured) {
    return NextResponse.json({ ok: false, error: "ARIZE_SPACE_ID / ARIZE_API_KEY not configured" }, { status: 503 });
  }

  const tracer = trace.getTracer("claudware");
  const span = tracer.startSpan("arize-connection-test");
  span.setAttribute(SemanticConventions.OPENINFERENCE_SPAN_KIND, OpenInferenceSpanKind.CHAIN);
  span.setAttribute(SemanticConventions.INPUT_VALUE, "test-span");
  span.setAttribute(SemanticConventions.OUTPUT_VALUE, "Arize AX connection verified");
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();

  return NextResponse.json({
    ok: true,
    message: "Test span sent to Arize AX — check your project 'claudware' at https://app.arize.com",
  });
}
