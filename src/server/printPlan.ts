/**
 * Print Brain — pure manufacturing analysis of a finished ASCII STL.
 * No I/O: takes STL text, returns a PrintPlan (dimensions, one-piece-vs-split, supports, download).
 * v1 = recommend + preview only (no cutting). See:
 *   docs/superpowers/specs/2026-06-15-print-brain-v1-design.md
 */
import type { PrintPlan } from "@/lib/agentEvent";

export interface Vec3 { x: number; y: number; z: number }
export type Tri = [Vec3, Vec3, Vec3];

const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number) => String(round1(n));

/** Parse an ASCII STL into triangles (vertices grouped 3-per-facet, in file order). */
export function parseStlTriangles(stl: string): Tri[] {
  const verts: Vec3[] = [];
  // NB: `-` is in the class so a negative exponent (e.g. -5.05151e-015, common from CAD
  // exporters) is captured whole; otherwise `+"-5.05151e"` → NaN poisons volume/estimate.
  const re = /vertex\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stl))) verts.push({ x: +m[1], y: +m[2], z: +m[3] });
  const tris: Tri[] = [];
  for (let i = 0; i + 2 < verts.length; i += 3) tris.push([verts[i], verts[i + 1], verts[i + 2]]);
  return tris;
}

/** Parse a BINARY STL (80-byte header + uint32 count + 50 bytes/triangle) into triangles. */
export function parseStlBinary(buf: Buffer): Tri[] {
  if (buf.length < 84) return [];
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = dv.getUint32(80, true);
  if (buf.length < 84 + n * 50) return [];
  const tris: Tri[] = [];
  let o = 84;
  const v = (off: number): Vec3 => ({ x: dv.getFloat32(off, true), y: dv.getFloat32(off + 4, true), z: dv.getFloat32(off + 8, true) });
  for (let i = 0; i < n; i++) { tris.push([v(o + 12), v(o + 24), v(o + 36)]); o += 50; }
  return tris;
}

/** Auto-detect: a binary STL's length is exactly 84 + count*50; otherwise treat as ASCII text. */
export function parseStlAuto(data: Buffer): Tri[] {
  if (data.length >= 84) {
    const n = data.readUInt32LE(80);
    if (data.length === 84 + n * 50) return parseStlBinary(data);
  }
  return parseStlTriangles(data.toString("utf8"));
}

export interface BBox { w: number; d: number; h: number; min: Vec3; max: Vec3 }

/** Axis-aligned bounding box (Z-up: H = Z extent, W = X, D = Y). */
export function boundingBox(tris: Tri[]): BBox {
  if (!tris.length) return { w: 0, d: 0, h: 0, min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const t of tris) for (const v of t) {
    if (v.x < min.x) min.x = v.x; if (v.y < min.y) min.y = v.y; if (v.z < min.z) min.z = v.z;
    if (v.x > max.x) max.x = v.x; if (v.y > max.y) max.y = v.y; if (v.z > max.z) max.z = v.z;
  }
  return { w: max.x - min.x, d: max.y - min.y, h: max.z - min.z, min, max };
}

/** Outward face normal from the triangle winding. */
export function faceNormal([a, b, c]: Tri): Vec3 {
  const ux = b.x - a.x, uy = b.y - a.y, uz = b.z - a.z;
  const vx = c.x - a.x, vy = c.y - a.y, vz = c.z - a.z;
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  return { x: nx / len, y: ny / len, z: nz / len };
}

export interface Supports { needed: boolean; reason: string }

/** Light overhang heuristic: near-horizontal downward "ceiling" faces NOT resting on the plate →
 *  supports. `coneDeg` = how close to straight-down a face must point to count (smaller = stricter,
 *  so gentle base rounding is ignored but a flat cap/eave underside is caught). */
