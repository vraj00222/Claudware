# Print-Readiness Pipeline v2 — design / future (captured, from Vraj)

**Status: DESIGN ONLY — nothing here is built yet.** This is the plan for turning generated models
(esp. organic figures like the "ant") into genuinely **print-ready** parts. It is the manufacturing
intelligence the mission promises ("the barrier isn't the printer — it's design expertise; we supply it").

## Why now — the gap
Print Brain **v1** (src/server/printPlan.ts) only **MEASURES + RECOMMENDS + exports ASCII STL**:
bbox → `analyzeOverhangs` (cone-angle face check) → `planSplit` (bbox vs bed) → `estimateFromStl`. It
never **TRANSFORMS** the mesh and only emits one format.

Motivating failure (Vraj,): a Blender **ant** — lovely shape — but **not printable as-is**:
thin legs/antennae (below a printable wall), overhangs under the body and legs, fragile leg↔body joints,
and the panel only says "~8% faces overhang → supports recommended." The user wants the agent to actually
work out **how to print it efficiently** and **remove the pain points** — and to choose **how it lies on the
bed** (flat vs upright), generate/visualize **supports**, and export in **3MF / G-code / more**, not just STL.

## The reframe
- **v1 = "here's what's wrong."**
- **v2 = "here's the print-ready file, here's how I'd print it, and here's why."**

---

## Decisions LOCKED (Vraj,)
- **Slicer = OrcaSlicer** (best Bambu support) for G-code + slicer-side supports/time/material.
- **Auto-orient = AUTO-APPLY** the best pose (override still available via the viewport gizmo). Don't ask.
- **Auto-thicken = JUST DO IT** — thicken thin features (the ant legs) to a printable wall without asking.
  *(Same "do it, don't ask" stance for the other safe repairs: weld, fill holes, remove floaters, make-manifold.)*
- **No live overlay.** The heat-map + supports + decomposition are NOT shown live while iterating. They appear
  when the user **finalizes an iteration and clicks "Prepare for print"** (see Trigger model). Cheap to re-run per
  iteration. This is why it does NOT conflict with the frozen-design rule — it's a deliberate, user-pressed step.

## Trigger model — "Prepare for print" (per iteration)
Generation/refine stays fast and clean (no print-prep noise). When the user is happy with a version, they press a
**"Prepare for print"** button on that iteration → the v2 pipeline runs (diagnose → orient → repair/thicken →
**decompose & nest** → supports → slice/export) and the results (oriented model, part layout on the plate,
heat-map, supports, downloadable 3MF/G-code, the "how I'd print it & why" narrative) attach to **that version**.
Iterate again → press it again on the new version. Each version can hold its own finalized print package.

## Pipeline (runs on "Prepare for print")

### Stage A — DIAGNOSE (the constitution's 4 checks, WITH locations)
Each check returns the **offending face regions** so the viewport can heat-map them (not just a boolean).
1. **Thin walls / thin features** — features below a printable minimum (≈2 perimeters, ~0.8 mm at a 0.4 nozzle).
   *(the ant legs/antennae fail here.)* Tools: Blender **3D-Print-Toolbox** thickness check / trimesh thickness
   sampling / manifold3d offset test.
2. **Non-manifold / breaks** — open edges, non-manifold edges, holes. Tools: trimesh `is_watertight`, toolbox, manifold3d.
3. **Overhangs / supports** — extend the existing cone check to per-region **area + severity + reachability**.
4. **Joints / clearance** — split-part seams (v1.1 connector library) + minimum feature/gap (tiny holes, trapped volume).
Plus: **floaters** (disconnected shells), **self-intersections**, **degenerate faces**, **detail below nozzle res** (tiny text).

Output: a **Print-Readiness score** + per-check green/amber/red with plain-language explanations and face regions.

