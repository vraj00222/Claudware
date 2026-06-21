/**
 * Real slicing — turns a finished STL into actual G-code (real supports, real slice time, real filament
 * usage) by shelling out to a slicer CLI (PrusaSlicer console mode). This REPLACES the heuristic estimate
 * (recipe.ts `estimateMinutes`/`estimateGrams`) with measured numbers WHEN a slicer is installed.
 *
 * Constitution rules honoured:
 *   - Rule 5: the slicer runs in a subprocess WITH A TIMEOUT (one bad mesh must never hang the loop).
 *   - Integration layer: the slicer is binary-gated + env-flag-gated with a graceful fallback — the app
 *     boots and demos with ZERO tools/keys (when absent, callers keep the existing heuristic path).
 *   - Rule 6: no new npm dependency — we shell out to the slicer CLI and parse its G-code comments.
 *
 * `sliceStl` NEVER throws: it returns `{ ok: false, error }` on any failure so callers fall back cleanly.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { resolveSlicerBin } from "./bin";
import type { PrinterBed } from "./printReady/bed";

const execFileP = promisify(execFile);

/** Filament densities (g/cm³) — matches recipe.ts's PLA assumption; used to grams-ify volume/length. */
const FILAMENT_DENSITY: Record<string, number> = { PLA: 1.24, PETG: 1.27, ABS: 1.04, ASA: 1.07, TPU: 1.21 };
const DEFAULT_DENSITY = 1.24;
const DEFAULT_FILAMENT_DIAMETER_MM = 1.75;

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The subset of PrintRecipe the slicer maps to flags (kept local to avoid a circular import on recipe.ts). */
export interface SliceRecipe {
  layerHeight: number;
  firstLayerHeight: number;
  infillPercent: number;
  infillPattern: string;
  wallLoops: number;
  topLayers: number;
  bottomLayers: number;
  supportStyle: "none" | "normal" | "tree";
  supportAngle: number;
  bedTemp: number;
  nozzleTemp: number;
  material: string;
  brim: boolean;
}

export interface SliceResult {
  ok: boolean;
  gcodePath?: string;
  estimateMinutes?: number;
  filamentGrams?: number;
  filamentMeters?: number;
  supportsUsed?: boolean;
  error?: string;
}

export interface SliceOptions {
  /** Where to write the G-code (default: the STL path with a `.gcode` extension). */
  outPath?: string;
  /** Subprocess kill timeout (default 120s). */
  timeoutMs?: number;
}

/**
 * Is real slicing available? True only when the slicer binary is installed AND not disabled by env flag.
 * Optional flag `ENABLE_SLICER` / `SLICER_ENABLED`: set to 0/false/off/no to force the heuristic fallback
 * even when the binary is present (useful for demos / reproducibility). Default: enabled if installed.
 */
export function slicerAvailable(): boolean {
  const flag = process.env.ENABLE_SLICER ?? process.env.SLICER_ENABLED;
  if (flag != null && /^(0|false|off|no)$/i.test(flag.trim())) return false;
  return resolveSlicerBin() !== null;
}

