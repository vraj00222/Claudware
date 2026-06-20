/**
 * Print-Readiness v2 — Stage B ORIENT (pure auto-orientation scorer).
 * Scores the 6 axis-aligned build orientations (+ as-modeled) by a weighted cost of overhang area and
 * z-height (lower = faster, less support) and recommends the best pose + a plain WHY. AUTO-APPLY is the
 * LOCKED decision; the user can still override via the viewport gizmo. A Tweaker-3 fork (convex-hull tilts)
 * is the future upgrade; the 6 axis-aligned poses are the high-value beginner lever.
 */
import { boundingBox, type Tri, type Vec3 } from "@/server/printPlan";
import { overhangFraction } from "./diagnose";
import type { OrientationPlan } from "@/lib/agentEvent";

type Euler = { x: number; y: number; z: number };

const CANDIDATES: { rot: Euler; label: string }[] = [
  { rot: { x: 0, y: 0, z: 0 }, label: "as modeled (upright)" },
  { rot: { x: 180, y: 0, z: 0 }, label: "flipped upside-down" },
  { rot: { x: 90, y: 0, z: 0 }, label: "laid on its back" },
  { rot: { x: -90, y: 0, z: 0 }, label: "laid on its front" },
  { rot: { x: 0, y: 90, z: 0 }, label: "laid on its left side" },
  { rot: { x: 0, y: -90, z: 0 }, label: "laid on its right side" },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

function rotateVec(v: Vec3, e: Euler): Vec3 {
  const d = Math.PI / 180;
  let { x, y, z } = v;
  const cx = Math.cos(e.x * d), sx = Math.sin(e.x * d);
  let ny = y * cx - z * sx; let nz = y * sx + z * cx; y = ny; z = nz;
  const cy = Math.cos(e.y * d), sy = Math.sin(e.y * d);
  let nx = x * cy + z * sy; nz = -x * sy + z * cy; x = nx; z = nz;
  const cz = Math.cos(e.z * d), sz = Math.sin(e.z * d);
  nx = x * cz - y * sz; ny = x * sz + y * cz; x = nx; y = ny;
  return { x, y, z };
}

const rotateTris = (tris: Tri[], e: Euler): Tri[] =>
  tris.map(([a, b, c]) => [rotateVec(a, e), rotateVec(b, e), rotateVec(c, e)] as Tri);

export function orient(tris: Tri[]): OrientationPlan {
  if (!tris.length) return { rotation: { x: 0, y: 0, z: 0 }, label: "as modeled", why: "No geometry to orient.", heightMm: 0, overhangFrac: 0 };
  const bb0 = boundingBox(tris);
  const refDim = Math.max(bb0.w, bb0.d, bb0.h) || 1;

  let best: { rot: Euler; label: string; cost: number; height: number; over: number } | null = null;
  for (const c of CANDIDATES) {
    const rt = rotateTris(tris, c.rot);
    const bb = boundingBox(rt);
    const over = overhangFraction(rt);
    // minimize support (overhang) first, then height (print time / stability). First-min-wins keeps the
    // as-modeled pose on ties, so we don't rotate a model that's already fine.
    const cost = over + 0.35 * (bb.h / refDim);
    if (!best || cost < best.cost - 1e-9) best = { rot: c.rot, label: c.label, cost, height: bb.h, over };
  }

  const b = best!;
  const pct = Math.max(0, Math.round(b.over * 100));
  const flat = b.rot.x === 0 && b.rot.y === 0 && b.rot.z === 0;
  const why = flat
    ? `It already sits well — lowest support and a stable base (${b.height.toFixed(0)}mm tall, ~${pct}% overhang).`
    : `${b.label} drops the height to ${b.height.toFixed(0)}mm and the overhang to ~${pct}%, so it needs the least support and prints faster.`;
  return { rotation: b.rot, label: b.label, why, heightMm: round1(b.height), overhangFrac: b.over };
}
