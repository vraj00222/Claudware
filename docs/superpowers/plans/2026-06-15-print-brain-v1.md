# Print Brain v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a model generates, show its real size (W×D×H mm), decide print-in-one-go vs split-into-parts against the printer bed (with a plain reason + seam preview), flag supports, and offer a Download STL — surfaced in a new landing-styled "Print Plan" panel.

**Architecture:** One new pure server module (`printPlan.ts`) computes everything from the final ASCII STL. It rides a new `printplan` AgentEvent through the existing reducer → `vm.printPlan` → a pure `PrintPlan.tsx` panel (rule 4: UI never computes geometry). Scope = recommend + preview only; no mesh cutting, no joints. Step 0 fixes a Blender roof-render bug (flipped normals) that also corrupts the geometry math.

**Tech Stack:** Next.js (App Router, Node route) · TypeScript · vitest · react-three-fiber · Blender bpy (server) · OpenSCAD (server).

**Commit policy:** Vraj commits only when he asks (repo rule). Commit steps below are the natural checkpoints — the operator stages + reports, and commits only on Vraj's go-ahead. Never push.

**Spec:** `docs/superpowers/specs/2026-06-15-print-brain-v1-design.md`

---

### Task 0: Roof render fix (Blender normals)

**Files:**
- Modify: `src/server/blender.ts` (`wrapStage`, around the export block at lines 106–117)
- Test: `src/server/__tests__/blender.wrapStage.test.ts` (create)

Root cause: Blender-engine houses build a roof that shows in Blender's GUI but is invisible in the r3f viewport — faces with inverted winding render invisible under r3f's single-sided `MeshStandardMaterial`. Fix: recalculate outward-consistent normals on every mesh before STL export.

- [ ] **Step 1: Write the failing test** — `wrapStage` output must include a normals-recalc call.

```ts
// src/server/__tests__/blender.wrapStage.test.ts
import { describe, it, expect } from "vitest";
// wrapStage is module-private; export it for testing (Step 3 adds the export).
import { wrapStage } from "../blender";

describe("wrapStage", () => {
  it("recalculates outward normals before STL export", () => {
    const py = wrapStage("bpy.ops.mesh.primitive_cube_add()", "/tmp/x.stl");
    expect(py).toMatch(/normals_make_consistent/);
    // normals must be fixed BEFORE the export call
    expect(py.indexOf("normals_make_consistent")).toBeLessThan(py.indexOf("stl_export"));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server/__tests__/blender.wrapStage.test.ts`
Expected: FAIL — `wrapStage` is not exported / no `normals_make_consistent`.

- [ ] **Step 3: Implement** — export `wrapStage` and add the normals pass. In `src/server/blender.ts`, change `function wrapStage(` to `export function wrapStage(`, and insert this block immediately **before** the `# export every mesh as ONE ascii STL` comment (i.e. right after the non-mesh convert block, before `_meshes = [...]`):

```python
# Recalculate OUTWARD-consistent normals on every mesh. Blender's solid view shows backfaces,
# but r3f's single-sided material hides reversed faces (the missing-roof bug). Fix before export.
for _o in [o for o in bpy.data.objects if o.type == 'MESH']:
    try:
        bpy.ops.object.select_all(action='DESELECT')
        _o.select_set(True)
        bpy.context.view_layer.objects.active = _o
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    except Exception as _ex:
        print('NORMALS_FAIL', _ex)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server/__tests__/blender.wrapStage.test.ts`
Expected: PASS.

- [ ] **Step 5: Repro verify (manual, if Blender available)** — `npm run dev`, then:

Run: `curl -N -X POST localhost:3000/api/generate -H 'content-type: application/json' -d '{"prompt":"a small block house with a gable roof","engine":"blender"}' | grep -c mesh`
Expected: ≥3 mesh events; in `/app` the rendered house shows the roof. (Vraj confirms visually.)