/** Map an app recipe → PrusaSlicer console flags. Pure (testable); STL path goes last. */
export function buildSlicerArgs(recipe: SliceRecipe, profile: PrinterBed, outPath: string, stlPath: string): string[] {
  // PrusaSlicer fill patterns (a recipe pattern that isn't a slicer pattern falls back to gyroid).
  const SLICER_FILL = ["gyroid", "grid", "cubic", "honeycomb", "rectilinear", "triangles", "stars", "line", "concentric"];
  const fillPattern = SLICER_FILL.includes(recipe.infillPattern) ? recipe.infillPattern : "gyroid";
  const density = FILAMENT_DENSITY[recipe.material?.toUpperCase()] ?? DEFAULT_DENSITY;

  const args = [
    "--export-gcode",
    "--layer-height", String(recipe.layerHeight),
    "--first-layer-height", String(recipe.firstLayerHeight),
    "--fill-density", `${recipe.infillPercent}%`,
    "--fill-pattern", fillPattern,
    "--perimeters", String(recipe.wallLoops),
    "--top-solid-layers", String(recipe.topLayers),
    "--bottom-solid-layers", String(recipe.bottomLayers),
    "--temperature", String(recipe.nozzleTemp),
    "--first-layer-temperature", String(recipe.nozzleTemp),
    "--bed-temperature", String(recipe.bedTemp),
    "--first-layer-bed-temperature", String(recipe.bedTemp),
    "--nozzle-diameter", String(profile.nozzle),
    "--filament-diameter", String(DEFAULT_FILAMENT_DIAMETER_MM),
    "--filament-density", String(density),
  ];

  if (recipe.brim) args.push("--brim-width", "5");

  if (recipe.supportStyle !== "none") {
    args.push("--support-material");
    args.push("--support-material-auto");
    // "tree" → snug towers (material-saving, less scarring); "normal" → grid towers.
    args.push("--support-material-style", recipe.supportStyle === "tree" ? "snug" : "grid");
    args.push("--support-material-threshold", String(recipe.supportAngle));
  }

  args.push("--output", outPath, stlPath);
  return args;
}

type ExecErr = { killed?: boolean; signal?: string | null; code?: string | number | null; message?: string };

/** Turn a slicer subprocess failure into a short, honest message (timeout vs other). */
function describeSliceFailure(err: unknown): string {
  const e = (err ?? {}) as ExecErr;
  if (e.killed || e.signal != null || e.code === "ETIMEDOUT")
    return "slicer timed out — mesh too complex for the slice budget";
  return `slicer failed: ${(e.message ?? "unknown error").toString().trim().slice(0, 140)}`;
}

/**
 * Slice an STL into G-code with the configured recipe. Resolves the slicer binary, shells out WITH A
 * TIMEOUT, then parses the produced G-code for the real print time + filament usage. Returns a clear
 * "not available" result when the slicer is absent, and `{ ok: false, error }` on any other failure.
 */
export async function sliceStl(
  stlPath: string,
  recipe: SliceRecipe,
  profile: PrinterBed,
  opts: SliceOptions = {},
): Promise<SliceResult> {
  try {
    const bin = resolveSlicerBin();
    if (!bin) return { ok: false, error: "slicer not available" };
    if (!existsSync(stlPath)) return { ok: false, error: `STL not found: ${stlPath}` };

    const outPath = opts.outPath ?? stlPath.replace(/\.stl$/i, "") + ".gcode";
    const timeoutMs = opts.timeoutMs ?? 120_000;
    const args = buildSlicerArgs(recipe, profile, outPath, stlPath);

    await execFileP(bin, args, { timeout: timeoutMs, maxBuffer: 32 << 20 });
    if (!existsSync(outPath) || statSync(outPath).size === 0) return { ok: false, error: "slicer produced no G-code" };

    const gcode = await readFile(outPath, "utf8");
    const est = parseGcodeEstimate(gcode, {
      densityGramsPerCm3: FILAMENT_DENSITY[recipe.material?.toUpperCase()] ?? DEFAULT_DENSITY,
    });
    return {
      ok: true,
      gcodePath: outPath,
      estimateMinutes: est.estimateMinutes,
      filamentGrams: est.filamentGrams,
      filamentMeters: est.filamentMeters,
      supportsUsed: recipe.supportStyle !== "none",
    };
  } catch (err) {
    return { ok: false, error: describeSliceFailure(err) };
  }
}

// ───────────────────────── G-code estimate parser (pure / unit-tested) ─────────────────────────

export interface GcodeEstimate {
  estimateMinutes?: number;
  filamentGrams?: number;
  filamentMeters?: number;
}

