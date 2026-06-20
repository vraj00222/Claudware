/**
 * Auto Print Recipe — analyzes mesh geometry and picks optimal Bambu A1 print settings.
 * Pure function: takes parsed triangles + bed profile → returns a PrintRecipe with
 * layer height, infill, supports, walls, material recommendation, and estimated time/weight.
 * The recipe is embedded into the 3MF export so it's one-click printable.
 */
import { boundingBox, type Tri, type Vec3, type BBox } from "@/server/printPlan";
import { overhangFraction, countShells, shellBBoxes } from "./diagnose";
import type { PrinterBed } from "./bed";

export type ModelClass = "figurine" | "functional" | "organic" | "mechanical" | "decorative";
export type SupportStyle = "none" | "normal" | "tree";

export interface PrintRecipe {
  modelClass: ModelClass;
  layerHeight: number;        // mm
  firstLayerHeight: number;   // mm
  infillPercent: number;      // 0–100
  infillPattern: string;      // "gyroid" | "grid" | "cubic"
  wallLoops: number;          // perimeter count
  topLayers: number;
  bottomLayers: number;
  supportStyle: SupportStyle;
  supportAngle: number;       // threshold degrees
  bedTemp: number;            // °C
  nozzleTemp: number;         // °C
  speed: number;              // mm/s (outer wall)
  material: string;           // "PLA" | "PETG" etc
  brim: boolean;
  estimateMinutes: number;
  estimateGrams: number;
  why: string;                // plain-language reason for the choices
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Signed volume of a triangle w.r.t. the origin (for total mesh volume via divergence theorem). */
function signedTriVolume([a, b, c]: Tri): number {
  return (a.x * (b.y * c.z - c.y * b.z) - b.x * (a.y * c.z - c.y * a.z) + c.x * (a.y * b.z - b.y * a.z)) / 6;
}

/** Total mesh volume in mm³ (absolute, works for non-watertight meshes as a rough estimate). */
export function meshVolume(tris: Tri[]): number {
  let vol = 0;
  for (const t of tris) vol += signedTriVolume(t);
  return Math.abs(vol);
}

/** Triangle density: triangles per mm³ of bounding box (high = organic/detailed). */
function triDensity(tris: Tri[], bbox: BBox): number {
  const bboxVol = bbox.w * bbox.d * bbox.h;
  return bboxVol > 0 ? tris.length / bboxVol : 0;
}

/** Volume ratio: mesh volume / bounding box volume (high = blocky/solid, low = organic/hollow). */
function volumeRatio(meshVol: number, bbox: BBox): number {
  const bboxVol = bbox.w * bbox.d * bbox.h;
  return bboxVol > 0 ? meshVol / bboxVol : 0;
}

/** Aspect ratio: tallest dimension / average of the other two. */
function aspectRatio(bbox: BBox): number {
  const dims = [bbox.w, bbox.d, bbox.h].sort((a, b) => b - a);
  const avg = (dims[1] + dims[2]) / 2;
  return avg > 0 ? dims[0] / avg : 1;
}

/** Classify the model type from geometry heuristics. */
export function classifyModel(tris: Tri[], bbox: BBox): ModelClass {
  const vol = meshVolume(tris);
  const vr = volumeRatio(vol, bbox);
  const td = triDensity(tris, bbox);
  const ar = aspectRatio(bbox);
  const shells = countShells(tris);
  const maxDim = Math.max(bbox.w, bbox.d, bbox.h);

  // High tri density + low volume ratio = organic/figurine
  if (td > 0.5 && vr < 0.35) return "figurine";
  if (td > 0.3 && ar > 2.5) return "figurine";

  // High volume ratio + low aspect ratio = functional/blocky
  if (vr > 0.5 && ar < 2) return "functional";

  // Multiple shells or very mechanical look
  if (shells > 2) return "mechanical";

  // Medium density, complex shape
  if (td > 0.2 && vr < 0.4) return "organic";

  // Small + detailed
  if (maxDim < 60 && tris.length > 5000) return "decorative";

  // Large + simple
  if (vr > 0.4) return "functional";

  return "decorative";
}

/** Rough print time estimate (minutes) based on volume, layer height, and speed. */
function estimateTime(vol: number, bbox: BBox, layerHeight: number, speed: number): number {
  const layers = bbox.h / layerHeight;
  const avgLayerArea = (bbox.w * bbox.d) * 0.4; // rough fill area per layer
  const pathLength = avgLayerArea / 0.4; // mm of toolpath per layer (nozzle width)
  const moveTime = (pathLength * layers) / (speed * 60); // minutes of movement
  return Math.max(5, Math.round(moveTime * 0.3)); // correction factor
}

/** Rough filament estimate (grams) from volume and infill. */
function estimateWeight(vol: number, infillPct: number): number {
  const density = 1.24; // PLA g/cm³
  const shellFraction = 0.3;
  const fillFraction = (1 - shellFraction) * (infillPct / 100);
  const effectiveVol = vol * (shellFraction + fillFraction);
  return Math.max(1, round1(effectiveVol * density / 1000)); // mm³ → cm³ → grams
}

/** Build the auto print recipe from mesh geometry. */
export function buildPrintRecipe(tris: Tri[], bed: PrinterBed): PrintRecipe {
  const bbox = boundingBox(tris);
  const modelClass = classifyModel(tris, bbox);
  const vol = meshVolume(tris);
  const overhang = overhangFraction(tris);

  let layerHeight: number;
  let infillPercent: number;
  let infillPattern: string;
  let wallLoops: number;
  let supportStyle: SupportStyle;
  let supportAngle: number;
  let speed: number;
  let brim: boolean;
  let whyParts: string[] = [];

  switch (modelClass) {
    case "figurine":
      layerHeight = 0.12;
      infillPercent = 15;
      infillPattern = "gyroid";
      wallLoops = 2;
      supportStyle = overhang > 0.05 ? "tree" : "none";
      supportAngle = 45;
      speed = 50;
      brim = false;
      whyParts.push("Fine layers (0.12mm) for detail");
      whyParts.push("light gyroid infill (15%) — it's decorative");
      if (supportStyle === "tree") whyParts.push("tree supports to preserve surface finish");
      break;

    case "functional":
      layerHeight = 0.20;
      infillPercent = 40;
      infillPattern = "cubic";
      wallLoops = 3;
      supportStyle = overhang > 0.05 ? "normal" : "none";
      supportAngle = 50;
      speed = 80;
      brim = bbox.w * bbox.d < 400; // small footprint → brim for adhesion
      whyParts.push("Standard layers (0.20mm) for strength");
      whyParts.push("thick walls (3) + dense cubic infill (40%) — it needs to hold loads");
      break;

    case "mechanical":
      layerHeight = 0.16;
      infillPercent = 30;
      infillPattern = "grid";
      wallLoops = 3;
      supportStyle = overhang > 0.05 ? "normal" : "none";
      supportAngle = 50;
      speed = 60;
      brim = true;
      whyParts.push("Balanced layers (0.16mm) for fit and strength");
      whyParts.push("grid infill (30%) + 3 walls for rigidity");
      break;

    case "organic":
      layerHeight = 0.16;
      infillPercent = 20;
      infillPattern = "gyroid";
      wallLoops = 2;
      supportStyle = overhang > 0.08 ? "tree" : "none";
      supportAngle = 45;
      speed = 60;
      brim = false;
      whyParts.push("Medium layers (0.16mm) balance detail and speed");
      whyParts.push("gyroid infill (20%) — strong enough, prints fast");
      if (supportStyle === "tree") whyParts.push("tree supports — easier to remove from curved surfaces");
      break;

    case "decorative":
    default:
      layerHeight = 0.12;
      infillPercent = 15;
      infillPattern = "gyroid";
      wallLoops = 2;
      supportStyle = overhang > 0.05 ? "tree" : "none";
      supportAngle = 45;
      speed = 50;
      brim = false;
      whyParts.push("Fine layers (0.12mm) for a smooth finish");
      whyParts.push("light infill (15%) — save material on a display piece");
      break;
  }

  const estimateMin = estimateTime(vol, bbox, layerHeight, speed);
  const estimateG = estimateWeight(vol, infillPercent);

  const why = `${modelClass} model → ${whyParts.join("; ")}. ` +
    `~${estimateMin} min, ~${estimateG}g PLA.`;

  return {
    modelClass,
    layerHeight,
    firstLayerHeight: 0.20,
    infillPercent,
    infillPattern,
    wallLoops,
    topLayers: Math.ceil(0.8 / layerHeight),   // ~0.8mm solid top
    bottomLayers: Math.ceil(0.8 / layerHeight), // ~0.8mm solid bottom
    supportStyle,
    supportAngle,
    bedTemp: 55,       // PLA on Bambu A1 textured plate
    nozzleTemp: 220,   // PLA standard
    speed,
    material: "PLA",
    brim,
    estimateMinutes: estimateMin,
    estimateGrams: estimateG,
    why,
  };
}