export function analyzeOverhangs(tris: Tri[], coneDeg = 30): Supports {
  if (!tris.length) return { needed: false, reason: "No geometry to analyze." };
  const cos = Math.cos((coneDeg * Math.PI) / 180);
  let minZ = Infinity, maxZ = -Infinity;
  for (const t of tris) for (const v of t) { if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z; }
  const eps = Math.max(0.5, (maxZ - minZ) * 0.01); // bed-contact band
  let overhang = 0;
  for (const t of tris) {
    const n = faceNormal(t);
    const cz = (t[0].z + t[1].z + t[2].z) / 3;
    if (-n.z > cos && cz > minZ + eps) overhang++; // steep downward AND above the plate
  }
  const frac = overhang / tris.length;
  const needed = frac > 0.05; // light heuristic — needs a meaningful share of elevated downward faces
  return {
    needed,
    reason: needed
      ? `~${Math.max(1, Math.round(frac * 100))}% of faces overhang steeply → supports recommended.`
      : "No significant overhangs — likely prints support-free.",
  };
}

export interface Bed { w: number; d: number; h: number; name: string }
export const DEFAULT_BED: Bed = { w: 220, d: 220, h: 250, name: "Generic 220×220×250" };

export interface SplitResult {
  recommendation: "one_piece" | "split";
  reason: string;
  parts: { label: string; w: number; d: number; h: number }[];
  seams: { axis: "x" | "y" | "z"; at: number }[];
}

/** Deterministic: split the single longest axis that exceeds the usable bed into equal slabs. */
export function planSplit(bbox: BBox, bed: Bed, margin = 2): SplitResult {
  const axes = [
    { axis: "x" as const, dim: bbox.w, bed: bed.w - margin, min: bbox.min.x },
    { axis: "y" as const, dim: bbox.d, bed: bed.d - margin, min: bbox.min.y },
    { axis: "z" as const, dim: bbox.h, bed: bed.h - margin, min: bbox.min.z },
  ];
  const over = axes.filter((a) => a.dim > a.bed);
  if (!over.length) {
    return {
      recommendation: "one_piece",
      reason: `Fits the bed in one piece (${fmt(bbox.w)}×${fmt(bbox.d)}×${fmt(bbox.h)} mm).`,
      parts: [{ label: "whole", w: round1(bbox.w), d: round1(bbox.d), h: round1(bbox.h) }],
      seams: [],
    };
  }
  const worst = over.reduce((a, b) => (b.dim / b.bed > a.dim / a.bed ? b : a));
  const n = Math.ceil(worst.dim / worst.bed);
  const slab = worst.dim / n;
  const seams = Array.from({ length: n - 1 }, (_, i) => ({ axis: worst.axis, at: round1(worst.min + slab * (i + 1)) }));
  const parts = Array.from({ length: n }, (_, i) => {
    const d = { w: bbox.w, d: bbox.d, h: bbox.h };
    if (worst.axis === "x") d.w = slab; else if (worst.axis === "y") d.d = slab; else d.h = slab;
    return { label: `part ${i + 1}`, w: round1(d.w), d: round1(d.d), h: round1(d.h) };
  });
  const AX = worst.axis.toUpperCase();
  return {
    recommendation: "split",
    reason: `${fmt(worst.dim)}mm on ${AX} exceeds the ${fmt(worst.bed)}mm usable bed → ${n} parts along ${AX}.`,
    parts,
    seams,
  };
}

/** Compose a PrintPlan from already-parsed triangles (used by the import path for binary STLs). */
export function buildPrintPlanFromTris(
  tris: Tri[],
  bed: Bed,
  urls: { stlUrl: string; storageUrl?: string },
): PrintPlan {
  const bbox = boundingBox(tris);
  const split = planSplit(bbox, bed);
  const supports = analyzeOverhangs(tris);
  return {
    dimensions: { w: round1(bbox.w), d: round1(bbox.d), h: round1(bbox.h) },
    bed: { w: bed.w, d: bed.d, h: bed.h, name: bed.name },
    recommendation: split.recommendation,
    reason: split.reason,
    parts: split.parts,
    seams: split.seams,
    supports,
    download: { stlUrl: urls.stlUrl, storageUrl: urls.storageUrl },
  };
}

/** Compose the full PrintPlan event payload from a finished ASCII STL. */
export function buildPrintPlan(
  stl: string,
  bed: Bed,
  urls: { stlUrl: string; storageUrl?: string },
): PrintPlan {
  return buildPrintPlanFromTris(parseStlTriangles(stl), bed, urls);
}

export { round1 };
