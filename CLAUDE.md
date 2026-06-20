# CLAUDE HARDWARE — agent constitution

Mission: 3D printing for beginners. A user describes or speaks ANY object (phone case →
anime figurine); this agent designs it, WORKS OUT HOW TO MAKE IT PRINTABLE for them
(orientation, supports, walls, splitting, joints, tolerances), shows it forming live in a
3D viewport they can orbit and drag, INSPECTS ITS OWN RENDER, fixes its own mistakes,
and exports a print-ready file for whatever printer they own. The barrier to printing
isn't the printer — it's design expertise; we supply it. Track: Lab. Demo time: [FILL].

Full design: docs/superpowers/specs/2026-06-13-claude-hardware-design.md
OSS toolbox (fork, don't hand-roll): docs/oss-toolbox.md

## Stack
Next.js + TS + Tailwind · react-three-fiber/drei viewport (OrbitControls + TransformControls)
· Claude Agent SDK (the brain) · OpenSCAD / JSCAD (parametric) · Blender/bpy via blender-mcp
(organic figures, joints, studio ops) · trimesh + manifold3d + Blender 3D-Print-Toolbox
(the 4 printability checks) · slicer CLI → 3MF/STL/G-code · Redis (realtime/state) ·
InsForge (auth/projects/files) · Deepgram (voice) · Sentry + Arize Phoenix (observability).

Sponsors targeted: Anthropic (core) · Deepgram · Sentry · Redis · Arize. InsForge + Novita =
have-credits convenience, NOT sponsors. Novita (photo→mesh) is a backup only.

Frontend design = "Hardware Paper" (warm LIGHT system) — Bricolage Grotesque (sans, per Vraj;
was Space Grotesk) + JetBrains Mono (mono). Live source: frontend/*.dc.html + frontend/support.js.
See DESIGN.md (now tracks post-export changes: no auto-demo, no Design Notes, dynamic Print Center,
subtle versioning). Real generation backend + future backlog: ARCHITECTURE.md + docs/ROADMAP.md.

## Engines (LOCKED — do not add others)
- PARAMETRIC = OpenSCAD (or JSCAD). Agent writes a script; renders PNG + exports STL/3MF.
- ORGANIC/FIGURE = Claude writes a Blender Python script (procedural) via bpy/blender-mcp.
  Novita image→3D is a fallback ONLY (photo drop + wifi/credits available).
- STUDIO OPS = bpy. Cut meshes, insert joints from the connector library, repair, render.
- CHECKS = trimesh + manifold3d + Blender 3D-Print-Toolbox.
- Joints come from a PRE-BUILT connector library; no freeform joint synthesis.
- FUSION 360 = precise parametric CAD (added per Vraj — reverses the old CUT). Claude writes
  an `adsk` script driven via Fusion's HTTP MCP (127.0.0.1:27182) → exports STL. src/server/fusion.ts.
- NVIDIA NIM (TRELLIS text→3D) = its OWN engine for organic/figures (was bundled under "Blender").
- A 4-ENGINE PICKER + Auto routing IS built (also reverses the old CUT): [Auto · OpenSCAD · Blender ·
  Fusion · NVIDIA] + a Clean-in-Blender combo. Auto classifies the prompt → the right engine.
- CUT: FreeCAD, Tinkercad, direct vertex editing.

## Integration layer (every external service is pluggable + key-gated)
All sponsor/3rd-party services sit behind an interface with a fallback and an env flag:
voice→Deepgram(Web Speech) · telemetry→Sentry(no-op) · realtime/state→Redis(in-mem+SSE) ·
trace→Arize Phoenix(no-op) · persistence→InsForge(local FS) · meshgen→Novita(Claude-procedural).
The app boots and demos with ZERO keys; real keys/credits drop in at the end.

## RULES — every session, no exceptions
1. SESSION START: read PROGRESS.md + DECISIONS.md before writing any code.
   Resume from PROGRESS "NEXT". Never re-litigate a settled decision.
2. TASK DONE / SESSION END: update PROGRESS.md FIRST, then continue or stop.
3. Never modify frontend/, src/components/, src/design/, or DESIGN.md unless the
   instruction literally contains "change the design".
4. All dynamic UI data flows through the AgentEvent interface (ARCHITECTURE.md).
   UI components are pure: typed props in, JSX out. UI never imports backend.
5. Every external process (openscad, bpy, slicer) runs in a subprocess WITH A TIMEOUT.
   One bad mesh must never hang the loop.
6. No new dependencies after hour 18. No refactors after hour 20.
7. Blocked >20 min on one bug → log to PROGRESS BLOCKED with what you tried, switch task, tell Vraj.
8. Anything in DEMO.md "do-not-break" is frozen after hour 20.
9. Keep file updates terse. PROGRESS.md is a state board, not a diary.

## PHASE MAP (cut lines)
MUST   (h0–10): UI shell vs mockStream · parametric loop (prompt→OpenSCAD→render→inspect→fix) ·
                2 checks · export 3MF · slice · viewport states (orbit + move)
SHOULD (h10–18): Blender organic engine · remaining checks · joints/studio · Deepgram voice ·
                Redis realtime · InsForge persistence/versions
STRETCH (h18–22): Sentry + Arize on real keys · Novita photo→mesh · model-search (Browserbase) ·
                full voice loop · printer cam · landing page
FROZEN: h20+ demo paths locked · h22+ code freeze except demo-path bugs
