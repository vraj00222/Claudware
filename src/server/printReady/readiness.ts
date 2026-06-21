/**
 * Print-Readiness v2 — the composer. Pure: given parsed triangles + a bed + the export formats (the
 * endpoint writes the files and hands the URLs in), returns the full PrintReadiness package: the 4-check
 * DIAGNOSIS + score, the recommended ORIENTATION, the DECOMPOSE decision (none / slab / parts), the
 * REPORTED repairs, and a plain "how I'd print it & why" NARRATIVE. No I/O (the route owns files/storage).
 */
import { boundingBox, planSplit, type Tri } from "@/server/printPlan";
import { diagnose, overhangFraction, countShells } from "./diagnose";
import { orient } from "./orient";
import { buildPrintRecipe } from "./recipe";
import type { PrinterBed } from "./bed";
import type { PrintReadiness, ExportFormat, RepairAction } from "@/lib/agentEvent";

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Optional real-slice numbers (from the slicer) that override the heuristic time/grams in the recipe. */
export interface EstimateOverride { minutes?: number; grams?: number }

export function buildPrintReadiness(
  tris: Tri[],
  bed: PrinterBed,
  formats: ExportFormat[],
  estimateOverride?: EstimateOverride,
): PrintReadiness {
  const bbox = boundingBox(tris);
  const dimensions = { w: round1(bbox.w), d: round1(bbox.d), h: round1(bbox.h) };
  const diag = diagnose(tris, bed);
  const orientation = orient(tris);
  const split = planSplit(bbox, bed);
  const frac = overhangFraction(tris);
  const shells = countShells(tris);

  // DECOMPOSE: bed-overflow → slab (v1 planSplit); else support-heavy or already-multi-part → recommend
  // PARTS (decompose & nest is the next stage); else one piece.
  let decompose: PrintReadiness["decompose"];
  if (split.recommendation === "split") {
    decompose = { strategy: "slab", parts: split.parts.length, reason: split.reason };
  } else if (shells > 1) {
    decompose = { strategy: "parts", parts: shells, reason: `Already ${shells} separate parts — print them together on one plate and assemble.` };
  } else if (frac > 0.2) {
    decompose = { strategy: "parts", parts: 0, reason: `Heavy overhangs (~${Math.round(frac * 100)}%) — prints better split into parts, each laid flat (decompose & nest is the next stage).` };
  } else {
    decompose = { strategy: "none", parts: 1, reason: "Prints fine in one piece." };
  }

  // REPAIRS are REPORTED here (applied:false); auto-apply lands with the Blender transform pass.
  const repairs: RepairAction[] = [];
  const manifold = diag.checks.find((c) => c.id === "manifold");
  if (manifold && manifold.level !== "ok") repairs.push({ id: "weld", label: "Make watertight (fill holes)", applied: false, detail: manifold.detail });
  const thin = diag.checks.find((c) => c.id === "thin");
  if (thin && thin.level !== "ok") repairs.push({ id: "thicken", label: "Thicken thin parts", applied: false, detail: thin.detail });
  const floaters = diag.checks.find((c) => c.id === "floaters");
  if (floaters && floaters.level !== "ok" && decompose.strategy !== "parts") repairs.push({ id: "floaters", label: "Remove stray floaters", applied: false, detail: floaters.detail });

  const recipe = buildPrintRecipe(tris, bed);
  if (estimateOverride?.minutes != null) recipe.estimateMinutes = estimateOverride.minutes;
  if (estimateOverride?.grams != null) recipe.estimateGrams = estimateOverride.grams;

  const supportNote = recipe.supportStyle === "none" ? "no supports needed"
    : `${recipe.supportStyle} supports at ${recipe.supportAngle}°`;
  const decomposeSentence =
    decompose.strategy === "none" ? "It prints in one piece"
      : decompose.strategy === "slab" ? `It's bigger than the ${bed.name} bed, so ${decompose.reason}`
        : decompose.reason;
  const narrative =
    `Your model is ${dimensions.w}×${dimensions.d}×${dimensions.h} mm. ${orientation.why} ` +
    `${decomposeSentence} (${supportNote}). ` +
    `Print recipe: ${recipe.layerHeight}mm layers, ${recipe.infillPercent}% ${recipe.infillPattern} infill, ` +
    `${recipe.wallLoops} walls, ${recipe.material} at ${recipe.nozzleTemp}°C. ` +
    `~${recipe.estimateMinutes} min, ~${recipe.estimateGrams}g. Download the 3MF — settings are embedded, one-click print on your ${bed.name}.`;

  return {
    score: diag.score,
    grade: diag.grade,
    checks: diag.checks,
    orientation,
    repairs,
    decompose,
    formats,
    bed: { w: bed.w, d: bed.d, h: bed.h, name: bed.name },
    dimensions,
    recipe,
    narrative,
  };
}
