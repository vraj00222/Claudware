/**
 * Split-for-print engine — cut a model into printable parts joined by PUSH-FIT connectors.
 *
 * Two modes:
 *  - AUTO: the model is bigger than the bed → split the worst axis into bed-sized slabs.
 *  - FORCED: the user asks for the "print in parts" version of a model that already fits (e.g. 3 parts)
 *    so they can print on a smaller printer / in different colors and snap it together.
 *
 * The cut + connectors are done in OpenSCAD (CGAL booleans on the imported STL): deterministic, watertight,
 * and EXACT tolerances — the user's "no compromise on the fit". Each interface gets male pegs on the lower
 * part and matching female sockets (peg Ø + a calibrated clearance) on the upper part, with a chamfered
 * lead-in so they push together cleanly. Pure planning lives here (unit-tested); rendering shells out to
 * OpenSCAD with a timeout (constitution rule 5).
 */
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { OPENSCAD_BIN } from "./bin";
import { boundingBox, parseStlAuto, type BBox, type Bed } from "./printPlan";

const execFileP = promisify(execFile);
const round1 = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;

export type Axis = "x" | "y" | "z";

export interface PushFitConnector {
  type: "push-fit";
  pegDiameter: number; // Ø of the male peg (mm)
  pegLength: number; // how far the peg protrudes past the seam (mm)
  clearance: number; // gap added to the socket so it slides on (mm)
  socketDiameter: number; // pegDiameter + clearance
  socketDepth: number; // depth of the female hole (mm)
  chamfer: number; // lead-in chamfer on the peg tip (mm)
  /** Peg/socket centres in the two in-plane axes (world mm). Same pattern is reused at every seam. */
  positions: { a: number; b: number }[];
}

export interface SplitPartPlan {
  index: number;
  label: string;
  lo: number; // slab start along the split axis (world mm)
  hi: number; // slab end along the split axis (world mm)
  w: number;
  d: number;
  h: number;
}

export interface SplitPlan {
  mode: "auto" | "forced";
  axis: Axis;
  parts: SplitPartPlan[];
  seams: number[]; // world positions along the axis (n-1 of them)
  connector: PushFitConnector;
  reason: string;
  guide: string; // human-readable join guide with exact measurements
}

export interface SplitOpts {
  /** Force the model into this many parts even if it fits the bed (the "print version"). */
  parts?: number;
  /** Push-fit clearance in mm. Default 0.2 (typical calibrated FDM push-fit). */
  clearance?: number;
  /** Bed used for the AUTO decision (when `parts` isn't forced). */
  bed?: Bed;
  margin?: number;
}

const DEFAULT_BED: Bed = { w: 220, d: 220, h: 250, name: "Generic 220×220×250" };

/** The two in-plane axes for a given split axis, with helpers to read a BBox extent. */
function inPlane(axis: Axis): [Axis, Axis] {
  if (axis === "x") return ["y", "z"];
  if (axis === "y") return ["x", "z"];
  return ["x", "y"];
}
function lo(bbox: BBox, ax: Axis): number { return ax === "x" ? bbox.min.x : ax === "y" ? bbox.min.y : bbox.min.z; }
function ext(bbox: BBox, ax: Axis): number { return ax === "x" ? bbox.w : ax === "y" ? bbox.d : bbox.h; }

/** Choose the longest axis (forced mode) or the worst-overflowing axis (auto mode). */
function chooseAxis(bbox: BBox, bed: Bed, margin: number): { axis: Axis; n: number; mode: "auto" | "forced" } | null {
  const cand: { axis: Axis; dim: number; bed: number }[] = [
    { axis: "x", dim: bbox.w, bed: bed.w - margin },
    { axis: "y", dim: bbox.d, bed: bed.d - margin },
    { axis: "z", dim: bbox.h, bed: bed.h - margin },
  ];
  const over = cand.filter((c) => c.dim > c.bed);
  if (!over.length) return null;
  const worst = over.reduce((a, b) => (b.dim / b.bed > a.dim / a.bed ? b : a));
  return { axis: worst.axis, n: Math.ceil(worst.dim / worst.bed), mode: "auto" };
}

/**
 * Plan a push-fit connector pattern for a cross-section of size (crossA × crossB), centred on the bbox.
 * Pegs are clustered toward the CENTRE (within the central ~60%) so they land inside the solid even for
 * non-box cross-sections (cylinders, organic figures). 1 peg for small faces, 2 for medium, 4 for large.
 */
