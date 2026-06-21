/**
 * Manual tracing helpers for Arize AX (sponsor: Arize).
 *
 * The Anthropic auto-instrumentor handles LLM spans. These helpers add higher-level
 * CHAIN, TOOL, and RETRIEVER spans around the generation pipeline so Arize shows the
 * full agent flow: classify → clarify → design → inspect → repair → cache lookup.
 *
 * Key-gated: when Arize is not configured, every helper is a transparent passthrough.
 */

import { trace, SpanStatusCode, type Span } from "@opentelemetry/api";
import {
  SemanticConventions,
  OpenInferenceSpanKind,
} from "@arizeai/openinference-semantic-conventions";

const SERVICE_NAME = "claudware";
const tracer = trace.getTracer(SERVICE_NAME);

type SpanKind = "CHAIN" | "TOOL" | "RETRIEVER" | "AGENT" | "EVALUATOR";

/**
 * Wrap an async function in an OpenInference span. Attributes are set on the span
 * and the function result is recorded as output.value (if it's a string).
 */
export async function withSpan<T>(
  name: string,
  kind: SpanKind,
  attrs: Record<string, string | number | boolean | undefined>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      span.setAttribute(SemanticConventions.OPENINFERENCE_SPAN_KIND, kind);
      for (const [k, v] of Object.entries(attrs)) {
        if (v !== undefined) span.setAttribute(k, v);
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (e) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: (e as Error).message });
      span.recordException(e as Error);
      throw e;
    } finally {
      span.end();
    }
  });
}

/** Wrap the entire generation pipeline in a top-level CHAIN span. */
export function traceGeneration<T>(
  prompt: string,
  engine: string,
  sessionId: string | undefined,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan("generate", "CHAIN", {
    [SemanticConventions.INPUT_VALUE]: prompt,
    "generation.engine": engine,
    ...(sessionId ? { [SemanticConventions.SESSION_ID]: sessionId } : {}),
  }, fn);
}

/** Wrap engine classification. */
export function traceClassify<T>(prompt: string, fn: (span: Span) => Promise<T>): Promise<T> {
  return withSpan("classify-engine", "CHAIN", {
    [SemanticConventions.INPUT_VALUE]: prompt,
  }, fn);
}

/** Wrap a Redis cache lookup (exact or semantic). */
export function traceCacheLookup<T>(
  prompt: string,
  method: "exact" | "semantic",
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan(`cache-lookup-${method}`, "RETRIEVER", {
    [SemanticConventions.INPUT_VALUE]: prompt,
    "cache.method": method,
  }, fn);
}

/** Wrap a tool invocation (OpenSCAD render, Blender run, NVIDIA call, etc.). */
export function traceTool<T>(
  toolName: string,
  detail: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan(toolName, "TOOL", {
    [SemanticConventions.INPUT_VALUE]: detail,
  }, fn);
}

/** Wrap self-inspect (vision check on rendered model). */
export function traceInspect<T>(prompt: string, fn: (span: Span) => Promise<T>): Promise<T> {
  return withSpan("self-inspect", "CHAIN", {
    [SemanticConventions.INPUT_VALUE]: prompt,
  }, fn);
}

/** Wrap self-repair (fix broken OpenSCAD/bpy). */
export function traceRepair<T>(
  prompt: string,
  errorText: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan("self-repair", "TOOL", {
    [SemanticConventions.INPUT_VALUE]: prompt,
    "repair.error": errorText.slice(0, 500),
  }, fn);
}

/** Wrap an evaluator run. */
export function traceEval<T>(
  name: string,
  input: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return withSpan(`eval-${name}`, "EVALUATOR", {
    [SemanticConventions.INPUT_VALUE]: input,
  }, fn);
}

export { OpenInferenceSpanKind, SemanticConventions };
