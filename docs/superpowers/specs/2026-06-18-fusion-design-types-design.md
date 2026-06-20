# Fusion design types — Assembly + Hybrid (design / approved, from Vraj)

**Status: BUILT (backend) — A1–A3 done, additive + TDD'd; tsc + 93 tests green. PENDING: live
assembly build (Vraj-side, Fusion on 27182) + the frozen-UI persist/per-part-download touch (needs a
"change the design" nod). See PROGRESS + DECISIONS [fusion-design-types].** Vraj showed Fusion's "What do you want to design?" dialog
(Part · Assembly · Hybrid · Drawing · Electronics Design · Electronics Library) and asked to bring
those capabilities into our product. After a scope pass we are building the subset that fits the
mission ("3D printing for beginners") and is actually scriptable through our Fusion engine.

## Scope decisions (Vraj,)
- **BUILD: Assembly Design + Hybrid Design.** Highest 3D-print value (multi-part prints, joints,
  the connector/decompose vision), fully scriptable via our adsk-over-HTTP-MCP Fusion engine.
- **Part Design — already shipped** (`generateFusion` builds a single part). Untouched.
- **DROPPED: Drawing** (2D dimensioned PDF) — low printing value; possible future stretch.
- **DROPPED: Electronics Design + Electronics Library** (PCB schematics/boards) — far from the
  3D-printing mission and Fusion Electronics is not meaningfully scriptable through our MCP.
