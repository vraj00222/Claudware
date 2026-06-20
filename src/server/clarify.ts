import type { PromptClass, Question } from "@/lib/clarify";
import { claudeText } from "./claude";

const FIGURE = /(dragon|figure|figurine|character|creature|animal|cat|dog|monster|robot|knight|warrior|anime|mascot|kratos|wolf|bird|fish|fox|bear)/i;
const PART = /(bracket|mount|holder|clip|hook|gear|spacer|adapter|stand|case|enclosure|knob|handle|hinge)/i;
const CONTAINER = /(vase|cup|bowl|box|jar|pot|planter|container|tray|mug)/i;
const NAMED = /\b[A-Z][a-z]{2,}\b/; // crude proper-noun hint for "named things" (e.g. Kratos, Pikachu)

/** Classify the prompt so we ask the RIGHT questions (figures get skin/pose; parts just size). */
export function classifyPrompt(p: string): PromptClass {
  if (FIGURE.test(p)) return "figure";
  if (CONTAINER.test(p)) return "container";
  if (PART.test(p)) return "part";
  if (NAMED.test(p.trim())) return "character";
  return "generic";
}

/** Generic size question — asked on EVERY prompt; its answer also sets the real-world scale (mm). */
const SIZE: Question = {
  id: "size",
  label: "About how big?",
  allowFreeText: true,
  options: [
    { label: "Palm-size", value: "size≈small" },
    { label: "Hand-size", value: "size≈medium" },
    { label: "Display-size", value: "size≈large" },
  ],
  sizeMm: {
    "size≈small": 60, "size≈medium": 120, "size≈large": 220,
    "palm-size": 60, "hand-size": 120, "display-size": 220,
  },
};

/** Deterministic fallback questions. We deliberately DON'T guess surface/pose here: a blind
 *  "Scales / Furry?" on a Lego Luffy is worse than asking nothing. When Claude can't tailor
 *  questions, we only ask SIZE (universal, and it drives real-world scale). Prompt-specific look
 *  details come from Claude's knowledge + web-research at enrichment time, not from forcing chips. */
export function heuristicQuestions(_p: string): Question[] {
  return [SIZE];
}

/** Ask Claude for clarifying questions SPECIFIC to this prompt — but ONLY for details that are
 *  genuinely ambiguous AND not already in the prompt. If the subject is well-known or already
 *  specified (e.g. "Luffy gear 2 lego figure" — pose + style stated, character known), Claude
 *  returns nothing and we skip straight to size. Returns [] on NONE/failure. Size is appended by
 *  the caller. This is the fix for "why is it asking about the pose I already gave?". */
export async function claudeQuestions(prompt: string): Promise<Question[]> {
  const instruction =
    `A user wants a 3D-printable model of: "${prompt}".\n` +
    `Decide whether ANY clarifying question is actually needed before generating. RULES:\n` +
    `- NEVER ask about something the prompt already states (it names a pose, outfit, version, style → that's settled).\n` +
    `- NEVER ask about size (handled separately).\n` +
    `- If you already know how this subject looks (a known character/object/franchise) OR the prompt is ` +
    `already specific, ask NOTHING.\n` +
    `- Only ask about a detail that is genuinely ambiguous AND would visibly change the model.\n` +
    `If no question is needed, output exactly: NONE\n` +
    `Otherwise output ONLY 1–2 lines in this exact format:\n` +
    `Q: <question> | <option1> ; <option2> ; <option3>\n` +
    `2–4 options each, most likely first. Begin immediately with "NONE" or "Q:".`;
  try {
    const stdout = await claudeText(instruction, { maxTokens: 400, timeoutMs: 25_000 });
    const qs: Question[] = [];
    for (const line of stdout.split("\n")) {
      const m = /^\s*Q:\s*(.+?)\s*\|\s*(.+)$/.exec(line);
      if (!m) continue;
      const label = m[1].trim();
      const opts = m[2].split(";").map((s) => s.trim()).filter(Boolean).slice(0, 4);
      if (!label || opts.length < 2) continue;
      const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 24) || `q${qs.length}`;
      qs.push({ id, label, allowFreeText: true, options: opts.map((o) => ({ label: o, value: `${id}=${o.toLowerCase()}` })) });
      if (qs.length >= 3) break;
    }
    return qs;
  } catch {
    return [];
  }
}
