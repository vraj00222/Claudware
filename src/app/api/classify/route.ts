import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const execFileP = promisify(execFile);
const CLAUDE = existsSync(path.join(os.homedir(), ".local/bin/claude")) ? path.join(os.homedir(), ".local/bin/claude") : "claude";

// Common-object keywords → a zero-cost heuristic when the CLI is slow/unavailable.
const COMMON = /\b(bolt|nut|screw|washer|gear|bracket|hook|clip|knob|phone stand|stand|holder|vase|pot|box|case|benchy|whistle|fidget|spinner|keychain|hinge|handle|mount|adapter|gridfinity|pikachu|mario|dragon|figurine|miniature|dice|coaster|cable|organizer)\b/i;

/** Cheap "does a ready-made version probably exist?" check for the proactive search nudge. Never blocks. */
export async function POST(req: Request) {
  const { prompt = "" } = (await req.json().catch(() => ({}))) as { prompt?: string };
  const p = prompt.trim();
  if (!p) return Response.json({ likely: false });
  // Fast heuristic first.
  if (COMMON.test(p)) return Response.json({ likely: true });
  try {
    const { stdout } = await execFileP(
      CLAUDE,
      ["-p", `Is "${p}" a common, generic physical object likely to already exist on 3D-model sharing sites? Answer only yes or no.`],
      { timeout: 9_000, maxBuffer: 1 << 16 },
    );
    return Response.json({ likely: /\byes\b/i.test(stdout) });
  } catch {
    return Response.json({ likely: false });
  }
}