- **UX = AUTO-DETECT** (Vraj's pick): no jargon, no picker. The Fusion engine decides single-part
  vs multi-component assembly from the prompt. No frozen-UI (`src/components`) change.

## The reframe
- Today: Fusion = **one part** → one STL.
- v2: Fusion = **a part OR a multi-component assembly**. An assembly builds several named components
  with real print clearances, exports a **combined preview + one STL per part + a parts manifest**,
  and persists the **part graph** on the version.

## Why this also moves the printing side
Print-Readiness Pipeline v2 (the unbuilt NEXT-FOCUS #4) headlines **Stage C2 — decompose a model into
printable PARTS, nest them on one plate, assemble**. Its cleanest input is a real **part graph**
("keep the un-joined named parts from generation"). Assembly Design *produces that part graph natively*
instead of cutting a blob. So this is the on-ramp to the print-readiness decompose work, not a detour.

---

## Architecture (fits the existing seams)

Assembly is a **build mode of the Fusion engine**, not a new engine (the engine set is LOCKED:
Auto · OpenSCAD · Blender · Fusion · NVIDIA). All new code lives in `src/server/fusion.ts` +
the generate route + the `ProjectVersion` type — **no frozen-UI touch**.

### 1. Mode detection — `classifyFusionBuild(prompt): "part" | "assembly"` (pure, TDD'd)
Keyword heuristic. Assembly triggers (case-insensitive): `hinge/hinged · lid · cap · cover · clip ·
snap/snap-fit · press-fit · drawer · enclosure (with|+) (cover|lid) · screw-on · threaded lid · gears
(that mesh|meshing) · articulated · modular · slots together · two-part/multi-part · swivel · removable ·
assembly · parts that …`. Default `"part"`. Fast, deterministic, testable. Claude's actual output (how
many components it built) remains the source of truth for the reported part count.

**Hybrid folds into the assembly path** — a Hybrid is just an assembly whose components are themselves
multi-feature parts, which Claude already produces. No separate code path.

### 2. Assembly script writer — `claudeFusionAssemblyScript(prompt, outDir, primer, base)`
Same hard rules as `claudeFusionScript` (import only `adsk.core, adsk.fusion`; `def run(_context)`;
new design doc first line; centimetre units = mm/10; no exception catching; Sonnet-pinned writer),
plus assembly-specific guidance:
- Create **multiple named components** (`rootComp.occurrences.addNewComponent`) — e.g. `body`, `lid`,
  `hinge_pin` — each a clean printable solid.
- Leave **~0.3 mm clearance** between mating faces so the printed parts actually fit (print tolerance).
- Position components in their assembled pose (for the preview), but keep them as **separate bodies/
  components** (for separate export).
- Do NOT add the export block — we append the multi-part export tail.

Reuses the existing **traceback→fix retry** (`claudeFusionFixScript`, bounded by `FUSION_FIX_RETRIES`)
unchanged — the assembly path is just a different writer feeding the same build/retry loop.

### 3. Multi-part export tail — `EXPORT_TAIL_ASSEMBLY(outDir)`
Appended to `run()`'s body. It:
- exports the whole root component → `<outDir>/model.stl` (the combined preview for the viewport),
- iterates `rootComp.occurrences`, exports each component's bodies → `<outDir>/part_<i>.stl`,
- prints `STL_OK <outDir>/model.stl` (the EXISTING parser `extractFusionStl` still works), and
- prints `PARTS_OK <json>` where json = `[{ "name": "...", "file": "part_1.stl" }, …]`.
All STL options match the part tail (ASCII, MeshRefinementMedium).

### 4. Parse + generate
- `extractFusionParts(message): { name: string; file: string }[]` (pure, TDD'd) — reads the `PARTS_OK`
  line; returns `[]` if absent (a part build, or a one-component assembly → treated as a single part).
- `generateFusionAssembly(req)` mirrors `generateFusion` (same MCP call + traceback→fix retry) but, on
  success, copies `model.stl` + every `part_<i>.stl` into the job dir and returns
  `{ stlPath /* combined */, parts: [{ name, stlPath }], source }`.

### 5. Route + persistence (generate route, Fusion branch)
- When the engine is Fusion (manual pick or Auto) AND `classifyFusionBuild(prompt) === "assembly"`,
  call `generateFusionAssembly`; else the existing `generateFusion`.
- Stream the **combined** `model.stl` as the `mesh` event (viewport builds it) — unchanged contract.
- Emit a `summary` like *"built as 3 printable parts: body · lid · hinge-pin"*; the per-part STLs are
  saved (local `/generated` + best-effort durable storage) on the version.
- Run the existing Print Brain (`buildPrintPlan`) on the combined STL — unchanged.
- The `source` (the assembly adsk script) is saved so a refine edits it parametrically, same as a part.

### 6. Persistence — `ProjectVersion.parts`
New optional field:
```ts
parts?: { name: string; meshUrl: string; storageUrl?: string }[];
```
Back-compatible (optional). This is the **part graph** that Print-Readiness v2 Stage C2 will consume
(decompose & nest). Reopen/refine preserve it.

---

## Scope guardrails (v1 of Assembly)
- **IN:** multiple components · ~0.3 mm mating clearances · combined preview STL · per-part STL export ·
  parts manifest · part graph persisted · refine-the-script-in-place · honest Fusion failure chips.
- **OUT (→ bridge into Print-Readiness v2):** working *articulated* joints (a print-in-place hinge that
  rotates), and **connector-library press-fits** for rejoining a *decomposed* model. The constitution
  reserves rejoin-connectors to the PRE-BUILT connector library (no freeform joint synthesis); a Fusion
  assembly's own designed relationships are CAD, not rejoin-connectors — but to stay safe, v1 ships
  *designed separate parts with clearances*, and articulation/connectors land with the decompose work.

## Constraints respected (constitution)
- Engine set LOCKED — Fusion stays one engine; assembly is a sub-mode (no new engine, no picker).
- No new dependencies (all adsk + the existing estimate/printplan/storage pipeline).
- Every external process runs in a subprocess WITH A TIMEOUT (`claude -p` timeout + MCP rpc timeout — unchanged).
- No `frontend/ · src/components/ · src/design/ · DESIGN.md` change (auto-detect; results via the existing
  feed/summary + Print Plan panel).
- Curl-verifiable end-to-end like the existing Fusion path (Fusion app + MCP on 27182 required for a live build).

## Testing
- `classifyFusionBuild` — pure unit tests (assembly prompts → "assembly", plain part prompts → "part",
  default, case-insensitivity).
- `extractFusionParts` — pure unit tests (valid `PARTS_OK` json → array; missing line → []; malformed → []).
- `EXPORT_TAIL_ASSEMBLY` — structural test (contains the per-occurrence export loop + both print lines).
- Live curl (Vraj/dev, Fusion running): "a small hinged box with a snap lid" → ≥2 parts, combined STL,
  per-part STLs, summary "built as N parts".

## Phasing
- **A1 — pure core:** `classifyFusionBuild` + `extractFusionParts` + `EXPORT_TAIL_ASSEMBLY` (TDD).
- **A2 — assembly generation:** `claudeFusionAssemblyScript` + `generateFusionAssembly` (reuse the retry).
- **A3 — route + persistence:** wire the Fusion branch + `ProjectVersion.parts` + summary "built as N parts".
- **A4 — handoff to print-readiness:** the persisted part graph becomes the decompose/nest input (v2).

## Related
- Fusion engine: `src/server/fusion.ts` · DECISIONS `[fusion]`, `[multi-engine]`, `[fusion-fix-retry]`.
- Print-Readiness Pipeline v2 (consumes the part graph): docs/superpowers/specs/2026-06-17-print-readiness-pipeline-v2-design.md.
- Constitution: engines locked; joints from a pre-built connector library.
