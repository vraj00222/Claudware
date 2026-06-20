/**
 * Self-inspect → retry for the NVIDIA "wow" path — the constitution's "inspect its own render, fix its
 * own mistakes" loop, free + bounded. We render the generated STL to a grey PNG (OpenSCAD), ask Claude
 * vision "does this clearly read as {subject}?", and on an obvious miss the route retries ONCE with
 * stronger enrichment / a new seed. Everything here is best-effort and FAILS OPEN: a parse miss, a render
 * failure, or a slow vision call never blocks a good model.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { claudeVision } from "./claude";

const execFileP = promisify(execFile);
const bin = (abs: string, name: string) => (existsSync(abs) ? abs : name);
const OPENSCAD = bin("/opt/homebrew/bin/openscad", "openscad");

export interface InspectScore { score: number | null; ok: boolean; reason: string }

/** Parse Claude's vision reply into a 0..1 likeness score. Fails OPEN (ok=true) when no score is found. */
export function parseInspectScore(text: string, threshold = 0.6): InspectScore {
  const t = (text || "").trim();
  let score: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = t.match(/(\d+(?:\.\d+)?)\s*\/\s*10\b/))) score = Math.min(1, Number(m[1]) / 10);
  else if ((m = t.match(/(\d{1,3}(?:\.\d+)?)\s*%/))) score = Math.min(1, Number(m[1]) / 100);
  else if ((m = t.match(/\b(0?\.\d+|1(?:\.0+)?)\b/))) score = Number(m[1]);
  const reason = (t.match(/reason[:\-]\s*(.+)/i)?.[1] || t).replace(/\s+/g, " ").slice(0, 160).trim();
  const ok = score === null ? true : score >= threshold;
  return { score, ok, reason };
}

/** Render an STL to a grey PNG via OpenSCAD's import() so we have something for Claude vision to judge. */
export async function renderStlPng(stlPath: string, outPng: string): Promise<string | null> {
  try {
    const scad = outPng.replace(/\.png$/i, "") + ".scad";
    await writeFile(scad, `import(${JSON.stringify(stlPath)});\n`);
    await execFileP(OPENSCAD, ["-o", outPng, "--imgsize=640,640", "--autocenter", "--viewall", "--colorscheme=Tomorrow", scad], { timeout: 30_000 });
    return existsSync(outPng) ? outPng : null;
  } catch { return null; }
}

/** Render + score a model against its intended subject. Returns null if we couldn't judge (fail open). */
export async function scoreModel(stlPath: string, subject: string, jobDir: string, threshold = 0.6): Promise<InspectScore | null> {
  const png = await renderStlPng(stlPath, path.join(jobDir, "inspect.png"));
  if (!png) return null;
  const instruction =
    `On its own, does the SHAPE in this grey 3D render clearly read as: "${subject}"? ` +
    `Judge silhouette/pose/proportions only (it is untextured). Reply with EXACTLY two lines:\n` +
    `SCORE: <number 0 to 1, where 1 = unmistakable, 0 = unrecognizable blob>\n` +
    `REASON: <one short phrase>`;
  try {
    const out = await claudeVision(instruction, [png], { maxTokens: 200, timeoutMs: 30_000 });
    return parseInspectScore(out, threshold);
  } catch { return null; }
}
