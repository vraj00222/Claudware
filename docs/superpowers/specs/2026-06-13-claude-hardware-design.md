# Claude Hardware — Design Spec (v1)

Date: · Status: approved (brainstorm) · Track: Lab · Event: UC Berkeley AI Hackathon

## 1. Summary
A beginner-friendly studio where you **describe or speak any object** — phone case to anime
figurine — and a **Claude agent** designs it, **works out how to make it actually printable
for you** (orientation, supports, wall thickness, splitting, joints, tolerances), shows it
**forming live** in a 3D viewport you can **orbit and drag around in free space**, **pins and
fixes printability problems**, and hands you a **print-ready file** for whatever printer you own.

The product value: the barrier to 3D printing isn't the printer, it's knowing how to design
something that survives printing. We supply the manufacturing expertise so the beginner only
needs the idea.

## 2. Goals / Non-goals
**Goals**
- Prompt/voice → editable 3D model, kept editable by further prompts.
- Live, visible build progress (forming animation + agent activity feed).
- Real 3D manipulation: orbit/zoom/pan camera AND move/rotate/scale the object with cursor gizmos.
- Detect + visualize + auto-fix 4 printability issues: thin walls, non-manifold holes/breaks,
  overhangs/supports, joints/clearance/weak necks.
- Export a real working file (3MF primary, STL) that slices and prints on any printer.
- Pluggable, key-gated sponsor integrations added at the end.

**Non-goals (YAGNI)**
- Full CAD editing (direct vertex push/pull) — out of scope for beginners + 24h.
- Multi-engine picker UI, FreeCAD/Fusion routing.
- Real-time multi-user collaboration.
- Anything frozen in the playbook CUT list.

## 3. Target user & Anthropic framing
Audience: **beginners** ("0 prior CAD") who want to print useful or fun things on the printer
they already have. Anthropic prize ("biggest swing at a meaningful problem") framing:
**democratizing making** — removing the design-expertise barrier to physical fabrication.
Demo deliberately spans breadth (a functional part AND a figurine) and shows the agent catching
a flaw a beginner never would. Built with Claude Code → qualifies for the Anthropic track by default.

## 4. Sponsor strategy
| Sponsor | Use in project | Adapter | Status |
|---|---|---|---|
| **Anthropic / Claude** | the brain (Agent SDK) + vision inspection; built with Claude Code | core | required |
| **Deepgram** | voice input ("describe it out loud") | `VoiceProvider` (fallback Web Speech) | rec |
| **Sentry** | error/perf monitoring on app + agent | `Telemetry` (no-op) | rec |
| **Redis** | live-progress pub/sub + agent session/job state | `EventBus`/`Store` (in-mem+SSE) | rec |
| **Arize (Phoenix, OSS)** | trace/eval the Claude tool loop; self-host, offline-ok | `Tracer` (no-op) | opt |
| **Browserbase** | (stretch) web search for existing free models | `ModelSearch` | stretch |
| InsForge (not a sponsor; have credits) | auth + projects/versions DB + file storage | `Persistence` (local FS) | use |
| Novita (not a sponsor; have credits) | photo→mesh backup | `MeshGen` (Claude-procedural) | backup |

All non-core services sit behind interfaces with fallbacks so the app runs today with **zero
keys** and lights up as keys/credits arrive. Also naturally positioned for: Lab grand prize,
Best UI/UX, Most Technical Hack, possibly Best Beginner Hack (if all teammates are first-timers).

## 5. Architecture
```
Frontend (Next.js + Tailwind · "Hardware Paper" light design)
  r3f/drei viewport: OrbitControls (camera) + TransformControls/PivotControls (free-space move)
  live agent feed · issue markers pinned in 3D · version rail · print center
  PURE components; consume AgentEvent only; never import backend
        ▲ AgentEvent stream (Redis pub/sub → SSE)      ▼ prompt / voice
Agent core — Claude Agent SDK (the ONE orchestrator)
  tools: write_openscad · write_blender · generate_mesh(backup) · render_preview ·
         inspect_render(vision) · validate · add_joints · slice · export · send_to_printer
        ▼ subprocess + timeout
Engines: OpenSCAD · Blender/bpy (via blender-mcp) · trimesh/manifold3d ·
         Blender 3D-Print-Toolbox · slicer CLI (3MF/STL/gcode)
Integration layer (key-gated adapters): Deepgram · Sentry · Redis · Arize · InsForge · Novita
```

## 6. The editable model = a "recipe", not a frozen mesh
Source of truth is the recipe the agent owns; this is what makes "keep editing by prompt" real:
- **Parametric** → an OpenSCAD (or JSCAD) script + named params. "Make it taller" = patch a param, re-run.
- **Organic/figure** → a Blender Python script (+ optional Novita base mesh) + an append-only
  list of edit ops. "Give it a stand" = append an op.
Every prompt → new version → fresh mesh + renders, saved to the version rail (vN). Reproducible
and diff-able. The recipe diff also drives the forming animation.