export function planConnector(bbox: BBox, axis: Axis, clearance: number): PushFitConnector {
  const [axA, axB] = inPlane(axis);
  const crossA = ext(bbox, axA), crossB = ext(bbox, axB);
  const minCross = Math.min(crossA, crossB);
  const pegDiameter = round1(Math.max(4, Math.min(12, minCross * 0.18)));
  const pegLength = round1(Math.max(4, Math.min(10, pegDiameter)));
  const chamfer = 0.6;
  const socketDiameter = round2(pegDiameter + clearance);
  const socketDepth = round1(pegLength + 0.4);

  const cA = lo(bbox, axA) + crossA / 2;
  const cB = lo(bbox, axB) + crossB / 2;
  // spread within the central 60% of each in-plane dimension
  const sA = crossA * 0.3;
  const sB = crossB * 0.3;
  let positions: { a: number; b: number }[];
  if (minCross < 22) {
    positions = [{ a: cA, b: cB }];
  } else if (minCross < 60) {
    // two pegs along the LONGER in-plane axis
    positions = crossA >= crossB
      ? [{ a: cA - sA, b: cB }, { a: cA + sA, b: cB }]
      : [{ a: cA, b: cB - sB }, { a: cA, b: cB + sB }];
  } else {
    positions = [
      { a: cA - sA, b: cB - sB }, { a: cA + sA, b: cB - sB },
      { a: cA - sA, b: cB + sB }, { a: cA + sA, b: cB + sB },
    ];
  }
  return { type: "push-fit", pegDiameter, pegLength, clearance: round2(clearance), socketDiameter, socketDepth, chamfer, positions };
}

/** Pure planner: decide axis, seams, parts and the connector pattern. Returns null when nothing to split. */
export function planSplitParts(bbox: BBox, opts: SplitOpts = {}): SplitPlan | null {
  const margin = opts.margin ?? 2;
  const clearance = opts.clearance ?? 0.2;
  const bed = opts.bed ?? DEFAULT_BED;

  let axis: Axis, n: number, mode: "auto" | "forced";
  if (opts.parts && opts.parts >= 2) {
    // forced: split the longest axis into N
    const longest = (["x", "y", "z"] as Axis[]).reduce((a, b) => (ext(bbox, b) > ext(bbox, a) ? b : a));
    axis = longest; n = Math.floor(opts.parts); mode = "forced";
  } else {
    const auto = chooseAxis(bbox, bed, margin);
    if (!auto) return null;
    axis = auto.axis; n = auto.n; mode = "auto";
  }
  if (n < 2) return null;

  const axisLo = lo(bbox, axis), dim = ext(bbox, axis);
  const slab = dim / n;
  const seams = Array.from({ length: n - 1 }, (_, i) => round1(axisLo + slab * (i + 1)));
  const connector = planConnector(bbox, axis, clearance);

  const [axA, axB] = inPlane(axis);
  const crossA = round1(ext(bbox, axA)), crossB = round1(ext(bbox, axB));
  const parts: SplitPartPlan[] = Array.from({ length: n }, (_, i) => {
    const partLo = i === 0 ? axisLo : seams[i - 1];
    const partHi = i === n - 1 ? axisLo + dim : seams[i];
    const along = round1(partHi - partLo);
    return {
      index: i,
      label: `part ${i + 1} of ${n}`,
      lo: round1(partLo),
      hi: round1(partHi),
      w: axis === "x" ? along : axA === "x" ? crossA : crossB,
      d: axis === "y" ? along : axA === "y" ? crossA : crossB,
      h: axis === "z" ? along : axA === "z" ? crossA : crossB,
    };
  });

  const AX = axis.toUpperCase();
  const reason = mode === "auto"
    ? `${round1(dim)}mm on ${AX} exceeds the usable bed → ${n} push-fit parts along ${AX}.`
    : `Print-in-parts version: ${n} push-fit parts along ${AX} (joins back into the whole).`;
  const c = connector;
  const guide =
    `Push-fit join (calibrated for FDM): ${c.positions.length} peg${c.positions.length > 1 ? "s" : ""} per seam, ` +
    `Ø${c.pegDiameter}mm pegs into Ø${c.socketDiameter}mm sockets (${c.clearance}mm clearance), ` +
    `${c.pegLength}mm engagement, ${c.chamfer}mm lead-in chamfer. Print all parts at the same layer height, ` +
    `then press the pegs straight into the sockets — no glue needed. Add a drop of CA glue for a permanent bond.`;

  return { mode, axis, parts, seams, connector, reason, guide };
}

/** Emit an OpenSCAD cylinder of diameter `d`, length `len`, whose base sits at `seam` and which grows in the
 *  +axis direction, centred at the in-plane position (a,b). Optionally adds a chamfered tip (peg lead-in). */