### Stage B — ORIENT (auto best build orientation — the biggest beginner lever)
Score candidate orientations (convex-hull face normals + 6 axis-aligned + a few tilts) by a weighted cost:
- **support volume / overhang area** (minimize) · **footprint/bed-contact stability** (maximize, avoid tippy)
- **z-height → print time** (lower = faster) · **layer-line strength** across the likely stress axis (advanced)
- **show-face quality** (keep the nice face off the supports).
Output: recommended pose + a plain WHY ("lay the ant on its side so the legs don't each need a support tower").
**Fork Tweaker-3** (OSS auto-rotation) rather than hand-roll. **AUTO-APPLY** the rotation before export (LOCKED);
the user can still override via the viewport's existing TransformControls. *(For the ant: likely on its side with
tree supports, or — better — decomposed into parts each laid flat; see Stage C2.)* Orientation runs **per part**
once the model is decomposed (each part gets its own best pose on the plate).

### Stage C — REPAIR / PREP (JUST DO IT — auto, no asking; LOCKED)
All of these run automatically on "Prepare for print" and are reported (not gated) — show before/after, don't ask:
- **Safe:** weld doubles · recalc outward normals · fill small holes · remove floaters/tiny shells · make-manifold
  (manifold3d / toolbox). Re-export the cleaned STL; **keep the textured GLB for preview**.