/** Parse a printing-time string like `2d 3h 5m 10s`, `1h 23m`, `24m 33s`, `45s` → minutes (rounded). */
function parseTimeStringToMinutes(s: string): number | undefined {
  const d = s.match(/(\d+)\s*d/i);
  const h = s.match(/(\d+)\s*h/i);
  const m = s.match(/(\d+)\s*m/i);
  const sec = s.match(/(\d+)\s*s/i);
  let total = 0;
  if (d) total += +d[1] * 86400;
  if (h) total += +h[1] * 3600;
  if (m) total += +m[1] * 60;
  if (sec) total += +sec[1];
  return total > 0 ? Math.round(total / 60) : undefined;
}

/**
 * Parse a slicer's print-time + filament usage out of its G-code comments. Pure function — no I/O.
 * Handles PrusaSlicer / Slic3r (`; estimated printing time (normal mode) = 1h 23m`,
 * `; total filament used [g] = 12.34`, `; filament used [cm3]/[mm] = …`) and CuraEngine
 * (`;TIME:4980`, `;Filament used: 1.234m`). Grams are computed from volume/length + density when the
 * slicer didn't report a non-zero weight (e.g. no filament density configured, or Cura).
 */
export function parseGcodeEstimate(
  gcode: string,
  opts: { densityGramsPerCm3?: number; filamentDiameterMm?: number } = {},
): GcodeEstimate {
  const density = opts.densityGramsPerCm3 ?? DEFAULT_DENSITY;
  const diameter = opts.filamentDiameterMm ?? DEFAULT_FILAMENT_DIAMETER_MM;

  // ── time ──
  let estimateMinutes: number | undefined;
  const psNormal = gcode.match(/estimated printing time \(normal mode\)\s*=\s*([^\n;]+)/i);
  const psAny = gcode.match(/estimated printing time(?:[^\n=]*)=\s*([^\n;]+)/i);
  const timeStr = (psNormal ?? psAny)?.[1];
  if (timeStr) estimateMinutes = parseTimeStringToMinutes(timeStr);
  if (estimateMinutes === undefined) {
    const cura = gcode.match(/^;TIME:\s*([\d.]+)/im); // Cura: total print time in seconds
    if (cura) estimateMinutes = Math.round(parseFloat(cura[1]) / 60);
  }

  // ── filament length (meters) ──
  let filamentMeters: number | undefined;
  const psMm = gcode.match(/filament used \[mm\]\s*=\s*([\d.]+)/i);
  if (psMm) filamentMeters = +psMm[1] / 1000;
  if (filamentMeters === undefined) {
    // Cura: `;Filament used: 1.234m` (may list multiple extruders, comma-separated → sum them).
    const curaLine = gcode.match(/;Filament used:\s*([^\n]+)/i);
    if (curaLine) {
      const nums = [...curaLine[1].matchAll(/([\d.]+)\s*m/g)].map((x) => +x[1]);
      if (nums.length) filamentMeters = nums.reduce((a, b) => a + b, 0);
    }
  }

  // ── filament weight (grams) ── prefer the slicer's own number; else derive from volume/length.
  let filamentGrams: number | undefined;
  const gTotal = gcode.match(/total filament used \[g\]\s*=\s*([\d.]+)/i);
  const gPlain = gcode.match(/filament used \[g\]\s*=\s*([\d.]+)/i);
  const reported = gTotal ? +gTotal[1] : gPlain ? +gPlain[1] : undefined;
  if (reported !== undefined && reported > 0) {
    filamentGrams = round1(reported);
  } else {
    const cm3 = gcode.match(/filament used \[cm3\]\s*=\s*([\d.]+)/i);
    if (cm3) {
      filamentGrams = round1(+cm3[1] * density);
    } else if (filamentMeters !== undefined) {
      const lengthMm = filamentMeters * 1000;
      const areaMm2 = Math.PI * (diameter / 2) ** 2;
      const volumeCm3 = (lengthMm * areaMm2) / 1000; // mm³ → cm³
      filamentGrams = round1(volumeCm3 * density);
    }
  }

  return { estimateMinutes, filamentGrams, filamentMeters };
}
