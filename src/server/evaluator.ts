/**
 * LLM-as-Judge Evaluator — Arize AX feedback (sponsor: Arize).
 *
 * After each generation, this evaluator scores the output on:
 *  1. Relevance — does the generated model match the user's prompt?
 *  2. Printability — does the design follow 3D printing best practices?
 *  3. Completeness — did the agent finish (not fall back to a generic block)?
 *
 * Scores are attached to the Arize trace as span attributes so the Arize UI shows
 * evaluation results alongside traces. The evaluator itself is traced as an EVALUATOR
 * span kind so judges can see it in the Arize environment.
 *
 * Key-gated: requires ANTHROPIC_API_KEY. Runs asynchronously (non-blocking to the user).
 */

import { traceEval, SemanticConventions } from "./tracing";
import type { Span } from "@opentelemetry/api";

interface EvalInput {
  prompt: string;
  engine: string;
  summaryText: string;
  source?: string;
  hadRepair: boolean;
  servedFromCache: boolean;
  durationMs: number;
}

export interface EvalResult {
  relevance: number;      // 0-1
  printability: number;   // 0-1
  completeness: number;   // 0-1
  overall: number;        // weighted average
  reasoning: string;
}

/**
 * Run the LLM-as-judge evaluator on a completed generation.
 * Non-blocking: errors are swallowed (evaluation must never break generation).
 */
export async function evaluateGeneration(input: EvalInput): Promise<EvalResult | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;

  try {
    return await traceEval("generation-quality", input.prompt, async (span: Span) => {
      span.setAttribute("eval.engine", input.engine);
      span.setAttribute("eval.served_from_cache", input.servedFromCache);
      span.setAttribute("eval.had_repair", input.hadRepair);
      span.setAttribute("eval.duration_ms", input.durationMs);

      const { claudeText } = await import("./claude");

      const evalPrompt =
        `You are evaluating an AI 3D-printing design agent. Given a user prompt and the agent's output summary, ` +
        `score the generation on three criteria (0.0 to 1.0 each):\n\n` +
        `1. **relevance** — Does the output match what the user asked for? (1.0 = perfect match)\n` +
        `2. **printability** — Does the design follow 3D printing best practices (watertight, proper walls, ` +
        `no impossible overhangs, functional features present)? (1.0 = perfectly printable)\n` +
        `3. **completeness** — Did the agent produce a full, detailed model (not a generic fallback block)? ` +
        `(1.0 = fully complete)\n\n` +
        `User prompt: "${input.prompt}"\n` +
        `Engine used: ${input.engine}\n` +
        `Agent summary: "${input.summaryText}"\n` +
        `${input.source ? `Generated code snippet (first 500 chars): ${input.source.slice(0, 500)}` : ""}\n` +
        `Duration: ${input.durationMs}ms | Had self-repair: ${input.hadRepair} | From cache: ${input.servedFromCache}\n\n` +
        `Respond with ONLY a JSON object (no markdown, no backticks):\n` +
        `{"relevance": 0.X, "printability": 0.X, "completeness": 0.X, "reasoning": "one sentence"}`;

      const raw = await claudeText(evalPrompt, { model: "haiku", maxTokens: 300, timeoutMs: 15_000 });

      const parsed = JSON.parse(raw.replace(/^[^{]*/, "").replace(/[^}]*$/, "")) as {
        relevance?: number; printability?: number; completeness?: number; reasoning?: string;
      };

      const relevance = Math.max(0, Math.min(1, parsed.relevance ?? 0.5));
      const printability = Math.max(0, Math.min(1, parsed.printability ?? 0.5));
      const completeness = Math.max(0, Math.min(1, parsed.completeness ?? 0.5));
      const overall = relevance * 0.4 + printability * 0.35 + completeness * 0.25;
      const reasoning = parsed.reasoning ?? "";

      // Record scores on the evaluator span
      span.setAttribute("eval.score.relevance", relevance);
      span.setAttribute("eval.score.printability", printability);
      span.setAttribute("eval.score.completeness", completeness);
      span.setAttribute("eval.score.overall", overall);
      span.setAttribute(SemanticConventions.OUTPUT_VALUE, JSON.stringify({ relevance, printability, completeness, overall, reasoning }));

      return { relevance, printability, completeness, overall, reasoning };
    });
  } catch (e) {
    console.warn(`[arize-eval] evaluator failed (non-fatal): ${(e as Error).message?.slice(0, 100)}`);
    return null;
  }
}