- [ ] **Step 6: Commit** (on Vraj's go-ahead)

```bash
git add src/server/blender.ts src/server/__tests__/blender.wrapStage.test.ts
git commit -m "fix: blender STL export — recalc outward normals (roof invisible in r3f)"
```

---

### Task 1: STL parse + bounding box (+ refactor estimateFromStl)

**Files:**
- Create: `src/server/printPlan.ts`
- Modify: `src/server/openscad.ts` (`estimateFromStl`, lines 218–242)
- Test: `src/server/__tests__/printPlan.test.ts` (create)

- [ ] **Step 1: Write failing tests**

```ts
// src/server/__tests__/printPlan.test.ts
import { describe, it, expect } from "vitest";
import { parseStlTriangles, boundingBox } from "../printPlan";

// minimal ASCII STL: two triangles spanning a 10×20×30 box corner→corner is overkill;
// use 2 facets that together touch the extremes (0,0,0) and (10,20,30).
const STL = `solid t
 facet normal 0 0 1
  outer loop
   vertex 0 0 0
   vertex 10 0 0
   vertex 0 20 0
  endloop
 endfacet
 facet normal 0 0 1
  outer loop
   vertex 10 20 30
   vertex 0 0 30
   vertex 10 0 30
  endloop
 endfacet
endsolid t`;

describe("parseStlTriangles", () => {
  it("parses every facet as 3 vertices", () => {
    const tris = parseStlTriangles(STL);
    expect(tris).toHaveLength(2);
    expect(tris[0][0]).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe("boundingBox", () => {
  it("measures W×D×H from the extremes", () => {
    const bb = boundingBox(parseStlTriangles(STL));
    expect(bb.w).toBe(10);
    expect(bb.d).toBe(20);
    expect(bb.h).toBe(30);
  });
  it("returns zeros for empty geometry", () => {
    expect(boundingBox([])).toMatchObject({ w: 0, d: 0, h: 0 });
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/server/__tests__/printPlan.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `printPlan.ts` (parse + bbox + shared helpers)**

```ts
// src/server/printPlan.ts
/**
 * Print Brain — pure manufacturing analysis of a finished ASCII STL.
 * No I/O: takes STL text, returns a PrintPlan (dimensions, one-piece-vs-split, supports, download).
 * v1 = recommend + preview only (no cutting). See the spec for scope.
 */
import type { PrintPlan } from "@/lib/agentEvent";

export interface Vec3 { x: number; y: number; z: number }
export type Tri = [Vec3, Vec3, Vec3];

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Parse an ASCII STL into triangles (vertices grouped 3-per-facet, in file order). */
export function parseStlTriangles(stl: string): Tri[] {
  const verts: Vec3[] = [];
  const re = /vertex\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stl))) verts.push({ x: +m[1], y: +m[2], z: +m[3] });
  const tris: Tri[] = [];
  for (let i = 0; i + 2 < verts.length; i += 3) tris.push([verts[i], verts[i + 1], verts[i + 2]]);
  return tris;
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

export { round1 };
```

- [ ] **Step 4: Refactor `estimateFromStl` to reuse the parser.** In `src/server/openscad.ts`, add `import { parseStlTriangles } from "./printPlan";` at the top, then replace the body of `estimateFromStl` (keep the same signature + return) with:

```ts
export function estimateFromStl(stl: string, layerH = 0.2): PrintEstimate {
  const tris = parseStlTriangles(stl);
  if (tris.length < 1) return { grams: 0, minutes: 0, layers: 0, material: "PLA" };
  let minZ = Infinity, maxZ = -Infinity, vol6 = 0;
  for (const [a, b, c] of tris) {
    vol6 +=
      a.x * (b.y * c.z - b.z * c.y) -
      a.y * (b.x * c.z - b.z * c.x) +
      a.z * (b.x * c.y - b.y * c.x);
    for (const v of [a, b, c]) { if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z; }
  }
  const volMm3 = Math.abs(vol6) / 6;
  const height = Math.max(layerH, maxZ - minZ);
  const layers = Math.ceil(height / layerH);
  const grams = Math.max(1, Math.round((volMm3 / 1000) * 1.24 * 0.55));
  const minutes = Math.max(4, Math.round((volMm3 / 1000) * 3.2 + layers * 0.05));
  return { grams, minutes, layers, material: "PLA" };
}
```

> Note: this creates a circular-looking import (openscad ↔ printPlan), but printPlan imports only the `PrintPlan` *type* from `@/lib/agentEvent` and openscad imports a *function* from printPlan — no runtime cycle. If tsc complains, move `parseStlTriangles`/`Vec3`/`Tri` are already in printPlan; openscad importing them is one-directional.

- [ ] **Step 5: Run tests (printPlan + existing estimate test if any)**

Run: `npx vitest run src/server/__tests__/printPlan.test.ts && npx tsc --noEmit`
Expected: PASS + clean tsc.

- [ ] **Step 6: Commit** (on go-ahead)

```bash
git add src/server/printPlan.ts src/server/openscad.ts src/server/__tests__/printPlan.test.ts
git commit -m "feat: printPlan STL parser + bbox; estimateFromStl reuses it"
```

---

### Task 2: Overhang / supports analysis

**Files:**
- Modify: `src/server/printPlan.ts`
- Test: `src/server/__tests__/printPlan.test.ts`

- [ ] **Step 1: Write failing tests** (append)

```ts
import { analyzeOverhangs } from "../printPlan";