function cylAt(axis: Axis, a: number, b: number, seam: number, d: number, len: number, chamfer = 0): string {
  const body = chamfer > 0
    ? `union(){ cylinder(d=${d}, h=${round2(len - chamfer)}); translate([0,0,${round2(len - chamfer)}]) cylinder(d1=${d}, d2=${round2(Math.max(0.4, d - 2 * chamfer))}, h=${chamfer}); }`
    : `cylinder(d=${d}, h=${round2(len)});`;
  if (axis === "z") return `translate([${round2(a)}, ${round2(b)}, ${round2(seam)}]) ${body}`;
  if (axis === "x") return `translate([${round2(seam)}, ${round2(a)}, ${round2(b)}]) rotate([0,90,0]) ${body}`;
  return `translate([${round2(a)}, ${round2(seam)}, ${round2(b)}]) rotate([-90,0,0]) ${body}`; // axis === "y"
}

/** A big slab box (covers the whole cross-section, bounded [partLo,partHi] along the split axis). */
function slabBox(axis: Axis, bbox: BBox, partLo: number, partHi: number): string {
  const pad = 50;
  const x0 = round2(bbox.min.x - pad), y0 = round2(bbox.min.y - pad), z0 = round2(bbox.min.z - pad);
  const sx = round2(bbox.w + 2 * pad), sy = round2(bbox.d + 2 * pad), sz = round2(bbox.h + 2 * pad);
  if (axis === "z") return `translate([${x0}, ${y0}, ${round2(partLo)}]) cube([${sx}, ${sy}, ${round2(partHi - partLo)}]);`;
  if (axis === "x") return `translate([${round2(partLo)}, ${y0}, ${z0}]) cube([${round2(partHi - partLo)}, ${sy}, ${sz}]);`;
  return `translate([${x0}, ${round2(partLo)}, ${z0}]) cube([${sx}, ${round2(partHi - partLo)}, ${sz}]);`; // y
}

/** Build the OpenSCAD program for one part: model ∩ slab, + pegs on the top interface, − sockets on the bottom. */
export function buildPartScad(modelStlName: string, plan: SplitPlan, bbox: BBox, part: SplitPartPlan): string {
  const { axis, connector: c, parts } = plan;
  const isFirst = part.index === 0;
  const isLast = part.index === parts.length - 1;
  // embed = pegLength so the peg is half-buried in its own part (a solid weld), half protruding to mate.
  const embed = c.pegLength;
  const pegs = isLast ? "" : c.positions.map((p) =>
    cylAt(axis, p.a, p.b, part.hi - embed, c.pegDiameter, embed + c.pegLength, c.chamfer)).join("\n      ");
  const sockets = isFirst ? "" : c.positions.map((p) =>
    cylAt(axis, p.a, p.b, part.lo - 0.01, c.socketDiameter, c.socketDepth + 0.01)).join("\n    ");
  const body =
    `intersection(){\n    import("${modelStlName}");\n    ${slabBox(axis, bbox, part.lo, part.hi)}\n  }`;
  const withPegs = pegs ? `union(){\n    ${body};\n      ${pegs}\n  }` : body;
  const program = sockets
    ? `difference(){\n  ${withPegs};\n    ${sockets}\n}`
    : `${withPegs};`;
  return `$fn=48;\n${program}\n`;
}

export interface RenderedPart { index: number; label: string; stlPath: string; w: number; d: number; h: number }

/**
 * Render every part to its own watertight STL via OpenSCAD. Writes the source mesh into `jobDir/model.stl`
 * and runs OpenSCAD with cwd=jobDir so `import("model.stl")` resolves. Each render is timed (rule 5).
 */
export async function renderSplitParts(modelStl: Buffer, plan: SplitPlan, jobDir: string): Promise<RenderedPart[]> {
  const tris = parseStlAuto(modelStl);
  if (!tris.length) throw new Error("couldn't read the model mesh to split");
  const bbox = boundingBox(tris);
  const modelName = "model.stl";
  await writeFile(path.join(jobDir, modelName), modelStl);

  const out: RenderedPart[] = [];
  for (const part of plan.parts) {
    const scad = buildPartScad(modelName, plan, bbox, part);
    const scadPath = path.join(jobDir, `part${part.index}.scad`);
    const stlPath = path.join(jobDir, `part${part.index}.stl`);
    await writeFile(scadPath, scad);
    await execFileP(OPENSCAD_BIN, ["-o", stlPath, scadPath], { cwd: jobDir, timeout: 120_000, maxBuffer: 16 << 20 });
    if (!existsSync(stlPath)) throw new Error(`part ${part.index + 1} produced no geometry`);
    out.push({ index: part.index, label: part.label, stlPath, w: part.w, d: part.d, h: part.h });
  }
  return out;
}
