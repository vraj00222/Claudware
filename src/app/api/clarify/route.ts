import { NextResponse } from "next/server";
import { classifyPrompt, heuristicQuestions, claudeQuestions } from "@/server/clarify";
import { Sentry, incrementMetric } from "@/server/sentry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pre-generation step: return chip questions SPECIFIC to the prompt (Kratos → armor/weapon/era;
 * dragon → scales/wings/pose) via Claude, with the generic SIZE question always appended. Falls
 * back to the deterministic heuristic if Claude is unavailable. Never blocks generation.
 */
export async function POST(req: Request) {
  const { prompt = "" } = (await req.json().catch(() => ({}))) as { prompt?: string };
  const promptClass = classifyPrompt(prompt);
  // Only pay the (~15s) Claude call for figures/characters, where tailored questions matter (Kratos →
  // weapon/era). Parts/containers/generic get the instant heuristic so they don't wait.
  const smart = promptClass === "figure" || promptClass === "character" ? await claudeQuestions(prompt) : [];
  const sizeQ = heuristicQuestions(prompt).find((q) => q.id === "size")!;
  const questions = smart.length ? [...smart, sizeQ] : heuristicQuestions(prompt);
  incrementMetric("clarify.requests", 1, { class: promptClass });
  Sentry.logger.info("Clarify questions generated", { promptClass, count: questions.length });
  return NextResponse.json({ promptClass, questions });
}