## 7. Agent tool loop + the contract
`AgentEvent` is the single interface UI and backend share (see ARCHITECTURE.md for the type).
Loop: plan → choose engine → generate → render_preview (PNG, 3–4 angles) → inspect_render
(Claude vision → ok/marker) → if !ok: fix → re-render → validate (4 checks) → [hybrid] add_joints
→ slice → export/send_to_printer. The UI consumes `mockStream` (timer) or `agentStream` (real)
identically. Phase machine: empty → forming → complete → inspecting → studio → printing.

## 8. 3D viewport & manipulation
three.js + @react-three/fiber + @react-three/drei. Camera: `OrbitControls`. Object: grab to
move/rotate/scale via `TransformControls`/`PivotControls` gizmos. `three-mesh-bvh` for fast
picking/measure. Forming = layer-line sweep materializing the model bottom-up while the feed
streams. Issues = amber markers pinned to geometry with a hairline leader to the offending feed row.

## 9. Issue detection (the wow) — all 4
| Check | Engine |
|---|---|
| Thin walls / min feature | Blender 3D-Print-Toolbox `thickness` + manifold3d |
| Holes / non-manifold "breaks" | trimesh is_watertight/broken_faces + Toolbox |
| Overhangs / supports | Toolbox overhang; suggest reorientation |
| Joints / clearance / weak necks | connector-library clearances + thin-neck scan |
Claude vision localizes + explains each flaw in plain language → marker + "design note" with an
**Apply fix** action. This is the "it caught its own mistake" moment.

## 10. Export & print
Export **3MF** (slicer-native) + STL; verify it slices via slicer CLI → G-code. Product goal:
the file works in any slicer for the printer they own. Demo: live-send to the venue Bambu.
⚠️ Bambu Jan-2025 firmware requires LAN auth (access code/cert) — confirm with organizers; keep
fixtures + sim fallback.

## 11. Integration / provider layer
Each external service = an interface + a fallback + an env flag (see Sponsor table). The app
boots and demos with zero keys; real keys/credits are dropped in at the end. Keeps the demo
resilient (wifi-death drill) and lets sponsors be added incrementally.

## 12. OSS toolbox
Full forkable repo/library/MCP list mapped to each subsystem: see `docs/oss-toolbox.md`.
Highlights: **blender-mcp** (Claude drives Blender), **openscad-wasm / JSCAD / Replicad**
(browser CAD), **Blender 3D-Print-Toolbox + trimesh/manifold3d** (the 4 checks),
**CuraEngine/PrusaSlicer CLI** (slice), **Arize Phoenix** (OSS observability, offline),
**bambu-printer-manager** (printer), **three/r3f/drei + three-mesh-bvh** (viewport).

## 13. Future / stretch features (keep for later)
- **Search existing free models first** — before generating, search Thingiverse / Printables /
  MakerWorld / Thangs; if a good free model already exists, fetch and adapt it instead of
  generating from scratch. Implement via **Browserbase** (web-using agent → sponsor track).
- Self-hosted mesh-gen (Hunyuan3D-2.1 / TRELLIS / TripoSR) to replace Novita.
- Full Deepgram voice-agent loop (not just STT); printer cam; landing page (Trunk light system).

## 14. Scope cut (24h)
- **MUST (h0–10):** UI shell on `mockStream` (demoable ~h2) → parametric engine end-to-end on
  r3f (prompt → OpenSCAD → render → inspect/fix → 2 checks → export 3MF → slice) + live progress.
- **SHOULD (h10–18):** Blender engine (organic/figure) + remaining checks + joints/studio +
  Deepgram + Redis realtime + InsForge persistence/versions.
- **STRETCH (h18–22):** Sentry + Arize on real keys, Novita photo→mesh, model-search
  (Browserbase), full voice loop, printer cam, landing page.
- **FROZEN:** h20+ demo paths locked · h22+ code freeze except demo-path bugs.

## 15. Module boundaries (one purpose each, testable in isolation)
`AgentEvent` (UI↔backend contract) · `recipe/*` (parametric/organic + pure patch fns) ·
`engines/*` (each `run(input)→artifacts` with timeout) · `checks/*` (mesh→issue[] pure parsers) ·
`providers/*` (adapters) · `viewport/*` (props-in/JSX-out). UI never knows mock vs real stream.

## 16. Testing
TDD the pure parts: recipe patching, AgentEvent reducers, issue parsers, mockStream. Engines run
behind timeouts with **golden fixtures** (cached renders/STL/G-code) that double as the
wifi-death demo fallback. Playwright MCP to verify the 5 hero UI states.

## 17. Risks & fallbacks
- Wifi dies → fixtures replay via mockStream (identical demo).
- Bambu LAN auth → fixtures + sim; the in-hand printed figure is the payoff.
- bpy/openscad hang → subprocess timeout + retry (lower $fn) → fall back to last good mesh.
- Mesh-gen unavailable → Claude-procedural Blender path (Novita is only backup anyway).
- Deepgram down → Web Speech API.

## 18. Decisions & open items
Decision log: `DECISIONS.md`. Open: confirm venue printer model + LAN auth policy; confirm
team first-timer status (Best Beginner eligibility); which sponsor keys arrive and when.
