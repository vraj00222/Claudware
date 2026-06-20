# DECISIONS — append-only (newest at top). Format: [hh:mm] choice — why.

[print-ready-ui] PRINT-READINESS v2 + ASSEMBLY UI WIRED (Vraj: "change the design and then change docs"
        — the explicit authorization to touch frozen src/components). Makes today's backend usable in /app: a
        **"Prepare for print"** button + a **Print-Readiness panel** in the right rail (below Print Plan, landing
        style `LAND`/`LAND_FONT` like PrintPlan). It's a DELIBERATE per-version action (not live → honors the
        no-live-overlay LOCK): press → playPrepareStream → /api/prepare → tool chips stream into the feed → the
        panel shows score/100 + grade, the 4 checks (colour-dotted), the recommended orientation + why, the
        decompose note, a plain narrative, and **STL/OBJ/3MF downloads** (3MF = the Bambu primary). Fusion
        ASSEMBLY builds also list **per-part STL downloads**; `parts` + `readiness` now persist on ProjectVersion
        (restored on reopen / version-switch). New: src/lib/agentStream.playPrepareStream · src/components/
        PrintReadyPanel.tsx · Studio.tsx (prepareForPrint + persistence + render) · DESIGN.md entry. STILL
        DEFERRED: the overhang heat-map VIEWPORT overlay (the spec's open design-change question) + the P3/P4
        Blender transforms / decompose geometry / OrcaSlicer. tsc + 115 tests green; /app + landing serve 200.

[print-ready-v2-backend] PRINT-READINESS v2 — BACKEND BUILT (Vraj picked it as the next build over
        Drawing/Electronics). The big unbuilt NEXT-FOCUS #4 ("the ant": great shape, not printable). Built the
        fully-ADDITIVE, TDD'd backend (no frozen-UI touch) per the LOCKED spec (docs/.../2026-06-17-print-readiness-
        pipeline-v2-design.md, DECISIONS [print-v2]): src/server/printReady/ — bed.ts (BAMBU_A1 256³ + 0.4 nozzle,
        the real printer the UI already shows) · diagnose.ts (REAL pure checks: manifold via open-edge count,
        floaters via union-find connected components, overhang fraction via face normals; thin-features = a coarse
        per-shell heuristic until the Blender-toolbox pass) → 4 checks + 0–100 score + grade · orient.ts (scores the
        6 axis-aligned poses by overhang+height → best pose + plain WHY; auto-apply is LOCKED, gizmo override later)
        · exportFormats.ts (OBJ + 3MF via a HAND-ROLLED stored zip + CRC-32 → NO new dep, rule 6; system `unzip`
        confirms the 3MF is a valid OPC package) · readiness.ts (composer: diagnosis+orient+DECOMPOSE decision
        [none/slab/parts — slab reuses v1 planSplit, "parts" recommends the decompose&nest next stage]+repairs
        REPORTED+a plain narrative). New `printready` AgentEvent + reducer + ViewModel.readiness (src/lib). New
        SSE endpoint POST /api/prepare (readMesh→diagnose→orient→write OBJ/3MF→stream printready+narrative; pure
        compute, no subprocess). tsc + 115 tests (22 new) green; curl + unzip verified end-to-end (box → readiness
        90/100 ready, 3 formats, valid 3MF). PENDING (frozen src/components — needs a "change the design" nod): the
        per-version "PREPARE FOR PRINT" button + the Print-Readiness result panel + the overhang heat-map overlay
        (the spec flags the viewport overlay itself as an open design-change question). DEFERRED to later phases
        (P3/P4): the Blender auto-thicken/repair TRANSFORMS (repairs are reported, not yet applied), real part
        DECOMPOSE & NEST geometry, and OrcaSlicer G-code. The Fusion ASSEMBLY part graph (ProjectVersion.parts)
        is the native input for the decompose stage. Phasing in the spec: P0 button shell + P1 export/bed + P2
        diagnose/orient are now COMPUTED; P3 repair/decompose + P4 slicer remain.