const up = (z: number): Tri => [ {x:0,y:0,z}, {x:10,y:0,z}, {x:0,y:10,z} ];     // normal +Z
const down = (z: number): Tri => [ {x:0,y:0,z}, {x:0,y:10,z}, {x:10,y:0,z} ];   // normal -Z

describe("analyzeOverhangs", () => {
  it("flags no support for an upward face", () => {
    expect(analyzeOverhangs([up(0), up(5)]).needed).toBe(false);
  });
  it("ignores the base (downward face resting on the plate)", () => {
    expect(analyzeOverhangs([down(0), up(0)]).needed).toBe(false);
  });
  it("flags support for an elevated downward face (ceiling/overhang)", () => {
    expect(analyzeOverhangs([up(0), down(20)]).needed).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run src/server/__tests__/printPlan.test.ts` → FAIL (`analyzeOverhangs` undefined).

- [ ] **Step 3: Implement** (append to `printPlan.ts`)

```ts
export interface Supports { needed: boolean; reason: string }

/** Light overhang heuristic: steep downward-facing faces NOT resting on the plate → supports. */
export function analyzeOverhangs(tris: Tri[], thresholdDeg = 45): Supports {
  if (!tris.length) return { needed: false, reason: "No geometry to analyze." };
  const cos = Math.cos((thresholdDeg * Math.PI) / 180);
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
  const needed = frac > 0.02;
  return {
    needed,
    reason: needed
      ? `~${Math.max(1, Math.round(frac * 100))}% of faces overhang steeply → supports recommended.`
      : "No significant overhangs — likely prints support-free.",
  };
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run src/server/__tests__/printPlan.test.ts` → PASS.

- [ ] **Step 5: Commit** (on go-ahead)

```bash
git add src/server/printPlan.ts src/server/__tests__/printPlan.test.ts
git commit -m "feat: printPlan overhang/supports heuristic"
```

---

### Task 3: Split decision (planSplit + DEFAULT_BED)

**Files:**
- Modify: `src/server/printPlan.ts`
- Test: `src/server/__tests__/printPlan.test.ts`

- [ ] **Step 1: Write failing tests** (append)

```ts
import { planSplit, DEFAULT_BED } from "../printPlan";

const bb = (w: number, d: number, h: number) =>
  ({ w, d, h, min: { x: 0, y: 0, z: 0 }, max: { x: w, y: d, z: h } });

describe("planSplit", () => {
  it("recommends one piece when it fits", () => {
    const p = planSplit(bb(100, 100, 100), DEFAULT_BED);
    expect(p.recommendation).toBe("one_piece");
    expect(p.seams).toHaveLength(0);
    expect(p.parts).toHaveLength(1);
  });
  it("splits the longest over-bed axis into fitting slabs", () => {
    const p = planSplit(bb(500, 90, 90), DEFAULT_BED); // 500 > 218 usable → ceil(500/218)=3
    expect(p.recommendation).toBe("split");
    expect(p.parts).toHaveLength(3);
    expect(p.seams).toHaveLength(2);
    expect(p.seams[0].axis).toBe("x");
    expect(p.parts[0].w).toBeCloseTo(500 / 3, 1);
  });
});
```

- [ ] **Step 2: Run to verify fail** — FAIL (`planSplit` undefined).

- [ ] **Step 3: Implement** (append to `printPlan.ts`)

```ts
export interface Bed { w: number; d: number; h: number; name: string }
export const DEFAULT_BED: Bed = { w: 220, d: 220, h: 250, name: "Generic 220×220×250" };

export interface SplitResult {
  recommendation: "one_piece" | "split";
  reason: string;
  parts: { label: string; w: number; d: number; h: number }[];
  seams: { axis: "x" | "y" | "z"; at: number }[];
}

const fmt = (n: number) => String(round1(n));

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
```

- [ ] **Step 4: Run to verify pass** — PASS.
- [ ] **Step 5: Commit** (on go-ahead)

```bash
git add src/server/printPlan.ts src/server/__tests__/printPlan.test.ts
git commit -m "feat: printPlan deterministic split decision"
```

---

### Task 4: PrintPlan type + buildPrintPlan composer

**Files:**
- Modify: `src/lib/agentEvent.ts` (add `PrintPlan` type + `printplan` event)
- Modify: `src/server/printPlan.ts` (add `buildPrintPlan`)
- Test: `src/server/__tests__/printPlan.test.ts`

- [ ] **Step 1: Add the `PrintPlan` type + event to `src/lib/agentEvent.ts`** (before `export type ToolEvent`):

```ts
export interface PrintPlan {
  dimensions: { w: number; d: number; h: number };
  bed: { w: number; d: number; h: number; name: string };
  recommendation: "one_piece" | "split";
  reason: string;
  parts: { label: string; w: number; d: number; h: number }[];
  seams: { axis: "x" | "y" | "z"; at: number }[];
  supports: { needed: boolean; reason: string };
  download: { stlUrl: string; storageUrl?: string };
}
```

And add a member to the `AgentEvent` union (after the `mesh` line):

```ts
  | { t: string; kind: "printplan"; plan: PrintPlan }
```

- [ ] **Step 2: Write the failing test** (append to printPlan.test.ts)

```ts
import { buildPrintPlan } from "../printPlan";

describe("buildPrintPlan", () => {
  it("composes dimensions, split, supports, and download urls", () => {
    const plan = buildPrintPlan(STL, DEFAULT_BED, { stlUrl: "/generated/x/final.stl" });
    expect(plan.dimensions).toEqual({ w: 10, d: 20, h: 30 });
    expect(plan.recommendation).toBe("one_piece");
    expect(plan.download.stlUrl).toBe("/generated/x/final.stl");
    expect(typeof plan.supports.needed).toBe("boolean");
  });
});
```

- [ ] **Step 3: Run to verify fail** — FAIL.

- [ ] **Step 4: Implement `buildPrintPlan`** (append to `printPlan.ts`)

```ts
import type { PrintPlan } from "@/lib/agentEvent"; // already imported at top — do not duplicate

export function buildPrintPlan(
  stl: string,
  bed: Bed,
  urls: { stlUrl: string; storageUrl?: string },
): PrintPlan {
  const tris = parseStlTriangles(stl);
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
```

- [ ] **Step 5: Run to verify pass + tsc** — `npx vitest run src/server/__tests__/printPlan.test.ts && npx tsc --noEmit` → PASS + clean.
- [ ] **Step 6: Commit** (on go-ahead)

```bash
git add src/lib/agentEvent.ts src/server/printPlan.ts src/server/__tests__/printPlan.test.ts
git commit -m "feat: PrintPlan type + buildPrintPlan composer + printplan event"
```

---

### Task 5: Reducer handles `printplan` → `vm.printPlan`

**Files:**
- Modify: `src/lib/viewModel.ts`
- Test: `src/lib/__tests__/viewModel.printplan.test.ts` (create)

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/viewModel.printplan.test.ts
import { describe, it, expect } from "vitest";
import { reduce, initialViewModel } from "../viewModel";
import type { PrintPlan } from "../agentEvent";

const plan: PrintPlan = {
  dimensions: { w: 10, d: 20, h: 30 }, bed: { w: 220, d: 220, h: 250, name: "x" },
  recommendation: "one_piece", reason: "fits", parts: [{ label: "whole", w: 10, d: 20, h: 30 }],
  seams: [], supports: { needed: false, reason: "none" }, download: { stlUrl: "/x.stl" },
};

describe("reduce printplan", () => {
  it("stores the plan on the view model", () => {
    const vm = reduce(initialViewModel, { t: "00:01", kind: "printplan", plan });
    expect(vm.printPlan).toEqual(plan);
  });
});
```

- [ ] **Step 2: Run to verify fail** — FAIL (`printPlan` not on ViewModel).

- [ ] **Step 3: Implement.** In `src/lib/viewModel.ts`:
  - Add to imports: `import type { AgentEvent, PrintPlan } from "./agentEvent";`
  - Add to the `ViewModel` interface: `printPlan: PrintPlan | null;`
  - Add to `initialViewModel`: `printPlan: null,`
  - Add a case in `reduce` (before the closing brace of the switch):

```ts
    case "printplan":
      return { ...vm, printPlan: e.plan };
```

- [ ] **Step 4: Run to verify pass + full suite** — `npx vitest run && npx tsc --noEmit` → all PASS + clean.
- [ ] **Step 5: Commit** (on go-ahead)

```bash
git add src/lib/viewModel.ts src/lib/__tests__/viewModel.printplan.test.ts
git commit -m "feat: reducer handles printplan event"
```

---

### Task 6: Route emits `printplan` after the final mesh

**Files:**
- Modify: `src/app/api/generate/route.ts`

- [ ] **Step 1: Track the final mesh's public URL.** In the build loop (around line 152), add `let lastMeshUrl = "";` next to `let lastStl = "";`. Inside the loop where `lastStl = stl;` is set (line 168), add `lastMeshUrl = \`/generated/${jobId}/stage${i}.stl\`;`.

- [ ] **Step 2: Emit the plan.** Add imports at the top:

```ts
import { estimateFromStl /* existing */ } from "@/server/openscad";
import { buildPrintPlan, DEFAULT_BED } from "@/server/printPlan";
```

Then in the post-loop block, after the `estimate` send and the `durableUrl` line, before the final `summary` send, insert:

```ts
        if (lastStl) {
          try {
            const stlText = await readFile(lastStl, "utf8");
            const plan = buildPrintPlan(stlText, DEFAULT_BED, { stlUrl: lastMeshUrl, storageUrl: durableUrl });
            send({ t: ts(), kind: "printplan", plan });
          } catch { /* print plan is best-effort; never break a good generation */ }
        }
```

(Reuse the already-read STL if convenient; a second read is fine and keeps the diff local.)

- [ ] **Step 3: Verify (curl)**

Run: `curl -N -X POST localhost:3000/api/generate -H 'content-type: application/json' -d '{"prompt":"a 60mm cube","engine":"openscad"}' | grep printplan`
Expected: one `printplan` SSE line with `dimensions` ~ 60×60×60 and `recommendation:"one_piece"`.

Run (split): `... -d '{"prompt":"a 300mm wide flat bar 20mm tall","engine":"openscad"}' | grep -o '"recommendation":"[a-z_]*"'`
Expected: `"recommendation":"split"`.

- [ ] **Step 4: tsc** — `npx tsc --noEmit` → clean.
- [ ] **Step 5: Commit** (on go-ahead)

```bash
git add src/app/api/generate/route.ts
git commit -m "feat: generate route emits printplan after final mesh"
```

---

### Task 7: Persist the plan on the project version

**Files:**
- Modify: `src/lib/projects.ts` (`ProjectVersion`)
- Modify: `src/components/Studio.tsx` (handle the event; restore on load/pick)

- [ ] **Step 1: Add to `ProjectVersion`** in `src/lib/projects.ts`:
  - import: `import type { PrintPlan } from "./agentEvent";`
  - field (after `storageUrl?`): `printPlan?: PrintPlan | null;`

- [ ] **Step 2: Handle the event in Studio.** In `submitPrompt`'s stream callback (around line 200), add a branch alongside `estimate`:

```ts
      } else if (event.kind === "printplan") {
        upsertVersion({ printPlan: event.plan });
```

- [ ] **Step 3: Restore on reopen.** In `loadProject` (line 112) and `pickVersion` (line 254), extend the `dispatch({ type: "reset", vm: {...} })` view model to seed `printPlan`:
  - `loadProject`: add `printPlan: v?.printPlan ?? null,` to the reset vm.
  - `pickVersion`: add `printPlan: v.printPlan ?? null,` to the reset vm.

- [ ] **Step 4: tsc + tests** — `npx tsc --noEmit && npx vitest run` → clean + green.
- [ ] **Step 5: Commit** (on go-ahead)

```bash
git add src/lib/projects.ts src/components/Studio.tsx
git commit -m "feat: persist printPlan per project version; restore on reopen"
```

---

### Task 8: Landing-style tokens + fonts

**Files:**
- Modify: `src/design/tokens.ts` (add `LAND` + `LAND_FONT`)
- Modify: `src/app/globals.css` (load Newsreader + Inter — no new npm dep)

- [ ] **Step 1: Add tokens** to `src/design/tokens.ts` (after the `FONT` export):

```ts
/** Landing-page palette/fonts — used by NEW UI (Print Plan panel, etc.) per Vraj's design call. */
export const LAND = {
  cream: "#faf9f5", surface: "#f5f0e8", card: "#f3efe6",
  ink: "#141413", ink2: "#3d3d3a", ink3: "#6c6a64", muted: "#8e8b82",
  border: "#e6dfd8", borderStrong: "#d8cfc2",
  accent: "#cc785c", accentHover: "#a9583e", selection: "#e8d8cf",
} as const;

export const LAND_FONT = {
  serif: "'Newsreader', Georgia, serif",
  sans: "'Inter', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;
```

- [ ] **Step 2: Load the fonts** — add right after `@import "tailwindcss";` (line 1) in `src/app/globals.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500&family=Inter:wght@400;500;600&display=swap');
```

- [ ] **Step 3: Verify build** — `npx tsc --noEmit` → clean (CSS @import has no type impact; visual check happens in Task 9).
- [ ] **Step 4: Commit** (on go-ahead)

```bash
git add src/design/tokens.ts src/app/globals.css
git commit -m "feat: LAND tokens + Newsreader/Inter for new UI"
```

---

### Task 9: Print Plan panel (landing style) + Studio wiring

**Files:**
- Create: `src/components/PrintPlan.tsx`
- Modify: `src/components/Studio.tsx` (render the panel in the right rail)

- [ ] **Step 1: Create the pure panel** `src/components/PrintPlan.tsx`:

```tsx
"use client";
import { LAND, LAND_FONT } from "@/design/tokens";
import type { PrintPlan as Plan } from "@/lib/agentEvent";

const eyebrow: React.CSSProperties = {
  fontFamily: LAND_FONT.sans, fontWeight: 500, fontSize: 11, letterSpacing: 1.5,
  textTransform: "uppercase", color: LAND.accent, marginBottom: 10,
};

export function PrintPlan({ plan }: { plan: Plan | null }) {
  if (!plan) return null;
  const d = plan.dimensions;
  const split = plan.recommendation === "split";
  const dl = plan.download.storageUrl || plan.download.stlUrl;
  return (
    <div style={{ borderTop: `1px solid ${LAND.border}`, background: LAND.card, padding: 18, fontFamily: LAND_FONT.sans, color: LAND.ink }}>
      <div style={eyebrow}>Print plan</div>

      <div style={{ fontFamily: LAND_FONT.mono, fontSize: 18, letterSpacing: -0.3, color: LAND.ink }}>
        {d.w} × {d.d} × {d.h} <span style={{ fontSize: 12, color: LAND.ink3 }}>mm</span>
      </div>

      <div style={{ fontFamily: LAND_FONT.serif, fontSize: 18, lineHeight: 1.2, margin: "10px 0 4px", color: LAND.ink }}>
        {split ? `Prints best as ${plan.parts.length} parts` : "Prints in one piece"}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: LAND.ink2 }}>{plan.reason}</div>

      {split && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {plan.parts.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: LAND.ink2, borderBottom: `1px solid ${LAND.border}`, paddingBottom: 5 }}>
              <span>{p.label}</span>
              <span style={{ fontFamily: LAND_FONT.mono }}>{p.w}×{p.d}×{p.h}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: plan.supports.needed ? LAND.accentHover : LAND.ink3 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: plan.supports.needed ? LAND.accent : LAND.borderStrong }} />
        {plan.supports.reason}
      </div>

      <a href={dl} download
        style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", height: 44, borderRadius: 8,
          background: LAND.accent, color: "#fff", textDecoration: "none", fontWeight: 500, fontSize: 14 }}>
        Download STL
      </a>
      <div style={{ marginTop: 8, fontSize: 11, color: LAND.muted, textAlign: "center" }}>Bed: {plan.bed.name}</div>
    </div>
  );
}
```

- [ ] **Step 2: Wire into Studio.** In `src/components/Studio.tsx`:
  - import: `import { PrintPlan } from "./PrintPlan";`
  - In the right-rail `<div style={{ width: 340 … }}>` (line 317), add **after** `<PrintCenter … />`:

```tsx
          <PrintPlan plan={vm.printPlan} />
```

(Right rail already `display:flex; flexDirection:column` — the panel stacks under the Print Center; it returns `null` until a plan arrives, so nothing shows during boot/empty.)

- [ ] **Step 3: tsc + tests** — `npx tsc --noEmit && npx vitest run` → clean + green.
- [ ] **Step 4: Vraj visual test** — `npm run dev` → `/app` → generate a model → confirm the Print Plan panel shows dimensions, verdict, (parts if split), supports, and Download STL works. (Per the workflow rule, hand to Vraj — no Playwright.)
- [ ] **Step 5: Commit** (on go-ahead)

```bash
git add src/components/PrintPlan.tsx src/components/Studio.tsx
git commit -m "feat: landing-styled Print Plan panel + Studio wiring"
```

---

### Task 10: Viewport seam preview (OPTIONAL — defer if it fights the forming anim)

**Files:**
- Modify: `src/viewport/Viewport.tsx`, `src/components/Studio.tsx`

Approach (only if time): pass `seams={vm.printPlan?.seams ?? []}` and the model bbox into `Viewport`; for each seam render a translucent `planeGeometry` (terracotta `LAND.accent`, opacity ~0.18, `DoubleSide`, `depthWrite:false`) positioned at the seam `at` (mm) on the worst axis, sized to span the other two axes. The mesh in the viewport is scaled by 0.1 (matching the marker's `*0.1`), so multiply seam coordinates by 0.1 and orient the plane perpendicular to the seam axis. Show only when `vm.phase === "complete"` and `recommendation === "split"`. This is preview-only chrome — no test; Vraj eyeballs. If it conflicts with the forming clip-plane, ship Task 9 without it and revisit in v1.1.

- [ ] **Step 1:** Implement per the approach above.
- [ ] **Step 2:** Vraj visual check.
- [ ] **Step 3: Commit** (on go-ahead): `git commit -m "feat: viewport seam preview for split plans"`

---

### Task 11: Docs sync

**Files:**
- Modify: `ARCHITECTURE.md` (add the `printplan` event to the contract + a line in the flow), `PROGRESS.md` (move Print Brain from NEXT to DONE), `docs/ROADMAP.md` (check off measure/split/download; note cutting+joints remain).

- [ ] **Step 1:** Add to `ARCHITECTURE.md` "The contract" union: `| { t; kind:"printplan"; plan: PrintPlan }` and a sentence: "After the final mesh, the route emits `printplan` (dimensions, one-piece-vs-split vs a 220×220×250 bed, supports, download) → `vm.printPlan` → the Print Plan panel."
- [ ] **Step 2:** Update `PROGRESS.md` DONE + NEXT; update `docs/ROADMAP.md` printability-intelligence + "Shareable/export STL download" lines.
- [ ] **Step 3: Commit** (on go-ahead): `git commit -m "docs: Print Brain v1 — architecture + progress + roadmap"`

---

## Self-Review

**Spec coverage:** dimensions (Task 1) · split decision + reason (Task 3) · parts list (Tasks 3/9) · seam preview (Task 10, optional per spec) · supports (Task 2) · download STL (Task 9) · persistence/print-later (Task 7) · landing-style UI (Tasks 8/9) · roof fix Step 0 (Task 0) · deterministic split, default bed, STL-now — all covered. Out-of-scope items (cutting, joints, 3MF, printer picker, smart seams, semantic branches) correctly absent.

**Placeholder scan:** every code step has full code; commands have expected output. Task 10 is explicitly optional with a concrete approach (allowed as a stretch). No TBD/TODO.

**Type consistency:** `PrintPlan` defined once in `agentEvent.ts`, imported by `printPlan.ts` (server), `viewModel.ts`, `projects.ts`, `PrintPlan.tsx`. Field names (`dimensions`, `recommendation`, `parts`, `seams`, `supports`, `download.stlUrl/storageUrl`) match across the type, `buildPrintPlan`, the reducer test, and the panel. `DEFAULT_BED` used in the route + tests. `analyzeOverhangs`→`Supports`, `planSplit`→`SplitResult` consistent.