- **Thicken** thin features to a printable min (solidify / voxel-remesh) — *the ant legs* — **automatically** (LOCKED).
- **Fillet** fragile joints (leg↔body) for strength.
- **Hollow + drain holes** for big solid models (save filament/time) — auto when it clearly helps; report the saving.
- **Flag** tiny text/detail that will be lost (report-only — can't be auto-fixed).
*(Vraj: "yes, don't ask, just do it." Everything here is reversible per-version, so auto is safe — the user sees
what changed and can still iterate.)*

### Stage C2 — DECOMPOSE & NEST (★ print a complex model AS PARTS, all on one plate) — Vraj
The headline new capability. A complex organic model (the ant) is GREAT as one shape but prints badly in one
piece (thin legs need towers of support, fragile spans snap). A maker prints it **as separate parts**, each
oriented to avoid supports, then assembles. The agent does this automatically and **shows the user the same ant
laid out as parts on ONE Bambu A1 plate, printed together in a single job**, then assembled.

**1. Decide whether to decompose.** Trigger when the whole-part print is support-heavy / has thin appendages /
   overhang-dominated, OR exceeds the bed. *(The ant qualifies on supports + thin legs even though it fits the bed.)*
   Three split strategies, picked by the agent:
   - **No split** — one piece prints fine (small, flat-bottomed, low overhang).
   - **Slab split** — only because it's bigger than the bed (the existing v1 `planSplit`, bbox→equal slabs).
   - **Part split** — *because parts print better separately* (NEW — the ant: body · head+antennae · leg clusters).

**2. Segment into printable sub-parts.**
   - **Cleanest path — keep the part graph from generation.** The Blender engine already builds named objects in
     stages (`base_body`, `add_head`, `add_features`) and only `join all` at the final merge. If we **retain the
     un-joined parts** (a "parts" twin of the joined preview), decomposition is essentially FREE and semantically
     correct (legs ARE separate objects). → design change: generation keeps both a joined preview mesh and the part list.
   - **Fallback for single-blob meshes** (TRELLIS): geometric segmentation — skeleton/convexity-based split, or
     planned boolean cuts at natural necks (leg sockets). Heavier; only when there's no part graph.

**3. Add connectors at the seams.** Press-fit pegs/sockets or registration pins from the **PRE-BUILT connector
   library** (constitution: no freeform joint synthesis) with real print tolerances (~0.2–0.4 mm clearance), so the
   ant snaps/glues back together. Where a press-fit doesn't fit, mark a **glue surface**. Each cut records its mating
   pair so assembly is unambiguous.

**4. Orient each part** (Stage B per part) for least support / best surface.

**5. NEST all parts on ONE build plate.** 2D bin-pack the parts' footprints onto the bed (Bambu A1 256×256) with
   spacing/brim margins. Tools: a packing lib (rectpack / nest2D / SVGnest-style) or trimesh packing. If they don't
   all fit one plate → multiple plates, shown in sequence. Output: a top-down **plate layout** the user can see.

**6. Show the user.** "Your ant prints best as **6 parts**. Here they are arranged on **one Bambu A1 plate**,
   printed together in a single job (~Xg · ~Yh), then **[press-fit / glued]** into the ant." Render the plate
   (all parts nested, flat) AND an **exploded→assembled** preview of how they recombine (ties into the
   "build animations" roadmap item).

**7. Export the plate as one job.** A single **multi-object 3MF** (all nested parts, OrcaSlicer-ready) → one sliced
   **G-code** = "printed all at once" on one plate. Per-part STL/OBJ also available.

**Events/arch:** new `decompose` (parts + seams + connectors + assembly map) and `plate` (bed arrangement, per-part
poses, plate count) AgentEvents; reuse `printplan`. Runs in the Blender headless path (bpy boolean + transforms) +
a Python packing sidecar — subprocess + timeout. **The mission literally names this**: "splitting, joints,
tolerances." v1's slab `planSplit` becomes one branch of this broader decomposer.

### Stage D — SUPPORTS (decide + generate + visualize)
- Decide **tree vs normal vs none** (tree for organic/figures like the ant; normal for flat overhangs; none if oriented well).
- Generate a support **preview** — either compute simple columns under unsupported overhang regions, or (better)
  hand off to the slicer and read back its support preview.
- **Visualize**: overhang heat-map (red faces) + ghosted support pillars in the viewport — shown **only after
  "Prepare for print"** (LOCKED: not live; user-pressed per iteration, so it doesn't fight the frozen-design rule).

### Stage E — SLICE + EXPORT (the concrete "3mf and more" ask)
Mesh formats via **trimesh / manifold3d**; G-code via **OrcaSlicer** (LOCKED — best Bambu support):
- **STL** (have it) — universal.
- **3MF** — modern: units + color + multi-object + print settings; **default for the Bambu A1** (also the format
  the decomposed multi-part plate ships as — Stage C2).
- **OBJ / GLB** — keep color/texture for figurines (STL throws the TRELLIS texture away).
- **STEP** — for the **Fusion** parametric parts (CAD interchange) — nice-to-have.
- **G-code** — sliced for **their** printer via **OrcaSlicer headless** (`orca-slicer --export-gcode`/`--slice`),
  Bambu A1 profile (real bed 256×256×256, nozzle 0.4, material). The real "print file." Slicer-side supports +
  real time/material. Edition-gated with a zero-binary fallback ("download 3MF, slice in OrcaSlicer yourself").
- **Printer profiles**: the UI already shows "BAMBU-A1 online" — drive the **real** bed/nozzle/profile from it
  (today the Print Plan hard-shows "Generic 220×220×250"). Time/material then become **real** (from the slicer),
  replacing the heuristic `estimateFromStl`.

### Stage F — UX / experience
- A **"Prepare for print"** button on each finalized version → opens the **Print Readiness** result for it.
- The result panel: **readiness score** + per-check status + **what the agent already DID** (auto-oriented,
  thickened legs, repaired N holes, split into 6 parts) — reported, not asked. Each auto-action has an **undo/toggle**.
- The **plate view**: all decomposed parts nested on one Bambu A1 plate (top-down) + an **exploded→assembled**
  preview of how they recombine. "Printed all at once, then [press-fit/glue]."
- The agent's **manufacturing narrative** — "Here's how I'd print this and why" — **the differentiator**.
- **Format buttons** on Download (STL / 3MF / OBJ / GLB / **G-code for Bambu A1**); the multi-part plate exports as one 3MF/G-code.
- **Before/after** for repairs (thicken legs, hollow); **per-orientation** time/material; "Explain it to me" per choice.

---

## Architecture notes (fit the existing seams)
- Keep `printPlan.ts` **pure** for measurement; the new mesh **transforms** (orient/repair/thicken/hollow/support)
  need a mesh backend → run in the **Blender headless** path (bpy + 3D-Print-Toolbox) and/or a **trimesh+manifold3d**
  Python sidecar (both already in the stack). **Every external process runs in a subprocess WITH A TIMEOUT** (rule 5).
- **New AgentEvents** (extend the contract; UI stays pure props-in): `printcheck` (per-check + regions),
  `orientation` (pose + why), `decompose` (parts + seams + connectors + assembly map), `plate` (bed arrangement,
  per-part poses, plate count), `support` (preview geometry/regions), `export` (formats + urls). Reuse the existing
  `printplan` / `tool` channels where they fit. All emitted under the **"Prepare for print"** action, not the build stream.
- **Keep the part graph at generation** (design change for the decomposer): the Blender engine should retain the
  un-joined named parts (body/head/legs) alongside the joined preview mesh, so Stage C2 decomposition is free and
  semantically correct. TRELLIS single-blobs fall back to geometric segmentation.
- **Key/edition-gated + fallback** (constitution): no slicer → 3MF + "slice in your slicer"; no Python mesh tools →
  STL-only + recommend. The app still boots/demos with zero extra installs.
- **Sponsors**: Anthropic writes the repair/orient **reasoning + narrative** (big Claude surface); Redis can stream
  slice progress; Sentry/Arize trace the pipeline.

## Phasing (don't ship it as one lump)
- **P0 — the "Prepare for print" button + shell:** a per-version action that runs the pipeline and attaches a
  result package to that version (even if early stages are stubs). Everything else hangs off this.
- **P1 — quick wins (mostly have the pieces):** 3MF + OBJ/GLB export (trimesh/manifold3d) · real **Bambu A1** bed
  profile · render the already-computable **overhang heat-map**. → immediately better, low risk.
- **P2 — diagnose + orient:** thin-wall + non-manifold checks **with regions** (Blender toolbox) · **auto-orient +
  auto-apply** (Tweaker-3 fork) + explain. → the ant gets diagnosed and oriented.
- **P3 — repair + ★decompose & nest:** auto repair/thicken/hollow (no asking) · **part decomposition + connector
  library + plate nesting + assembly preview** (Stage C2 — the ant as 6 parts on one plate) · tree-support preview.
- **P4 — real print:** **OrcaSlicer** headless → real **G-code** + real time/material (multi-part plate as one job)
  · "Send to printer" actually prints (Bambu A1 / OctoPrint / Moonraker) with the live job + cam.

## Decisions locked — see the "Decisions LOCKED" block up top
OrcaSlicer · auto-apply orientation · auto-thicken & auto-repair (don't ask) · no live overlay (per-iteration
"Prepare for print" button) · decompose complex parts and nest them on one plate.

## Remaining smaller questions (not blocking — decide when building)
- Connector style for press-fits: pegs+sockets vs registration pins vs dowel holes (from the connector library)?
- Decompose default granularity for the ant: each leg separate vs leg-clusters vs body+appendages? (start coarse.)
- TRELLIS single-blob segmentation method when there's no part graph (skeleton vs convexity vs planned cuts)?
- Thicken thin features **automatically** (changes the look slightly) or always **ask** first?
- Is the viewport overlay (heat-map + supports) an approved "change the design" for v2?

## Related
- Print Brain v1 spec: docs/superpowers/specs/2026-06-15-print-brain-v1-design.md
- ROADMAP "Printability intelligence" + "Print + hardware" sections (this consolidates + extends them).
- Constitution CHECKS: trimesh + manifold3d + Blender 3D-Print-Toolbox (the 4 checks).
