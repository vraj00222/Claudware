# Print Brain v1 — design spec

Status: approved by Vraj. First of the "manufacturing brain" streams.
Constitution: this IS the core thesis — "the agent supplies the manufacturing cleverness; the
user just brings the idea." Touches EVERY generated model.

## Goal
After a model finishes generating, the app tells the user, in plain language:
1. **How big it is** — W×D×H in mm (real bounding box of the final mesh).
2. **Whether to print it in one go or split it** — compared against the target printer bed, with a
   plain-English reason.
3. **If split**: how many parts, each part's size, and a **seam preview** in the 3D viewport.
4. **Supports** — needed or not, one line of why (light overhang check).
5. **Download STL** — and it's saved with the project so they can print it later.

Decided scope: **recommend + preview only** (no actual mesh cutting, no press-fit joints in v1).
Cutting + press-fit joints + a connector library are v1.1/v2.

## Non-goals (explicit — v1.1+)
- Actually cutting the mesh into parts / laying parts on a plate.
- Press-fit pegs/sockets + the connector library (doesn't exist yet).
- 3MF export, real slicing, G-code.
- Printer/preset picker UI (v1 hardcodes one bed, easy to expose later).
- Claude-refined "smart seams" + the *preferred-even-if-it-fits* heuristic.
- Semantic / connected-component "branch" detection (v1 "parts" = geometric split slabs).
- Auto-orient-for-best-print; unit (mm/in) toggle.

## Step 0 — roof render bug (prerequisite, standalone)
Blender-engine houses (Blender is the default) build a roof that shows in Blender's GUI but is
**missing in the web viewport**. Root cause (confirm with a repro first): faces with **inverted
normals/winding** — Blender's solid viewport draws backfaces, but r3f's default
`MeshStandardMaterial` is single-sided (`FrontSide`), so reversed faces render invisible from outside.

Fix (server-side, no design change): in `wrapStage` (`src/server/blender.ts`), after converting
non-mesh objects and before export, recalculate outward normals on every mesh:
`bpy.ops.object.editmode_toggle()` → `bpy.ops.mesh.normals_make_consistent(inside=False)` (or the
bmesh equivalent) per mesh object. This also matters for Print Brain: flipped normals corrupt the
signed-volume estimate and the overhang check. Verify with a repro (generate a house, confirm the
roof appears) before/after.

## Architecture

### New pure module: `src/server/printPlan.ts`
Pure, fully unit-testable functions (no I/O):

- `parseStlTriangles(stl: string): Triangle[]` — single ASCII-STL parser returning triangles
  (3 verts each, + the facet normal when present). **Refactor `estimateFromStl` (openscad.ts) to reuse
  this** — it already half-parses for Z-bounds; this removes the duplicate parse, no behavior change.
- `boundingBox(tris): { w; d; h; min; max }` — Z-up convention (H = Z extent, W = X, D = Y).
- `analyzeOverhangs(tris, thresholdDeg = 45): { needed: boolean; reason: string }` — fraction of
  faces whose outward normal points downward more than the threshold from vertical → support flag.
- `planSplit(bbox, bed): { recommendation; reason; parts; seams }` — see decision logic below.
- `buildPrintPlan(stl, bed, urls): PrintPlan` — composes the above into the event payload.

### Decision logic (deterministic, v1)
- Bed default = **`{ w: 220, d: 220, h: 250, name: "Generic 220×220×250" }`** (Ender-class). Exported
  as a named constant so a picker can drive it later.
- For each axis, `over = dim > bedAxis - margin` (margin ≈ 2mm clearance).
- `recommendation = "split"` if any axis is over; else `"one_piece"`.
- Seams: for each over-bed axis, `n = ceil(dim / (bedAxis - margin))` equal cuts → `n-1` seam planes
  at evenly spaced positions; `parts` = the resulting slab sizes (combinatorial across over axes, but
  v1 splits the **single longest over-bed axis only** to keep parts legible — note this limitation).
- `reason` is templated from the facts, e.g. `"312mm wide > 218mm usable bed → 2 parts along X"` or
  `"Fits the bed in one piece."`. No LLM call on the hot path → zero added latency, fully testable.

### Data contract (rule 4 — flows as an AgentEvent)
Add to the `AgentEvent` union (`src/lib/agentEvent.ts`) and document in `ARCHITECTURE.md`:
```ts
| { t: string; kind: "printplan"; plan: PrintPlan }
```
```ts
export interface PrintPlan {
  dimensions: { w: number; d: number; h: number };          // mm, bbox (Z-up)
  bed: { w: number; d: number; h: number; name: string };
  recommendation: "one_piece" | "split";
  reason: string;                                            // human one-liner
  parts: { label: string; w: number; d: number; h: number }[]; // 1 entry if whole
  seams: { axis: "x" | "y" | "z"; at: number }[];            // cut planes (mm); [] if whole
  supports: { needed: boolean; reason: string };
  download: { stlUrl: string; storageUrl?: string };         // local + durable
}
```
The reducer (`viewModel`) handles `printplan` → `vm.printPlan`. UI stays pure (props in, JSX out) and
never computes geometry.

### Route integration: `src/app/api/generate/route.ts`
After the **final** stage STL is produced (both OpenSCAD and Blender paths), read that STL, call
`buildPrintPlan(stl, BED, { stlUrl, storageUrl })`, and emit a `printplan` AgentEvent after the last
`mesh` (and alongside/just before `summary`). Wrap in try/catch — a plan failure must never break a
good generation. Persist the plan on the project version (see below).

### Persistence: `src/lib/projects.ts`
Add `printPlan?: PrintPlan` to `ProjectVersion`. Studio saves it on the `printplan`/`summary` event so
reopening a project shows the readout and the Download STL button works later ("print later"). Download
prefers `storageUrl` (durable, cross-device) and falls back to the local `stlUrl`.

### UI — landing-page style (the "change the design" part)
Per Vraj: **all new UI uses the landing-page visual system**, not the existing Hardware Paper tokens.

- **New token group** in `src/design/tokens.ts` — `LAND`:
  ```ts
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
  Ensure Newsreader + Inter are loaded for the app (self-host or the same Google Fonts link the landing
  uses; the app already self-hosts JetBrains Mono).
- **`src/components/PrintPlan.tsx`** — pure component, landing style:
  - Card: bg `#f3efe6`, 1px `#e6dfd8`, radius 16px.
  - Eyebrow: Inter 500 / 12px / 1.5px tracking / uppercase / `#cc785c` → e.g. `PRINT PLAN`.
  - **Dimensions** row: mono, large, e.g. `312 × 90 × 140 mm`.
  - **Verdict**: Newsreader heading + reason line (`Too wide — prints as 2 parts` / `Fits in one piece`).
  - **Parts** list (when split): each part label + size.
  - **Supports** chip: needed/not + reason.
  - **Download STL** button: terracotta `#cc785c` (hover `#a9583e`), white text, radius 8px.
  - Placement: right rail, adjacent to the existing Print Center (Print Center keeps the
    grams/time/layers `estimate`; consolidation is a later polish).
- **Viewport seam preview** (`src/viewport` / Viewport component) — translucent cut planes at
  `plan.seams`, subtly styled (terracotta tint, low opacity), shown only when `recommendation === "split"`.
  This is the most novel addition; if it fights the forming animation it can be deferred without
  blocking the panel.
- Update **`DESIGN.md`** to document the Print Plan panel + the landing-token decision for new UI.

## Testing
- **TDD, vitest** for `printPlan.ts` (pure → easy):
  - `boundingBox` from a known small ASCII STL (a unit cube → 1×1×1 etc.).
  - `planSplit`: fits-whole; over on one axis (correct n + seam positions); over on two axes (splits
    longest, documents the limitation); exactly-at-bed edge case.
  - `analyzeOverhangs`: a flat-top box (no support) vs a downward-facing overhang (support needed).
  - `buildPrintPlan`: end-to-end payload shape + reason strings.
- **Reducer test**: a `printplan` event sets `vm.printPlan`.
- **Roof fix**: repro a house, confirm the roof mesh appears in the viewport after the normals fix
  (manual/curl; Vraj confirms visually).
- **PrintPlan panel + seam preview** = **Vraj tests visually** (per the no-Playwright-on-visual rule).
- Keep tsc + the existing 17 tests green.

## File-by-file
- `src/server/blender.ts` — Step 0 normals fix in `wrapStage`.
- `src/server/printPlan.ts` — NEW pure module (parse, bbox, overhangs, split, buildPrintPlan, BED).
- `src/server/openscad.ts` — refactor `estimateFromStl` to use `parseStlTriangles`.
- `src/lib/agentEvent.ts` — add the `printplan` event + `PrintPlan` type.
- `src/lib/viewModel` (reducer) — handle `printplan` → `vm.printPlan`.
- `src/app/api/generate/route.ts` — compute + emit `printplan` after final mesh (both engines).
- `src/lib/projects.ts` — `ProjectVersion.printPlan?`.
- `src/components/Studio.tsx` — persist printPlan on the version; pass `vm.printPlan` to the panel.
- `src/design/tokens.ts` — add `LAND` + `LAND_FONT`.
- `src/components/PrintPlan.tsx` — NEW pure panel (landing style).
- Viewport component — seam-plane preview (optional-within-v1).
- Docs: `ARCHITECTURE.md` (event + flow), `DESIGN.md` (panel + landing tokens), `DECISIONS.md`
  (landing-style for new UI; deterministic split; bed default), `PROGRESS.md`, `docs/ROADMAP.md`.

## Build order
1. Step 0 roof fix (repro → fix → verify).
2. `printPlan.ts` pure functions (TDD) + `estimateFromStl` refactor.
3. `agentEvent` + reducer + route emit + persistence (curl-verified).
4. `LAND` tokens + `PrintPlan.tsx` panel + Studio wiring (Vraj visual test).
5. Viewport seam preview (optional).
6. Docs sync.
