/**
 * Print-Readiness v2 — Stage A DIAGNOSE (pure geometry checks over triangles).
 * No I/O: takes parsed triangles, returns per-check status + a readiness score. Real checks where they
 * are cheap and correct (manifold via open edges, floaters via connected components, overhangs via face
 * normals); thin-features is a coarse per-shell heuristic until the Blender 3D-Print-Toolbox pass lands.
 * See docs/superpowers/specs/2026-06-17-print-readiness-pipeline-v2-design.md.
 */
import { boundingBox, faceNormal, type Tri, type Vec3, type BBox } from "@/server/printPlan";
import type { ReadinessCheck } from "@/lib/agentEvent";
import type { PrinterBed } from "./bed";

// Quantize a vertex so float noise (TRELLIS / CAD exporters) doesn't split shared vertices/edges.
const r3 = (n: number) => Math.round(n * 1000) / 1000;
const qk = (v: Vec3) => `${r3(v.x)},${r3(v.y)},${r3(v.z)}`;

/** Open edges = edges referenced by exactly one triangle (holes / cracks → not watertight). */
export function countOpenEdges(tris: Tri[]): number {
  const counts = new Map<string, number>();
  const ek = (a: Vec3, b: Vec3) => { const ka = qk(a), kb = qk(b); return ka < kb ? ka + "|" + kb : kb + "|" + ka; };
  for (const [a, b, c] of tris) for (const [p, q] of [[a, b], [b, c], [c, a]] as [Vec3, Vec3][]) {
    const k = ek(p, q);
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  let open = 0;
  for (const c of counts.values()) if (c === 1) open++;
  return open;
}

/** Bounding box of each connected shell (union-find on shared/quantized vertices). */
export function shellBBoxes(tris: Tri[]): BBox[] {
  const idOf = new Map<string, number>();
  const parent: number[] = [];
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a: number, b: number) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  const vid = (v: Vec3): number => { const k = qk(v); let i = idOf.get(k); if (i === undefined) { i = parent.length; parent.push(i); idOf.set(k, i); } return i; };

  const triVid0: number[] = [];
  for (const [a, b, c] of tris) {
    const ia = vid(a), ib = vid(b), ic = vid(c);
    union(ia, ib); union(ib, ic);
    triVid0.push(ia);
  }
  const groups = new Map<number, Tri[]>();
  for (let t = 0; t < tris.length; t++) {
    const root = find(triVid0[t]);
    const arr = groups.get(root);
    if (arr) arr.push(tris[t]); else groups.set(root, [tris[t]]);
  }
  return [...groups.values()].map(boundingBox);
}

/** Count of disconnected shells (1 = a single solid body; >1 = floaters / an assembly). */
export function countShells(tris: Tri[]): number {
  return tris.length ? shellBBoxes(tris).length : 0;
}

/** Fraction of faces that overhang steeply (downward-facing past coneDeg) AND float above the plate. */
export function overhangFraction(tris: Tri[], coneDeg = 45): number {
  if (!tris.length) return 0;
  const cos = Math.cos((coneDeg * Math.PI) / 180);
  let minZ = Infinity, maxZ = -Infinity;
  for (const t of tris) for (const v of t) { if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z; }
  const eps = Math.max(0.5, (maxZ - minZ) * 0.01); // bed-contact band (ignore the base itself)
  let over = 0;
  for (const t of tris) {
    const n = faceNormal(t);
    const cz = (t[0].z + t[1].z + t[2].z) / 3;
    if (-n.z > cos && cz > minZ + eps) over++;
  }
  return over / tris.length;
}

export interface Diagnosis { checks: ReadinessCheck[]; score: number; grade: "ready" | "minor" | "needs_work" }

/** The 4 constitution checks (+ floaters) as plain-language results + a 0–100 readiness score. */
export function diagnose(tris: Tri[], bed: PrinterBed): Diagnosis {
  const checks: ReadinessCheck[] = [];

  const open = countOpenEdges(tris);
  checks.push({
    id: "manifold", label: "Watertight",
    level: open === 0 ? "ok" : open <= 12 ? "warn" : "fail",
    detail: open === 0 ? "Closed, watertight mesh — no holes." : `${open} open edge${open === 1 ? "" : "s"} (holes/cracks) — the slicer may misread the inside vs outside.`,
    metric: open,
  });

  const shells = countShells(tris);
  checks.push({
    id: "floaters", label: "Single body",
    level: shells <= 1 ? "ok" : "warn",
    detail: shells <= 1 ? "One connected body." : `${shells} separate pieces — fine if intended (an assembly), but stray floaters won't print attached.`,
    metric: shells,
  });

  const frac = overhangFraction(tris);
  const pct = Math.max(1, Math.round(frac * 100));
  checks.push({
    id: "overhang", label: "Overhangs",
    level: frac < 0.05 ? "ok" : frac < 0.2 ? "warn" : "fail",
    detail: frac < 0.05 ? "No significant overhangs — likely prints support-free." : `~${pct}% of faces overhang steeply → supports (or a better orientation) needed.`,
    metric: frac,
  });

  const thinThresh = bed.nozzle * 4; // ≈1.6mm at a 0.4 nozzle (≈2 perimeters of safety)
  const thinShells = shellBBoxes(tris).filter((b) => Math.min(b.w, b.d, b.h) < thinThresh).length;
  checks.push({
    id: "thin", label: "Wall thickness",
    level: thinShells === 0 ? "ok" : "warn",
    detail: thinShells === 0 ? `No parts thinner than ${thinThresh.toFixed(1)}mm.` : `${thinShells} part${thinShells === 1 ? "" : "s"} thinner than ~${thinThresh.toFixed(1)}mm — fragile / may not print. (Coarse check; per-feature thickness comes with the Blender stage.)`,
    metric: thinShells,
  });

  const penalty = checks.reduce((s, c) => s + (c.level === "fail" ? 25 : c.level === "warn" ? 10 : 0), 0);
  const score = Math.max(0, 100 - penalty);
  const grade = score >= 85 ? "ready" : score >= 60 ? "minor" : "needs_work";
  return { checks, score, grade };
}
