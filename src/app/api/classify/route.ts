import { claudeText } from "@/server/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Common-object keywords → a zero-cost heuristic when the model call is slow/unavailable.
const COMMON = /\b(bolt|nut|screw|washer|gear|bracket|hook|clip|knob|phone stand|stand|holder|vase|pot|box|case|benchy|whistle|fidget|spinner|keychain|hinge|handle|mount|adapter|gridfinity|pikachu|mario|dragon|figurine|miniature|dice|coaster|cable|organizer)\b/i;

/** Cheap "does a ready-made version probably exist?" check for the proactive search nudge. Never blocks. */
export async function POST(req: Request) {
  const { prompt = "" } = (await req.json().catch(() => ({}))) as { prompt?: string };
  const p = prompt.trim();
  if (!p) return Response.json({ likely: false });
  // Fast heuristic first.
  if (COMMON.test(p)) return Response.json({ likely: true });
  try {
    const out = await claudeText(
      `Is "${p}" a common, generic physical object likely to already exist on 3D-model sharing sites? Answer only yes or no.`,
      { model: "haiku", maxTokens: 16, timeoutMs: 9_000 },
    );
    return Response.json({ likely: /\byes\b/i.test(out) });
  } catch {
    return Response.json({ likely: false });
  }
}