[fusion-design-types] FUSION DESIGN TYPES → build ASSEMBLY + HYBRID, AUTO-DETECTED (Vraj showed
        Fusion's "What do you want to design?" picker — Part/Assembly/Hybrid/Drawing/Electronics Design/Library —
        "add these all as a feature"). SCOPE PASS (the 6 are independent subsystems w/ very different fit): BUILD
        **Assembly + Hybrid** (high 3D-print value — multi-part prints, the decompose vision; fully scriptable via
        our adsk-over-HTTP-MCP). Part already shipped. DROPPED **Drawing** (low printing value) + **Electronics
        Design/Library** (PCB ≠ the 3D-printing mission, and Fusion Electronics isn't scriptable through our MCP).
        UX = **AUTO-DETECT** (Vraj's pick): the prompt decides part vs assembly — no picker, no jargon, NO frozen-
        UI change. Assembly is a BUILD MODE of the LOCKED Fusion engine, not a new engine. Build (src/server/
        fusion.ts, all additive + TDD'd pure core): classifyFusionBuild(prompt) (keyword, word-boundary so
        "solid"/"valid"≉"lid", "gear"≠"gears") → claudeFusionAssemblyScript writes several named components +
        ~0.3mm print clearances → EXPORT_TAIL_ASSEMBLY exports model.stl (combined preview) + part_<i>.stl (each
        component) + a PARTS_OK manifest → generateFusionAssembly copies them into the job dir + REUSES the
        traceback→fix retry. The generate route auto-routes the Fusion branch; the summary reads "built as N
        printable parts: …" + carries the part graph (ProjectVersion.parts). HYBRID folds into the assembly path
        (no third code path). ★ This part graph is the NATIVE input for Print-Readiness v2 Stage C2 (decompose &
        nest) — so Assembly also advances the printing side. Spec: docs/superpowers/specs/2026-06-18-fusion-design-
        types-design.md. tsc + 93 tests (10 new pure) green; existing OpenSCAD stream regression-verified.
        PENDING (deferred — frozen src/components): persisting parts onto the saved version + per-part downloads
        = a ~1-line Studio.tsx summary-handler touch → needs a "change the design" nod (dovetails w/ the print-
        readiness decompose panel). LIVE assembly build = Vraj-side (Fusion running on 27182).
 ★ SPEED FIX (Vraj: "a small hinged box with a snap lid" FAILED at 03:20 = the 200s writer
        timeout). ROOT CAUSE (systematic-debugging, TIMED standalone, NOT concurrency): the first assembly
        brief was too demanding — it pushed Sonnet to model a real WORKING hinge + assembled positioning →
        ~170 lines, **230.9s** standalone → past the 200s `claude -p` limit. FIX = a LEAN brief (2–3 SIMPLE
        parts that just FIT together with ~0.3mm clearance, no working mechanism, ~90-line cap, drop the heavy
        cad-modeling primer for this path — printability folded inline) → a valid 2-component assembly in
        **26.4s** (≈9× faster, well under the limit; also moots the session-start starve for assemblies). This
        is the v1 scope anyway (separate printable parts + clearances; articulation deferred). Verified by
        timing the real writer call; tsc + 93 tests green.

[print-v2] PRINT-READINESS PIPELINE v2 = TRANSFORM, not just measure (Vraj — after the "ant":
        great shape, not printable). Full plan: docs/superpowers/specs/2026-06-17-print-readiness-pipeline-v2-design.md.
        Direction pinned so it isn't re-litigated: (1) v1 stays the pure measure/recommend core; v2 adds mesh
        TRANSFORMS (orient/repair/thicken/hollow/supports) run in the Blender headless path (3D-Print-Toolbox)
        and/or a trimesh+manifold3d sidecar — subprocess + timeout, key/edition-gated + fallback (constitution).
        (2) EXPORT FORMATS via trimesh/manifold3d for mesh (STL/3MF/OBJ/GLB/STEP) + a FORKED slicer CLI for
        G-code (OrcaSlicer/Prusa/Bambu headless) — 3MF is the default for Vraj's Bambu A1; STL-only fallback if
        no tools. (3) AUTO-ORIENT by forking Tweaker-3 (don't hand-roll) scored on support/stability/height/
        strength. (4) New AgentEvents printcheck/orientation/decompose/plate/support/export; UI stays pure props-in.
 LOCKED (Vraj): slicer = ORCASLICER (Bambu); orientation AUTO-APPLIES (don't ask); repairs incl.
        THICKEN thin legs AUTO — "just do it, don't ask" (reversible per-version); NO live overlay — heat-map/
        supports/decomposition run on a per-iteration "PREPARE FOR PRINT" button + attach to that version (so it
        does NOT fight the frozen-design rule — deliberate user press). ★ NEW: DECOMPOSE complex models into
        printable PARTS (the ant → body/head/legs as separate objects; keep the un-joined part graph from
        generation) + connectors from the PRE-BUILT library + NEST all parts on ONE Bambu A1 plate (printed
        together in one job) + exploded→assembled preview; v1's slab planSplit becomes one branch of this. Phased
        P0(button shell)→P1(formats+Bambu bed+heat-map)→P2(diagnose+auto-orient)→P3(auto-repair/thicken +
        decompose+nest+assembly)→P4(OrcaSlicer G-code + real print).

[nvidia-refimg-ceiling] NVIDIA REFERENCE-IMAGE likeness is a DOCUMENTED CEILING, not a bug — retrying won't
 change it (reaffirmed, answering Vraj "is the reference image in NVIDIA not working, should I
        try again?"). By design we send Claude's VISION **text** description of the image to TRELLIS **text→3D**
        (NVIDIA's hosted image→3D 500s — see [refimg]). So a ref image GUIDES the look loosely + the "saw in
        image: …" chip proves it was read, but it will NOT reproduce a photo-accurate likeness. The real fix is
        an image-accepting provider (Rodin/Tripo/Meshy image→3D) or self-hosted TRELLIS image→3D — future, see
        the [refimg]/[clawd] entries + PROGRESS NEXT-FOCUS #1. TL;DR for Vraj: it "works" as guidance; don't
        expect likeness; no point retrying for accuracy.

[blender-model] BLENDER bpy plan writer pinned to Sonnet (BLENDER_CLAUDE_MODEL, default sonnet) +
        the Blender fallback is now a TRANSPARENT warn chip. ROOT CAUSE of "a snail with a spiral shell" coming
        out as the generic creature (stacked-sphere body + eyes/ears/feet) — and Vraj's key tell "it always
        happens when STARTING a new session, then once started it works": claudeBpyPlan was the ONLY engine
        plan-writer still on the session-default Opus (OpenSCAD + Fusion were already Sonnet-pinned). Opus reasons
        past the 240s `claude -p` limit on a hard organic prompt → ETIMEDOUT → fallbackBpyPlan (the hardcoded
        creature). It bit the FIRST generation worst because /api/classify (~8.5s) + /api/clarify fire their OWN
        concurrent claude -p at session start and STARVE the shared CLI, tipping the already-slow Opus plan over
        240s; later generations have no competing calls → succeed. EVIDENCE: the snail's build finished at the
        04:06 agent-clock = exactly the 240s timeout; Sonnet writes a valid 4-stage snail plan in 44.6s (well
        under the limit, parseable @@@STAGE). FIX = same lever as [openscad-model]/[fusion-model]: pin to Sonnet
        (blender.ts BLENDER_MODEL) + on a plan-write failure emit a `write_blender` WARN chip ("couldn't write a
        custom model (Claude ran past the time limit — try again) → generic stand-in shape") instead of burying
        "fallback" in a green done chip (the [failures] transparency rule; was a deferred candidate). The honest
        ceiling stays: a deeper fix is SERIALIZING the generate route so classify/clarify/generate don't share-
        starve claude -p (deferred — same note as [openscad-model]).

[fusion-honeycomb] FUSION "honeycomb pen holder did not work" = the SINGLE-SHOT CEILING saved (or not) by the
 ONE bounded retry, NOT a broken engine. Clean one-at-a-time repro via the real route: attempt
        1 FAILED at 02:31 (adsk script-correctness — patterned hexagons + shell on selected top faces is past what
        Claude writes correctly in one shot) → [fusion-fix-retry] fed the traceback back → attempt 2 EXPORTED at
        04:16 (21g, 450 layers, watertight STL). So with FUSION_FIX_RETRIES=1 the honeycomb DOES build — when run
        SOLO. Vraj's failure was almost certainly the same session-start/concurrency starve as [blender-model]
        (a competing generation slowing the shared claude -p so the writer or the fix times out). NO Fusion code
        change: the retry already rescues it. LEVERS if a patterned part still fails: FUSION_FIX_RETRIES=2 (one
        more traceback-fix attempt, +~100s) and run one generation at a time. The real fix is the same shared one
        — serialize the generate route. Documented so a future "honeycomb/pattern part failed" is recognized as
        the ceiling+retry, not a regression.

[openscad-model] OPENSCAD plan writer pinned to Sonnet (OPENSCAD_CLAUDE_MODEL, default sonnet). Vraj
        live-hit "OpenSCAD is having some issue": a threaded jar fell to the generic fallback block + render
        errors. ROOT (systematic-debugging): OpenSCAD itself is fine (deterministic box ✓; the jar ALONE built 5
        stages w/ real BOSL2 threads in 163s) — the failure was claudePlan timing out at the 200s claude -p limit
        (chip ran 00:00→03:20) → fallbackPlan, made worse by a concurrent NVIDIA generation starving the shared
        claude calls. FIX = the same Sonnet pin used for Fusion: Sonnet writes good BOSL2 ~2× faster, so complex
        mechanical prompts finish under the limit. VERIFIED: M10 bolt+nut on Sonnet → real M10×1.5 threaded_rod +
        threaded_nut + 0.4mm print clearance, 85s (was ~160s). This REVERSES the earlier [bosl2-parts]/[fusion-model]
        deferral ("left OpenSCAD on the default model to protect the verified bolt/gear quality") — the quality is
        now verified on Sonnet, and the timeout was the bigger risk. The honest ceiling stays: multi-part meshing
        ASSEMBLIES (planetary gear) are still the single-shot limit; and CONCURRENT generations still slow each
        other (shared claude -p) — the deeper fix is serializing the generate route (deferred).

[nim-500] NVIDIA NIM retries on a TRANSIENT 5xx/429, not just an empty artifact. ROOT of "NVIDIA
        did nothing": the hosted TRELLIS endpoint intermittently 500s under load (probed raw: 500/200/500), and
        requestGlb threw on any !res.ok → the empty-only retry loop never caught it → instant drop to the slow
        procedural blob. FIX (nim.ts): a 5xx/429 returns null (transient → the loop retries) while a 4xx still
        throws (a real request bug — retrying would only spin); 6 tries + light backoff (a 500 fails in ~1s, so
        retries are cheap), abort 220→280s. Lifts the ~1-in-3 hosted success rate to ~90%+ — the difference
        between a real textured figure and the fallback. Verified through live 500s.
[clean-glb] CLEAN-IN-BLENDER keeps the TEXTURED GLB as the on-screen preview. Vraj: "a fix with
        Blender, still not fixed" — the cleaned result came back colorless + blobby. ROOT (reproduced headless):
        the cleanup itself preserves geometry/scale EXACTLY (bbox in == out; decimate gate never fires on a TRELLIS
        mesh) — the bug was that the cleaned `mesh` event carried no glbUrl, so the reducer nulled it and the
        viewport fell from the smooth textured GLB to the bare gray low-poly STL (= BOTH "colorless" and "blobby").
        FIX: finish() takes a previewGlbUrl; the cleaned mesh re-emits the original textured GLB for PREVIEW while
        the cleaned STL stays the PRINT artifact. Decimate softened (150k→250k gate, 0.5→0.6) for the rare dense
        case. The "scale-up" report was default-120mm vs a different-sized prior version, not a clean bug (no rescale).
[fusion-fix-retry] FUSION feeds its runtime TRACEBACK back to Claude and retries once (FOCUS #3 — the
        ExtrudeFeatures.add single-shot ceiling). On a script-correctness failure (adsk traceback, NOT an MCP/conn
        error), claudeFusionFixScript (sonnet) gets the traceback + the broken script and repairs it; bounded by
        FUSION_FIX_RETRIES (default 1); re-appends the export block if the fix dropped it; the route surfaces an
        onStatus chip. This is the constitution's inspect→fix loop for Fusion. VERIFIED: an L-bracket that failed
        first attempt built on the retry (fixed script saved as the editable source). The honest "too complex /
        ran past the limit" timeout chip still covers the writer-timeout case; this covers the build-time case.
[clawd] CANONICAL named-subject descriptor stopgap (FOCUS #1c). Free TEXT→3D never sees reference
        pixels (NVIDIA image→3D 500s), so a named mascot is reinvented generically. canonicalDescriptor() (pure)
        returns a hand-written on-brand descriptor when the user explicitly NAMES the Claude mascot (clawd / claude
        code mascot / claude|anthropic … mascot — NOT a bare "claude"); enrichPrompt short-circuits to it. Also the
        NVIDIA path now surfaces Claude's vision description as a chip ("saw in image: …") so a ref-image read is
        VISIBLE (Vraj thought NVIDIA couldn't see the image). HONEST CEILING: TRELLIS still blobs a Clawd (inspect
        0.15) — this fixes the PROMPT/on-brand-ness, not photoreal likeness (that needs image→3D / an image provider).

[fusion-model] FUSION "Command failed / nothing built / no preview" (Vraj,) = the adsk-script
        WRITER timing out, NOT the engine. ROOT CAUSE (systematic-debugging, end-to-end repro): Fusion app +
        MCP proven healthy (port 27182 LISTEN, initialize→200 in <1ms); the SIMPLE cube built fully in 56s
        (Fusion ✓ STL ✓ upload ✓). So the failures were the COMPLEX prompts (bracket/NEMA17): Claude on the
        session-default model (Opus) reasons past the 200s `claude -p` limit while writing the adsk → execFile
        ETIMEDOUT → Node's cryptic "Command failed" → the script never reaches Fusion (no preview, nothing
        built). FIX (src/server/fusion.ts): (1) pin the script writer to a FASTER model — `claude --model
        sonnet -p` (env FUSION_CLAUDE_MODEL, default sonnet) — Sonnet writes adsk well and ~2× faster, so
        bracket-class parts finish under the limit; (2) describeClaudeFailure() turns a timeout into an HONEST,
        actionable chip ("too complex to write in one shot — Claude ran past the 200s limit; try fewer
        features / a simpler part / another engine") instead of "Command failed" (matches the [failures]
        transparency rule); (3) the route wraps the Fusion block → emits a `fusion_build` error chip + a
        summary so the loader clears. Timeout still 200s (env FUSION_CLAUDE_TIMEOUT_MS); sonnet finishing
        faster means we rarely hit it. CEILING stays HONEST: a true rib-monster (NEMA17) is still a single-
        shot limit — the real future fix is STAGING the adsk build like OpenSCAD/Blender. OpenSCAD's claude
        path has the SAME 200s ceiling on complex mechanical prompts (left on the default model for now to not
        risk the verified BOSL2 bolt/gear quality; same sonnet-pin available if wanted).

[nim-retry] NVIDIA NIM reliability — no more silent procedural blob on an empty result (Vraj: "NVIDIA did
        nothing"). ROOT CAUSE (live repro: Auto "a cat" → "nim returned no GLB artifact → procedural"): TRELLIS
        occasionally answers 200-with-EMPTY-artifact (or 202/async-queued) under load; the old code threw at once
        → procedural fallback → a generic blob, not the cat. FIX (src/server/meshgen/nim.ts): requestGlb() now
        handles the 202 case by POLLING the NVCF status endpoint (api.nvcf.nvidia.com/v2/nvcf/pexec/status/{reqid})
        until fulfilled, and generate() RETRIES up to 3× on a transient empty (same seed); a non-success
        finishReason (e.g. CONTENT_FILTERED) throws an HONEST reason instead of an empty. Abort 180→220s to fit
        the retries; the route's inspect→retry still sits on top. (Raw NIM verified 200/fulfilled/base64 for "a cat".)
[fusion-timeout] FUSION adsk claude call 120→200s (the same timeout-bomb fixed in OpenSCAD). A complex part
        (center bore + bolt-circle pattern + gusset ribs + fillets) makes Claude reason past 120s → the adsk
        script call ETIMEDOUT mid-write → "Command failed". 200s matches OpenSCAD/Blender. HONEST CEILING: a VERY
        complex one-shot adsk part can STILL exceed 200s (the NEMA17 motor-mount hit 201s, worsened by ~4
        concurrent claude -p calls slowing each other) — Fusion's reliable zone is moderately-complex parametric
        parts; a multi-feature monster is the single-shot ceiling (future: stage the build like OpenSCAD/Blender).

[bosl2-parts] OPENSCAD MECHANICAL PARTS now render (Vraj: "M8 bolt → a generic block / no threads"). ROOT
        CAUSE (systematic-debugging + render evidence): BOSL2's std.scad includes only the CORE — the part
        libraries (threading/screws/gears/bearings) are SEPARATE files. So `include <BOSL2/std.scad>` alone
        left threaded_rod()/spur_gear()/screw()/nut()/ball_bearing() as UNKNOWN modules, which OpenSCAD DROPS
        SILENTLY (a WARNING, not an error) → the bolt rendered as just its 48-facet hex head; a parse miss/
        timeout then fell to the generic block. FIX (src/app/api/generate/route.ts): ensureBosl2Parts() strips
        Claude's own BOSL2 includes and re-prepends the FULL set (std+threading+screws+gears+ball_bearings+
        linear_bearings) on any BOSL2 stage; the prompt now says the part libs are auto-included + gives the
        correct call signatures; the stage-accept gate also accepts pure-BOSL2 modules (a valid bolt can be
        screw()/nut() with NO cube/union → was dropped → "no stages parsed" → block); claudePlan timeout
        120→200s; renderStage returns "Ignoring unknown module" names → a warn chip (the openscad-skill's
        "warnings matter" lesson). VERIFIED via the route: M8 bolt+nut → 5 stages, real M8 threads, 10,288-facet
        STL (was 48 / a block). Installed mitsuhiko/agent-stuff@openscad (now available to Claude Code).
[viewport-clip] FLAT-TOP FLICKER fixed (Vraj: "top panel flickers as always"). The forming clip-plane settled
        at EXACTLY halfH = the model's top face, so the flat top's vertices straddled the clip boundary every
        frame → a shimmering z-fight, worst on flat parts (coaster, block). FIX: lerp the cut to halfH+2 so it
        settles just ABOVE the top → never coincident, no shimmer. (src/viewport/Viewport.tsx; visual — eyeball.)
[glb-version] A CLEANED/UNTEXTURED REFINE no longer reverts to the old texture (Vraj: "made v2 colorless in
        Blender, clicked v1 and came back to v2, it wasn't saved"). The mesh handler stored glbUrl = event.glbUrl
        ?? baseVer.glbUrl, so a "Clean in Blender" cleaned STL (no GLB) INHERITED the previous version's textured
        GLB; the viewport prefers GLB over STL → re-picking v2 showed the old COLORED model, not the colorless
        cleaned mesh the build had shown. FIX (Studio.tsx): store glbUrl mirroring the event; inherit the base
        GLB ONLY for a pure size-edit (same textured object, scaled). Stored state now == what re-pick renders.
[mushroom] "couldn't render" was TRANSIENT, not a code bug — re-ran clean (3 stages, 3 meshes, "model ready")
        with the live socket up; headless + live export paths both verified healthy (sphere + mushroom). Root
        cause = the live-Blender COLLISION Vraj already flagged: ONE Blender window driven by >1 thing at once
        (a parallel NVIDIA auto-import / a second Blender tab) corrupts execute_code → all stages fail. Mitigation
        is operational (run one Blender/NVIDIA at a time), so no speculative code change (no reproducible root cause).

[multi-engine] 4 SEPARATE ENGINES + AUTO ROUTING (Vraj: test OpenSCAD/Blender/Fusion/NVIDIA
        separately + as options/combos; fix the inconsistent "wow"). The picker is now
        [Auto · OpenSCAD · Blender · Fusion · NVIDIA] + a "Clean in Blender" toggle (AgentFeed — authorized
        design change). ROOT CAUSE of the inconsistency Vraj saw (mushroom-house great, Kratos a block):
        engine was DERIVED from `mode` AND persisted in localStorage, so once OpenSCAD was picked an organic
        prompt silently went to OpenSCAD → a block; meanwhile the "Blender" toggle secretly meant NVIDIA.
        FIX = engine is its OWN state (engineSel, default AUTO, no stale persistence); NVIDIA is its OWN
        engine (was hidden in Blender); Blender-primary is the real staged-bpy LIVE build. AUTO
        (engineRoute.classifyEngine, pure): character/organic→NVIDIA (wins over a stray mechanical word, so
        "luffy gear 2 pose" + "mushroom house" → NVIDIA), mechanical→OpenSCAD, "in blender/watch"→Blender,
        unknown→NVIDIA (a textured attempt beats a block); a manual pick always wins. REVERSES the CUT-list
        "multi-engine picker UI · Fusion".
[fusion] FUSION ENGINE via Fusion's OWN HTTP MCP (http://127.0.0.1:27182/mcp), driven straight from the
        Node backend (initialize→notifications/initialized→tools/call fusion_mcp_execute) — same spirit as
        the Blender socket, no Claude Code in the loop. Claude writes an adsk `run()` that builds in a NEW
        Fusion doc (watchable) + exports ASCII STL. UNITS: API is cm (1.0=10mm), but STL export is mm — so
        build at cm=mm/10 and the exported STL drops into our mm pipeline with NO rescale (keeps parametric
        precision; verified 4cm cube→40mm STL). The adsk script is the editable `source` (a refine edits it).
        Gotchas fixed live: adsk.cad doesn't exist (→adsk.fusion); a function-local `import adsk.*` poisons
        the whole run() scope (UnboundLocalError) so the export block must NOT re-import; failure JSON uses
        an `error` key (not `message`). Not-running → chip + Auto re-routes to OpenSCAD.
[failures] TRANSPARENT ENGINE FAILURES (Vraj: "if NVIDIA breaks show the user; if Blender doesn't work show
        the user"). Every engine/provider attempt emits a `tool` chip with the REAL reason — NVIDIA NIM
        ✓textured / ✗<reason>→procedural; Blender live-window / headless / NOT-CONNECTED; Fusion connected /
        NOT-RUNNING. No silent fallback. Reuses the existing AgentEvent tool channel (no new UI surface). For
        NVIDIA the route calls nimProvider DIRECTLY (not generateMesh's fan-down) so it can surface the exact
        error before falling to procedural.
[inspect] SELF-INSPECT→retry on the NVIDIA "wow" path (the constitution's inspect→fix, free + bounded).
        Render the STL→PNG (OpenSCAD import) → Claude vision scores likeness 0..1 → ONE retry (new seed +
        "accurate likeness" prompt) only when score<0.45. Fails OPEN (render/parse/vision miss never blocks a
        good model); DISABLE_INSPECT=1 turns it off for the demo clock. Honest ceiling stays: free TRELLIS
        text→3D is weak on specific named characters/poses — image→3D is the real unlock (endpoint 500s).
[skills] SKILLS UNDER THE HOOD = per-engine PRIMERS injected into the generation prompts (Vraj: "integrate
        skills with the prompt on the app side, not just dev"). src/server/skills.enginePrimer: Fusion←
        cad-modeling (feature order, fillets late, fully-constrained sketches, parametric dims), Blender←
        manifold/watertight/modifiers for printing, OpenSCAD←BOSL2; NVIDIA←promptEnrich (its skill is
        prompt-craft). Distilled to short constants on purpose (full SKILL.md per prompt = token-heavy).

[sizeedit] PURE SIZE EDITS SCALE THE EXISTING MESH (don't regenerate). For no-recipe models (meshgen/imported),
        "make it smaller/2x/80mm tall" is parsed (sizeEdit.ts) and applied as a deterministic scale via
        /api/transform — instant + perfectly faithful, because re-running TRELLIS would yield a DIFFERENT object.
        Mixed edits ("smaller AND add a hat") fall through to on-subject regeneration. Recipe models (OpenSCAD)
        still edit their script (keeps parametric editability). Emits the normal AgentEvents → saved as a v2.
[layout-fill] STUDIO IS FULL-BLEED (Vraj: "fill the empty space in the middle"). Replaced the fixed 1536×864
        scale-to-fit card with a flex column that fills the window edge-to-edge. The old card letterboxed on any
        non-16:9 window (the visible gap). Reverses the earlier scale-to-fit decision; the layout is flex-based
        (TopBar + flex:1 columns) so it adapts without the overflow that the first full-bleed attempt hit.
[openscad-defer] planOpenscad DEFERS MECHANICAL SUBJECTS to Claude+BOSL2. The deterministic primitive generator
        was hijacking complex prompts via substring matches ("engine BLOCK" → box, "CYLINDER head" → tube). A
        keyword guard (gear/engine/motor/bearing/thread/…) returns null so they get real BOSL2 detail; simple
        explicit shapes (box/house/cylinder) stay deterministic + instant.
[trellis-detail] TRELLIS sampling 25→50 (free detail knob, ~2× slower). Vraj wants more figure detail; this is the
        only free lever on TRELLIS quality. The real ceiling is still the model itself — a stronger provider
        (Rodin/Tripo/Meshy, gated on credits/keys) is the actual fix for organic detail.

[bosl2] OPENSCAD GETS BOSL2 (Vraj: "ambitious OpenSCAD that works" + "find OpenSCAD skills for better results").
        Plain OpenSCAD has no gears/threads, so even a successful claudePlan wrote crude cylinders (verified:
        "planetary gear set" → a plain tube). FIX = vendor BOSL2 (the de-facto OpenSCAD standard library) at
        tools/openscad-libs (gitignored, cloned), expose it to the render subprocess via OPENSCADPATH, and tell
        claudePlan it may `include <BOSL2/std.scad>` + use real primitives (spur_gear, threaded_rod, screw,
        ball_bearing, rounded cuboid/cyl…). Gear/thread renders are heavier → render timeout 20s→60s. VERIFIED:
        a herringbone-gear prompt now emits real spur_gear() geometry. This is OpenSCAD's sweet spot — mechanical/
        parametric parts. Freeform/organic + full assemblies (swiss-watch, V8) remain weak (claudePlan ceiling).
[refine-meshgen] A REFINE ON A MESHGEN/IMPORTED MODEL STAYS IN-PLACE (Vraj: "asked to change → made a new chat,
        no v2, unrelated result"). Meshgen (TRELLIS) has no editable recipe, so isEdit was false → a brand-new
        project + a vague regen from just the change. FIX: ANY open version refines into a new version on the SAME
        project (v2, continuous chat). With a recipe (OpenSCAD/bpy) the route edits it; without one we re-run the
        engine but re-send the ACCUMULATED subject + the change so the result stays the same object. Stored as
        ProjectVersion.prompt. HONEST LIMIT: TRELLIS can't do a precise in-place edit — "smaller" / feature-adds
        regenerate on-subject, not surgically. True in-place needs deterministic mesh transforms (size) or
        Blender-side ops (emboss text, etc.) — deferred to NEXT.
[viewport-fit] STL viewport NORMALIZES on-screen size (~70u) like the GLB path; OrbitControls widened (8–600) so
        big models frame + you can zoom in to inspect. Real mm live in the Print Plan panel, so normalizing the
        view doesn't hide true size. (src/viewport/ is not in the frozen RULE-3 set; this is a functional fix.)

[scale] MESHGEN OUTPUT IS ALWAYS SCALED (found during the full-state test). TRELLIS normalises every mesh to
        ~1 unit (≈1 mm), and the route only scaled when sizeMm>0 — but the clarify card's SKIP (and an un-picked
        size) send no sizeMm, so a beginner who skips got an unprintable 1 mm figure. FIX: meshgen always scales,
        defaulting to 120 mm (the clarify map's "medium / hand-size") when no size is given. The mission is
        printability, so a sensible real-world size is the correct-by-default behavior; an explicit size still wins.
[stl-parse] ASCII-STL parser must capture negative exponents. The vertex regex class `[\d.eE+]` omitted `-`, so
        `-5.05151e-015` (sci-notation near-zero, emitted by many CAD tools incl. Prusa parts) parsed to `-5.05151e`
        → `Number("…e")` = NaN → NaN volume → null grams/minutes on imports + affected generated STLs. Added `-`
        to the class + a regression test. (Number() coercion, used here, is stricter than parseFloat — hence NaN not 0.)

[refimg] REFERENCE IMAGES = Claude VISION → text→3D (NOT NVIDIA image→3D). Vraj wanted upload-a-reference +
         "find what it means" + super-detail. FINDING: NVIDIA's HOSTED TRELLIS image→3D 500s server-side even
         with the correct flow (cracked it: POST api.nvcf.nvidia.com/v2/nvcf/assets → PUT presigned S3 →
         infer with header `NVCF-INPUT-ASSET-REFERENCES` + body `image:"data:<ct>;example_id,<assetId>"`; that
         passes validation → 500). So instead: `describeImage` runs `claude -p` VISION on the image (CLI reads
         a local path — verified) → a detailed descriptor → folded into the prompt → the WORKING text→3D path.
         Upgrades make-with-AI too (describes the real thumbnail, not just the title). UI: 📎 in the input →
         /api/upload (saves to public/generated/uploads) → thumbnail chip → refImageUrl threads clarify→generate.
         Removed nim.ts's dead image-mode (inline b64) bloat. (image→3D can return if NVIDIA fixes the endpoint
         or we self-host TRELLIS / Run-on-RTX.)

[detail] DETAIL via Claude knowledge + enrichment (no web fetch yet). "find what claude/uni mascot means" =
         Claude already knows iconic subjects, so enrichPrompt + claudeQuestions describe canonical looks
         (Claude mascot → "chibi Clawd, rounded teardrop body…"; Kratos → Norse/Greek). enrichPrompt now writes
         a DENSE 60–100w structured descriptor (identity/form/color/material/features/accessories/pose/style);
         TRELLIS verified to accept ~90w → 200. Browserbase web-research for OBSCURE named entities = still NEXT.

[cleanup] BLENDER AUTO-CLEANUP of meshgen output (glbToStl): join → weld doubles (remove_doubles) → outward
          normals → decimate when >200k tris. Cleaner, more printable STL from the NIM GLB. Textured GLB preview
          stays the original. NVIDIA + Blender: the NIM GLB is also imported into the user's LIVE Blender.


[clarify-v2] CLARIFY QUESTIONS ARE NOW PROMPT-SPECIFIC (Vraj: "why is Kratos asked dragon questions"). The
          fixed figure template (scales/feathered/flying for every figure) was wrong for a named human. FIX:
          `/api/clarify` asks Claude (`claudeQuestions`, claude -p, 25s) for 1–3 questions tailored to the exact
          prompt (Kratos → look era/weapon/pose; dragon → scales/wings/pose), always appends the generic SIZE
          question, and falls back to the deterministic heuristic if Claude is unavailable. Verified live.

[enrich] PROMPT ENRICHMENT for DETAIL (Vraj: "why doesn't it come with detail"). Before meshgen, `enrichPrompt`
          (claude -p) expands the prompt + folded clarify prefs into a vivid ≤45-word visual description (iconic
          look/outfit/weapon/surface) → TRELLIS produces more faithful detail. Claude already knows named
          characters, so this is the lightweight "use a reference" — the HEAVY version (Browserbase fetches real
          reference IMAGES → image→3D) is NEXT, gated on resolving NIM's NVCF image-upload (hosted inline b64 → 422).
          Best-effort: falls back to the raw prompt. Surfaced as an `inspect_render` "researching the look…" step.

[nvidia-blender] NVIDIA + BLENDER (Vraj: "can we have nvidia + blender / see it in Blender"). After NIM generates
          the textured GLB, if the BlenderMCP socket is live we IMPORT it into the user's running Blender scene
          (`importGlbToLive` → execute_code import_scene.gltf) so they SEE/refine the NVIDIA mesh in Blender — the
          "watch in Blender" win without Rodin credits. Non-destructive (adds to the scene). Sets up future
          Blender-side cleanup/decimate/detail. Surfaced as a "opened in Blender — refine it there" feed row.


[meshgen] REAL text→3D for figures via a `src/server/meshgen/` provider seam (mirrors modelSearch). Root
          cause of the "every figure = same blob": the Blender path's `claudeBpyPlan` threw every time →
          hardcoded `fallbackBpyPlan` creature. FIX = replace the figure path with real meshgen, fan-down
          **Rodin (live in Blender) → NVIDIA NIM (cloud) → procedural (zero-key)**, key/availability-gated,
          first success wins (runProviders, DI-tested). The UI toggle stays [OpenSCAD|Blender]; under the
          hood the Blender/figure path is meshgen-first. OpenSCAD stays the default for mechanical parts.
          • NVIDIA NIM = Microsoft TRELLIS, endpoint `ai.api.nvidia.com/v1/genai/microsoft/trellis`, body
            `{mode:"text",prompt,seed,ss_sampling_steps,slat_sampling_steps}` → `{artifacts:[{base64:GLB}]}`
            (VERIFIED live; key `NVIDIA_NIM=nvapi-…`). GLB→ascii STL via headless Blender (`src/server/glb.ts`).
            Image→3D (refImageUrl) hosted schema needs NVCF asset upload (inline base64 → 422), so make-with-AI
            falls back to text→3D from the title rather than the procedural blob. (Edify 3D 4K finals = future.)
          • Hyper3D Rodin = drive the BlenderMCP addon socket (create_rodin_job→poll→import→export STL+GLB
            from the LIVE scene; user watches). Protocol verified from the addon source. The free-trial key
            currently returns API_INSUFFICIENT_FUNDS → cleanly fans to NIM; the live path works once the
            Hyper3D trial has credits (Vraj's end) or the addon is switched to FAL_AI mode.
          • TEXTURED PREVIEW: meshgen returns a GLB; the `mesh` event carries `glbUrl`/`textured`; the viewport
            renders it via GLTFLoader (scales/skin color) — STL stays the print artifact + Print Brain input.
            This is the authorized "change the design" viewport touch. ProjectVersion persists `glbUrl`.

[clarify] CLARIFY-FIRST before generating (PROGRESS ask-first). A pre-step `/api/clarify` (deterministic
          classifier + heuristic; never blocks) returns chip questions: figures/characters get surface
          (scales/feathered) + pose; EVERY prompt gets a size question. Answers fold into the prompt
          (`Preferences: …`); the size answer sets `sizeMm` → a post-meshgen scale step (`meshScale.ts`,
          pure+tested) makes the model the real size. FIXES the "vase 30cm→39mm" bug: verified 'vase'+300 →
          225×225×300mm + Print Brain split into 2 parts. Rides its own JSON channel (like search), so the
          AgentEvent build loop stays focused. New `ClarifyCard` (landing LAND/LAND_FONT tokens, chips+free-text+skip).

[search] "✨ MAKE WITH AI" for login-walled results (test-4 fix). Instead of a dead-end "View on {site}",
          walled results regenerate a printable textured version via meshgen (`playMakeWithAiStream` → /api/generate
          blender path). Reuses the whole import/estimate/print-plan path. Saved as an `imported`-style version w/
          attribution; no recipe → a refine regenerates fresh. (Browserbase-Sessions auth downloads still future.)

[skills] Searched the skills ecosystem for better generation (find-skills): candidates = sfkislev/flue@blender
         (1.9K), vladmdgolam/agent-skills@blender-mcp (1.1K), freshtechbro@blender-web-pipeline (1K),
         meshy-dev/meshy-3d-agent (374), fal-ai-community/skills@fal-3d (111, fal hosts Rodin). Modest install
         counts → PRESENTED to Vraj rather than auto-installed; install the useful ones on his ok.


[search] MODEL SEARCH = "reuse before regenerate" (Browserbase sponsor #6, Vraj-picked + live key). A found model is
         just an STL → once fetched it flows through the EXISTING estimate/print-plan/storage pipeline (no new
         viewport/persistence code). New only: a `ModelSearch` provider seam + Browserbase adapter + search UI.
         • Extraction = **Browserbase SDK `fetchAPI.create`** (v2.14, per the official Browserbase skill) — managed
           verified-browser + proxies + CAPTCHA fetch of the search PAGE; NO Playwright/Stagehand/second-LLM-key.
           One new dep (`@browserbasehq/sdk`, server-only). Key-gated (`BROWSERBASE_API_KEY`) with a zero-key curated
           fallback so the app still boots/demos (constitution). `BROWSERBASE_PROJECT_ID` also in .env.local (Sessions).
         • Sources = parallel fan-out (Promise.allSettled, merged/deduped), **Printables first** (public pages, no
           login wall to SEARCH, clean attribution). Printables embeds results as escaped App-Router flight JSON →
           parser unescapes + regexes the contiguous `id/name/slug` shape (robust to escaped OR clean input).
           thangs/thingiverse/makerworld scaffolded into the same fan-out (parsers TBD).
         • Search rides its OWN `SearchEvent` SSE channel (not the AgentEvent build union) — search is a pre-step, so
           AgentEvent + the viewModel reducer stay focused on the build loop. IMPORT, by contrast, emits the normal
           AgentEvents so the studio reuses its handler → imported model saved as `engine:"imported"` + attribution.
         • Imported = TERMINAL for editing (no recipe): refining one regenerates fresh (falls out of the existing
           isEdit logic, since base = source is absent). Print Brain still applies.
         • BINARY-STL support added to Print Brain (parseStlBinary/parseStlAuto + estimateFromTris/buildPrintPlanFromTris)
           — downloaded repo models are binary; the old parser was ASCII-only. trimesh isn't installed, so this is the
           way to make dimensions/supports/estimate work on imports. String APIs unchanged (generate route untouched).
         • Trigger = BOTH (Vraj): explicit "🔍 Find an existing model" (empty state + under-input link) AND a proactive
           smart-hint nudge via `/api/classify` (claude -p yes/no + keyword heuristic; never blocks generation).
         • IMPORTABILITY (the real-world constraint + the fix): free repos GATE downloads — Printables STLs are
           login-walled, Thingiverse is Cloudflare-walled (both confirmed via Browserbase fetch probes). So a live
           result usually has no fetchable STL. FIX (honest, robust, demoable): (1) a built-in LIBRARY of REAL,
           publicly-downloadable models (verified direct GitHub STLs — 3DBenchy + Prusa i3 parts) lives in fallback.ts
           and is MERGED FIRST into live results, so "Use this" always has working options; (2) cards are TRUTHFUL —
           "Use this" only when a direct `stlUrl` exists, else "View on {site} ↗" (no button that would silently fail).
           The library also IS the zero-key path. v1.1 = resolve auth'd live downloads (Browserbase Sessions/cookies)
           + fill the thangs/thingiverse/makerworld parsers so more live results become importable. (ROADMAP.)

[account] SIGN-OUT + /profile (PROGRESS NEXT #2, Vraj-planned). Sign-out reachable from the studio via a TopBar
          ACCOUNT PILL (avatar/initial + first name) → /profile, where Sign out lives (signOut() → `/`). Why a
          pill→/profile rather than a raw sign-out button in the bar: one entry-point also gives the asked-for
          /profile page (account + their projects) and avoids an accidental-logout footgun. TopBar edit kept
          MINIMAL + styled like the existing Projects pill (respects the frozen-design rule 3 in spirit; the
          NEXT item is the explicit authorization for the touch). TopBar stays a PURE props-in component — Studio
          resolves getCurrentUser() and passes `user`; UI doesn't import backend logic. Pill HIDDEN when not
          signed in so the zero-key/dev-skip demo stays clean. /profile reuses the /projects card grid + C/FONT
          tokens; guest/local case shows "local workspace" + a Sign-in CTA. signOut/getCurrentUser already in insforge.ts.

[claude-sdk] CURRENT Claude usage = `claude -p` CLI subprocess (zero API key; reuses Vraj's Claude Code auth),
          parsing @@@STAGE-delimited text. CORRECT for the zero-key constraint and it works — but it's the CLI,
          NOT the Anthropic/Agent SDK, so we don't yet have: (a) structured stage output (we string-parse), (b)
          model pinning (uses whatever Claude Code is set to; latest/best = Opus 4.8 `claude-opus-4-8`), or (c)
          the constitution's self-inspecting render→fix agent loop. UPGRADE PATH when a key is acceptable:
          Anthropic TS SDK `messages.create({ model:"claude-opus-4-8", output_config:{format:<stage JSON schema>},
          thinking:{type:"adaptive"} })` for robust structured stages, or the Agent SDK for vision-in-the-loop
          self-fix. DEFERRED — current path is fine for the demo (Anthropic still the core sponsor); revisit when
          wiring inspect→fix. (Verified via claude-api skill; today there are NO anthropic npm deps.)
[hunyuan] DROPPED (per Vraj, — removing bloat). We're committed to NVIDIA NIM (TRELLIS) +
          Blender cleanup for meshgen; Hunyuan3D is no longer a planned provider. (The BlenderMCP addon still
          exposes it if ever needed, but it's off our roadmap. Superseded by [meshgen].)

[design] GREEN → TERRACOTTA + LANDING-STYLE FOR NEW UI (per Vraj, explicit "change the design"). (1) Replaced
         ALL interface green with the landing "Start designing" button color: C.accent #00A44A→#cc785c,
         accentWeak #1F8F50→#a9583e, chip greens→terracotta tints (#F6ECE6/#E6CFC2), button ink #06120B→#fff
         (white on terracotta), forming/loader scanlines recolor via the C.accent token. tsc + 17 tests green.
         (2) DECISION: all NEW UI uses the LANDING palette/fonts (cream #faf9f5 · #f5f0e8 · #f3efe6 / ink
         #141413 / terracotta #cc785c·#a9583e / Newsreader + Inter), to be added as LAND/LAND_FONT tokens
         alongside the Hardware Paper `C` — starting with the Print Plan panel (Print Brain v1). DESIGN.md updated.

[brain] PRINT BRAIN v1 = recommend + preview (NOT cutting). After a model generates: show W×D×H mm (bbox),
        compare to a default 220×220×250 bed, decide one-piece-vs-split with a plain reason, preview seam
        planes, flag supports (light overhang check), and Download STL (saved with the project → print later).
        DETERMINISTIC split (bbox vs bed → equal slabs on the longest over-bed axis) — no LLM on the hot path,
        fully testable. Surfaced in a NEW "Print Plan" panel (landing style). Actual cutting + press-fit joints
        + connector library + 3MF/slicing + printer picker = v1.1+. Spec: docs/superpowers/specs/2026-06-15-
        print-brain-v1-design.md. Step 0 = fix the Blender roof (flipped normals → invisible in r3f's
        single-sided material; recalc outward normals in wrapStage before export).

[routing] `/` = LANDING (per Vraj "landing as default /"). next.config beforeFiles rewrite / → /landing.html
          keeps the URL clean while serving the static dc-page; src/app/page.tsx is a redirect() fallback; the
          studio lives ONLY at /app (behind AuthGate). So the funnel is / (landing) → /app (Google gate) → studio.
          Verified: GET / returns the landing markup. (Rewrites load at server start → restart dev after config.)
[persist] PROJECTS SAVE TO THE SIGNED-IN ACCOUNT. Studio + /projects resolve `getActiveStore()` (checks the live
          session): InsForge user → cloud DB (per-user RLS), else localStorage. Studio saves are async, SERIALIZED
          via a saveChain + JSON snapshot — REQUIRED because the per-stage upserts fire rapidly and the adapter's
          select-then-insert/update would otherwise double-insert (PK violation) on the first two concurrent saves.
          Reopen reads from the resolved store. meshUrl stays the local /generated path (works same-machine);
          storageUrl (InsForge) is the durable cross-device fallback (pending Storage CORS for the r3f loader).
[blender] BLENDER IS THE DEFAULT ENGINE (per Vraj). Studio `mode` defaults to figure→Blender; OpenSCAD is
          opt-in via the toggle. Why: the product's wow is organic/figures, and Blender builds live in the GUI.
[blender] BLENDER "taller not in app" ROOT CAUSE (systematic-debugging + curl evidence): NOT the backend —
          a real refine streams a genuinely taller STL (measured 63→124mm), and the reducer/Viewport handle
          mesh events correctly. The bug was Studio.tsx persistence: the per-stage re-read-merge effect raced
          and could drop/duplicate a version slot (also the v1/v2-loss + "new chat" reports). FIX = an
          authoritative `projectRef` mutated deliberately (contiguous append, never re-read-merge) + one
          persist(); viewing/switching versions never saves. Correct-by-construction, not a symptom patch.
[homepage] WIRE THE LANDING ADDITIVELY (Claude Design .dc.html, served as a STATIC page — not ported to React).
           Why static: it's a self-contained dc-runtime page (support.js + CDN GSAP/React.createElement +
           scroll animations); porting would risk the animations Vraj loves. Served at /landing.html (+ public/
           support.js + public/assets/); Studio stays at `/` (untouched, safe to demo) and ALSO mounts at `/app`
           behind AuthGate. Landing CTAs deep-link to /app. Flip `/`→landing only after assets + Google sign-in
           are confirmed. The landing's OWN look (Newsreader/Inter + terracotta #cc785c) differs from the app's
           Hardware Paper — kept as-is (Vraj's design); the AuthGate bridges in the app's tokens.
[auth] AUTHGATE IS RESILIENT: key-gated (no InsForge env → render app), and a "continue without signing in"
       dev-skip so a misconfigured Google OAuth app can NEVER block the demo. Google SPA flow (SDK auto-exchanges
       ?insforge_code on return to /app). pickStore()→InsForge persistence is wired AFTER sign-in is proven.

[insforge] FULL INSFORGE STACK (per Vraj: "auth + database + storage for a smooth demo"). One project
           `claude-hardware` in the **Pro org** (My Organization — has credits; the first create landed
           in the Free Personal Org → recreated in Pro, free one to be deleted from dashboard). Host
           f7c2td39.us-west.insforge.app. AUTH = **Google one-click** (Vraj's pick; oAuthProviders already
           had google+github enabled). OAuth auto-verifies email → sidesteps requireEmailVerification.
           SPA flow (root @insforge/sdk client auto-exchanges ?insforge_code) over the SSR-cookie flow —
           far less plumbing for a client-heavy app, fine for a demo. allowed_redirect_urls set to
           localhost:3000(/app) via config apply.
[insforge] SCHEMA = one `projects` table, the whole Project object in a `data` JSONB column (+ extracted
           title/updated_at for the gallery). Why not normalized version/message tables: the existing
           ProjectStore.save(Project) writes the whole object atomically; rows are a few KB (well under
           the JSONB caution threshold); 1:1 map = trivial adapter, zero UI churn. RLS authenticated +
           user_id DEFAULT auth.uid() so the client never sends user_id and can only touch its own rows.
[insforge] STORAGE = finished mesh → public `models` bucket, uploaded SERVER-SIDE (createAdminClient,
           admin key server-only) inside the generate route; durable URL rides the `summary` event. Per-
           stage build STLs stay LOCAL (/generated) for speed — only the final, persisted mesh goes to
           the cloud (one upload per version). try/catch → never breaks a good generation. Verified: admin
           upload → public URL fetches 200.
[insforge] SEQUENCING: built the backend (client, async adapter, storage upload, schema, env, docs) now,
           but DEFERRED the Studio.tsx rewire (async store + auth provider) until the Claude Design shell
           (landing → Google login → studio route + history) exists — that reshapes app routing, so wiring
           the component first = rework. DB can't be exercised until auth anyway (RLS = authenticated).
           Current pre-login app keeps the sync localStorage path untouched and fully working.
[insforge] ASYNC SEAM: ProjectStore stays sync for the live app; added `AsyncProjectStore` + `insforgeProjects`
           + `localProjectsAsync` + `pickStore(signedIn)` so the swap is a one-liner when the shell lands.

[blender] BLENDER MCP IS A CLAUDE *DESKTOP* EXTENSION, NOT A CLAUDE *CODE* MCP SERVER. The running
          `blender-mcp` process lives under Claude Extensions and is attached to Claude Desktop; this
          Claude Code session has zero blender-mcp tools. So instead of registering it in Claude Code
          (config + restart, GUI-driven, single-client), we drive the BlenderMCP addon's localhost
          socket (127.0.0.1:9876) DIRECTLY from the Node backend — `{"type":"execute_code",...}`. Why:
          (1) no Claude Code restart / no MCP plumbing; (2) the backend has to drive Blender for the web
          viewport anyway, so one socket gives BOTH the live GUI build (user watches) AND the STL export;
          (3) matches the constitution's "boots with zero keys / pluggable + fallback" — headless
          `blender --background --python` is the fallback when the socket's down. Requires the user to
          start the addon server in Blender (N-panel → BlenderMCP → Connect) for the live path.

[blender] BLENDER ENGINE shape mirrors the OpenSCAD path: Claude CLI writes a staged `bpy` script
          (@@@STAGE delimiter), each stage clears→builds→exports ASCII STL (ascii so estimateFromStl
          parses it; Z-up to match OpenSCAD STL). src/server/blender.ts. Reuses GenPlan/Stage (Stage.scad
          holds bpy for Blender). No deterministic Blender shapes — Claude-only, with a procedural
          metaball-blob fallback so it never hard-fails.

[engine] CHOOSE-BLENDER rides the EXISTING mode picker, not a new control: Parametric → OpenSCAD,
         Figure/Hybrid → Blender (Studio.engineFor). Why: a separate engine picker is on the CUT list
         and rule 3 freezes the design; the mode picker already exists and figure/organic↔Blender is the
         constitution's own mapping. (If a literal "OpenSCAD/Blender" label is wanted later, that's a
         "change the design" request.) `engine` already flowed prompt→stream→route; it's now acted on.

[refine] REFINE-IN-PLACE = edit, not regenerate. A prompt submitted while a project is open sends the
         current version's recipe as `base`; route asks Claude to MODIFY it (both engines) and returns
         the final recipe in the `summary` event (source+engine). Studio APPENDS a ProjectVersion
         (buildVersionIdx slot) so prior versions survive (v1,v2,…); VersionRail click loads a version
         AND sets it as the next refine base. The recipe is saved imperatively on `summary` because
         summary doesn't change vm.phase/mesh, so the reactive persist effect wouldn't re-fire for it.

[voice] VOICE = browser Web Speech API behind a `useSpeechToText` hook seam (zero keys, works now);
        Deepgram streaming drops in behind the SAME hook later (needs a backend WS proxy + key). Tap
        mic → live transcript → final auto-submits as a prompt. Why: fastest sponsor win, mic UI already
        existed, beginner-friendly. (Sponsor #2 of 6.)

[plan] NEXT sequence agreed with Vraj (fastest→slowest): voice ✓ → refine-in-place → Browserbase
       fetch-and-print → Blender engine. Vraj will resume in a fresh session via "continue from
       progress.md" — PROGRESS NEXT #1 has the refine-in-place build steps.

[workflow] NEW RULE (Vraj): for anything HE can test (UI/visual/layout/app behavior), DON'T verify
           with Playwright — finish it and ASK him to test & review. Keep using typecheck/tests/curl
           for non-visual correctness. (Reserve Playwright for things he can't easily check.)

[ux] WINDOW SIZE settled: scale-to-fit stage (logical 1536×864, scaled by min(w/W,h/H,1.25)*0.99,
     centered). After full-bleed kept over/under-shooting across his browser states, scale-to-fit is
     the robust answer — always fits, never overflows, fills ~95%. (Reverses the brief full-bleed try.)

[persist] PERSISTENCE behind a ProjectStore interface; localStorage impl now (zero-key, offline),
          InsForge later (same interface) per the stack's "key-gated adapter + fallback" rule. A
          generation auto-saves a Project (prompt + latest mesh url + estimate + steps). /projects
          gallery + reopen via /?project=<id>. Models/STLs stay server-side in public/generated.

[ux] FULL-PAGE (per Vraj "whole page not just in middle"): Scaler dropped the centered 1440×884
     fit-to-window card → fills the viewport (position:fixed inset:0). html/body viewport-locked
     (height 100%, overflow hidden). Empty viewport shows a "Your workspace" hint. "+ New" button in
     the TopBar resets to the empty state. NOTE: a stale Fast-Refresh state (from swapping the Scaler
     from a scaling component to a layout one) made it transiently overflow for Vraj — a hard refresh
     clears it; verified zero overflow at 1366×768 and 1920×1080.

[gen] Claude CLI staged generation now uses a `@@@STAGE <label> | <detail>` delimiter format, NOT
      JSON — OpenSCAD code is full of `[ ]` and newlines that broke JSON.parse, which is why
      "lego tree" fell back to a single generic block. Now arbitrary prompts build step-by-step
      ("a simple tree" → 5 stages). Generic fallback made multi-stage so even it shows steps.

[design] CHANGE THE DESIGN (per Vraj, explicit): sans typeface → **Bricolage Grotesque** (bold,
         characterful) replacing Space Grotesk — "too normal/AI"; base weight 500, tighter tracking.
         Removed the **Design Notes** panel and the **"PRINT CENTER"** tagline (noise). Print stats
         are now **dynamic** (grams/time/layers computed from the generated STL via estimateFromStl)
         — no more hard-coded "14g PLA · 1h 23m · 847 layers". Versioning kept subtle, "+" removed.
         DESIGN.md updated to match (it is the source of truth).

[fix] Viewport flicker: (1) top-view z-fight was the green forming **scanline** plane sitting
      coplanar with the model's top face → now hidden (visible=false) unless actively sweeping;
      (2) per-stage mesh swap → switched from Suspense `useLoader` to **imperative `STLLoader.loadAsync`**
      so the previous stage stays on screen until the next loads (no blank/flicker).

[plan] Persistence requested (per Vraj, → docs/ROADMAP.md, NOT yet built): refinements must edit
       the CURRENT model in place (not regenerate new); save all chats + models in their different
       states/versions; a profile page + a projects gallery page to revisit/continue past projects
       (like Claude Design). Likely InsForge (DB + storage + auth) behind the persistence adapter.

[plan] Future capabilities captured in docs/ROADMAP.md (per Vraj): Blender engine + animations,
       clarifying-questions-before-generating, supports (tree vs none) + infill strategy + part
       splitting/joints (ask user, Claude-Code style) + slice/layer preview + real printing +
       bolder type. Roadmap is the backlog; items move into PROGRESS when picked up.

[gen] REAL generation path = local `claude -p` CLI for arbitrary prompts (uses Vraj's Claude Code
      auth → ZERO API key), with a deterministic TS generator (house/box/cylinder) as the instant,
      offline fallback. Why: app must generate without keys; CLI avoids shipping an SDK/key and
      reuses existing auth. Verified: claude -p returns text; openscad renders a stage STL in ~0.12s.

[gen] Engine seam = `POST /api/generate` (Node runtime) streaming SSE of AgentEvents incl. a new
      `mesh` event {url,label,stage,totalStages}. UI consumes it via playAgentStream identically to
      mockStream (same AgentEvent contract). Each stage is a cumulative .scad → STL streamed to the
      viewport (step-by-step build) AND written to tools/_watch/model.scad so the native OpenSCAD
      app auto-reloads the same build. Generated STLs in public/generated/<job>/ (gitignored).

[ux] Removed the auto-playing phone-stand demo + the demo-harness footer (Vraj disliked the
     repeating demo / unnecessary static rendering). Boot now does a brief printer-loader self-test
     then lands on an empty "describe anything" state (hint + example chips). Empty viewport shows
     ONLY the print bed (no leftover fixture mesh).

[ux] Versioning made subtle (muted colors, no "+"; versions appear only as models are
     generated/edited). PrinterLoader (ASCII) + RenderLoader (PNG mascot, printer-loader.png) are
     the loading system (DESIGN.md §PrinterLoader) — boot + long renders.

[note] blender-mcp + a three.js-viewer MCP were added by Vraj but are NOT visible to the current
       Claude Code session (MCP servers load at session start) → needs a Claude Code restart.


[plan] SPONSORS = phased + UX-first (per Vraj): add ALL sponsors across the phase map, but never
       compromise the core loop (prompt→model→iterate→print) or the beginner-friendly UI/UX to do it.
       Priority by UX value: Deepgram VOICE ("speak your idea") is the standout sponsor UX win → wire
       first (Web Speech now, Deepgram behind a VoiceProvider). Sentry/Redis/Arize are infra → behind
       key-gated adapters at their phases. Claude Agent SDK is the brain → headlines Plan 02 (next).

[plan] MUST phase split into 2 executable plans, not one: Plan 01 = frontend shell on mockStream
       (demoable ~h2), Plan 02 = parametric engine + real agent loop behind agentStream. Why: each
       is independently working/testable software; the UI builds on mockStream so the real backend
       drops in behind the same AgentEvent seam with zero UI churn. Plan 01 at
       docs/superpowers/plans/2026-06-13-frontend-shell-mockstream.md.
[plan] Figure/organic generation + multi-part STUDIO explode are NOT in Plan 01 (they're the SHOULD
       Blender engine). Plan 01's figure/studio conductor drives the FEED only; viewport stays
       parametric. Avoids pulling bpy onto the MUST critical path.

[pre] BUILD RULE: maximize sponsor usage on EVERY task — annotate each task with the sponsors it
      can touch (Anthropic always-on; Deepgram/Sentry/Redis/Arize/Browserbase where they fit). Reuse > rebuild.
[pre] Design spec written + approved → docs/superpowers/specs/2026-06-13-claude-hardware-design.md.
[pre] STRETCH feature: "search existing free models first" (Thingiverse/Printables/MakerWorld/
      Thangs) and reuse if a good one exists — implement via Browserbase (adds a sponsor track).
      Behind a ModelSearch provider, off by default.
[pre] All external services behind pluggable, KEY-GATED adapters with fallbacks — app boots/demos
      with zero keys; real keys/credits added at the end (user gets them at event start).
[pre] Sponsors to target = Anthropic (core, built with Claude Code) + Deepgram (voice) +
      Sentry (telemetry) + Redis (realtime/state) + Arize Phoenix (OSS trace, offline-ok).
[pre] InsForge + Novita are NOT sponsors — convenience (have credits). InsForge = auth/DB/files;
      Novita = photo→mesh BACKUP only. Primary generation is Claude-writes-scripts.
[pre] Audience = BEGINNERS; product = "describe anything → printable file for your own printer";
      the wow = the agent supplies the manufacturing cleverness (the user just brings the idea).
[pre] Generation engines: Claude→OpenSCAD/JSCAD (parametric) + Claude→Blender bpy (organic/figure,
      via blender-mcp). Both first-class (hybrid). Editable model = a "recipe" (script + ops), not
      a frozen mesh — so prompts keep editing it.
[pre] Use forked OSS for the hard engineering (viewport, CAD, checks, slicing, observability,
      printer control). Catalog: docs/oss-toolbox.md. blender-mcp lets Claude drive Blender directly.
[pre] Issue checks = all 4 (thin walls · non-manifold/breaks · overhangs/supports · joints/clearance).
[pre] Frontend source of truth = frontend/*.dc.html (Claude Design export) + support.js. Reproduce 1:1.
[pre] Type = Space Grotesk (sans) + JetBrains Mono (mono) — per export; replaces planned Inter.
[pre] Design system = "Hardware Paper" (warm LIGHT), NOT placeholder "Hardware Dark". DESIGN.md reflects export.

[h0] Engines locked to a small set — scope for 24h, demo legibility.
[h0] Printers are provided on site — Print stage is live; simulation = fallback.
[h0] Name = Claude Hardware (pitch lineage); fallback swap is find/replace.
[h0] Demo uses original characters only — no named IP (permanent Devpost page).
