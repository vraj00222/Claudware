# ROADMAP — future capabilities (captured from Vraj,)

Living list of "the project should be able to do this." Ordered loosely by phase. Items move
to PROGRESS when picked up. Nothing here is committed scope until it's in a plan.

## Now working (vertical slice — testable)
- [x] Prompt → real OpenSCAD generation, streamed **step-by-step** into the viewport
      (`/api/generate` SSE → `AgentEvent`/`mesh` → r3f). Deterministic generator for house/box/
      cylinder; `claude -p` CLI for arbitrary prompts (no API key). Watch the SAME build live in
      the native OpenSCAD app via the auto-reloaded `tools/_watch/model.scad`.
- [x] Removed the auto-playing phone-stand demo + demo harness; empty "describe anything" state.
- [x] Loaders: ASCII PrinterLoader (in-viewport) + PNG RenderLoader (long waits).

## Active build — "do now" (per Vraj, batch 2)
- [x] **Full-page / fit layout** — scale-to-fit stage; fills the window, never overflows.
- [x] **New chat button** + **Projects** button in the TopBar.
- [x] **Steps for EVERY prompt** — Claude CLI staged OpenSCAD via `@@@STAGE` delimiter; multi-stage
      fallback. (Blender step-by-step now DONE too — see Engines below.)
- [x] **Database (MVP)** — localStorage ProjectStore; auto-saves each generation.
- [x] **InsForge backend PROVISIONED + WIRED (libs)** — Pro-org project, `projects` table (RLS owner-only),
      `models` storage bucket, Google OAuth; src/lib/insforge.ts + insforgeProjects adapter + storage upload.
      Front-end integration (auth gate, async-store swap, history) PENDING the Claude Design login shell.

## Reuse before regenerate — fetch existing models (Browserbase sponsor) — BUILT (v1,)
- [x] Search the web (Printables live; Thangs/Thingiverse/MakerWorld scaffolded) for an existing model, show
      results, and "Use this" imports the STL → Print Brain + Download + saved. Behind a `ModelSearch` provider
      (Browserbase Fetch API, key-gated + zero-key curated fallback). Spec/plan in docs/superpowers/.
- [ ] v1.1: resolve login-walled DIRECT STL downloads (Browserbase Sessions/auth) so ANY result imports (today
      only direct-stlUrl results / the curated Benchy import for real); fill the other source parsers; rank by
      relevance; 3D-similarity "find something like this image".

## Sponsors — what each gives us (PAST=used · NOW=wired · NEXT=to add). Target: use ALL.
| Sponsor | Status | Feature it powers for us |
|---|---|---|
| **Anthropic** (core) | NOW | The brain — Claude writes the OpenSCAD/bpy **and** the Print-Brain reasoning; built with Claude Code. Today via the `claude -p` CLI (zero-key, reuses Claude Code auth, parses `@@@STAGE` text). NEXT: optional Anthropic/Agent **SDK** upgrade for structured stage output + a real self-inspecting render→fix loop (needs a key) — see DECISIONS `[claude-sdk]`. |
| **Deepgram** (voice) | NOW (partial) | "Speak your idea." Web Speech wired (`useSpeechToText`). NEXT: Deepgram streaming behind the same hook (WS proxy + key) for accuracy + spoken read-back. |
| **Browserbase** (web) | NOW | Reuse-before-regenerate (BUILT v1): live web search of free model repos (Printables) via the Fetch API → import an existing STL into the studio. Behind a `ModelSearch` provider (key-gated + fallback). NEXT: auth'd downloads + more sources + web character research. |
| **Redis** (realtime/state) | NEXT | Job/progress pub-sub + session state for the build stream (SSE fallback exists today). |
| **Sentry** (telemetry) | NEXT | Error/perf telemetry, key-gated with a no-op fallback. |
| **Arize Phoenix** (trace) | NEXT | Traces the agent generation loop (OSS, offline-ok) to debug quality. |

Have-credits (NOT sponsors):
- **InsForge** — NOW: Google auth + `projects` DB (RLS) + `models` storage, wired.
- **Novita** — NEXT (backup): photo→mesh. Can **host Hunyuan3D**, so it doubles as our meshgen route.
- **Hunyuan3D** (Tencent, OSS text/image→3D) — NEXT (evaluate, see below).

> Hunyuan3D: DROPPED as a planned provider (per Vraj — removing bloat). We're committed to NVIDIA NIM
> (TRELLIS, textured GLB) + Blender cleanup. The addon still exposes Hunyuan if ever needed, but it is not
> on our roadmap.

## 3D generation models — prompt→3D meshgen (per Vraj,) — BUILT (NIM live · Rodin wired)
Meshgen now LIVE behind `src/server/meshgen/` (Rodin→NIM→procedural fan-down, key-gated). Spec/plan in
docs/superpowers/. STL = print artifact; textured GLB = viewport preview (GLTFLoader). Status below:
- [x] **NVIDIA NIM — TRELLIS** text/image→3D — LIVE (textured dragon). `ai.api.nvidia.com/v1/genai/microsoft/trellis`.
- [x] **Hyper3D Rodin** (live in Blender via the addon socket) — WIRED + protocol-verified; free trial is
      credit-blocked (API_INSUFFICIENT_FUNDS) so it fans to NIM until topped up / FAL_AI mode.
- [ ] **NVIDIA Edify 3D** — 4K-PBR finals (same key) — option, not yet wired.
- [ ] image→3D for make-with-AI via NVCF asset upload (hosted inline base64 → 422; currently text-fallback).
- [ ] mesh repair/decimate before print; GLB in the forming/gizmo path (orbit-only now).

### NVIDIA (via build.nvidia.com NIM API) — reference
- **TRELLIS** — text/image → GLB mesh, fast prototyping. [WIRED]
- **Edify 3D** — text/image → quad mesh + 4K PBR textures, production quality. [option]
- **Cosmos** — full scene/world simulation (future, "world models").

### Integration sketch (our pipeline)
1. Claude → enriched, structured, detailed description (promptEnrich).
2. Call TRELLIS (NVIDIA NIM) → GLB (+ image→3D when a reference is given).
3. Blender auto-cleanup (join/weld/normals/decimate) → printable STL.
4. Precision parts → OpenSCAD parametric geometry (separate engine).

### API quick start
- NVIDIA NIM key: build.nvidia.com (free credits) → `NVIDIA_NIM=nvapi-…` in `.env.local`.
NOTE: STL/GLB import → our binary-STL parser + Print Brain already handle downloaded meshes (see model search),
so a generated GLB→STL would flow through the same estimate/print-plan path. Output is NOT print-ready raw.

## Character & customization pipeline (from Vraj's vision,) — the product moat
- [ ] **Research-then-build for named things** ("build Kratos", "print the Claude mascot"): web-research what
      it is (Browserbase) → ASK pose / size / outfit (+ accept reference photos) → show a plan → get APPROVAL
      → generate. Find-when-to-ask = per product TYPE (figure → pose/scale/outfit; bracket → fit/material;
      container → contents/lid). The user just prompts, answers questions, and approves.
- [ ] **Reuse first**: if a good FREE model exists, visualise it + ask yes/no before generating our own.
- [ ] **Custom variants (the moat)**: "Viking Claude mascot" = fetch a base mascot → generate the variant
      (Blender bpy + textures). Skin/texture generation at full throttle for figurines (MCP + OpenSCAD/bpy).
- [~] **Research-then-build (DETAIL)** — IN PROGRESS. Clarify questions are now prompt-specific (Claude:
      Kratos → armor/weapon/era) + the prompt is ENRICHED (Claude expands to a vivid description) → more
      faithful TRELLIS detail. NEXT for "super detail": **Browserbase fetches real reference IMAGES** of the
      named/complex subject → feed to NIM **image→3D** (needs NIM's NVCF asset-upload; hosted inline b64 → 422)
      and/or multi-view conditioning. Today's enrichment is the text-only stand-in for this.
- [~] **NVIDIA + Blender** — IN PROGRESS. The NIM-generated GLB is now imported into the user's LIVE Blender
      scene (importGlbToLive) so they see/refine it there. NEXT: auto Blender cleanup (decimate, recalc normals,
      thicken thin walls, repair non-manifold) + re-export the refined STL → printability on meshgen output.
- [ ] **Image understanding**: upload a photo → ask clarifying questions → generate a similar model
      (Hunyuan3D meshgen + Claude cleanup).
- [ ] **Element-level editing (Claude-Design-style)**: select ONE element (e.g. a tree branch) and edit its
      properties live — every property editable. Needs a recipe-addressable parts model.
- [ ] **Branches view for complex models**: list/highlight all parts ("branches") of a complex character.
- [x] **Measurements + one-go-vs-split + supports + Download STL** — DONE (Print Brain v1,).
      NEXT on this: actually CUT along the seams + press-fit joints from a connector library.

## Persistence, projects & accounts (per Vraj — high priority, next)
- [x] **Refine the current model in place** — DONE. A prompt while a project is open edits the current
      version's recipe (sent as `base`) into a NEW version on the SAME project (both engines); the final
      recipe returns in the `summary` event; VersionRail shows v1,v2,… and clicking one loads it + sets
      the refine base. (Studio + route.ts + projects.ProjectVersion.source/engine.)
- [~] **Save everything** — DONE: models auto-save (prompt + latest mesh + estimate + steps).
      TODO: persist the chat transcript + every version's recipe (scad) per project.
- [x] **Projects gallery page** — /projects lists past projects (layer-line thumb, title, date,
      stats); open one (/?project=id) or start a new one. (Real 3D thumbnails = polish TODO.)
- [~] **Profile page** — the user's account + their projects. Backend ready (InsForge auth); page wired
      with the login shell.
- [x] **InsForge** (auth + DB + file storage) behind the persistence adapter — PROVISIONED + wired as libs
      (insforgeProjects / pickStore / storage upload); swaps in once the user signs in via the shell.

## Engines & generation
- [x] **Blender path — DONE** (src/server/blender.ts). Claude writes staged `bpy`; LIVE path drives the
      open Blender GUI via the BlenderMCP addon's localhost SOCKET (9876) so you watch it build + export
      STL from that same Blender; HEADLESS `blender --background --python` is the fallback. Both stream
      `mesh` events → web viewport builds step-by-step too. Engine chosen via the mode picker
      (Parametric→OpenSCAD, Figure/Hybrid→Blender). NOTE: blender-mcp is a Claude *Desktop* extension,
      so we use the addon socket directly (no Claude Code MCP tools / no restart needed). Deepgram-style
      key-gating N/A — local socket. Start the addon server in Blender (N-panel → Connect) for live.
- [ ] **Great build animations** in both OpenSCAD and Blender (turntable, exploded assembly,
      layer-by-layer build) — exportable.
- [x] **Ask clarifying questions BEFORE generating** — DONE (clarify-first). /api/clarify + ClarifyCard:
      figures get surface(scales/feathered)+pose; every prompt gets a SIZE question that sets the real-world
      scale (fixes the 30cm bug). Heuristic classifier, never blocks. TODO: surface printability issues
      (overhangs/thin walls/weak seams) up front via Blender-MCP knowledge; material/orientation questions.

## Printability intelligence (the "design expertise" we supply)
> **★ PRINT-READINESS PIPELINE v2** — full plan in **docs/superpowers/specs/2026-06-17-print-readiness-pipeline-v2-design.md**
> (captured from Vraj, after the "ant" — great shape, not printable). v1 only MEASURES + exports STL;
> v2 actually MAKES it printable: DIAGNOSE (4 checks w/ regions) → ORIENT (auto flat-vs-upright, Tweaker-3 fork) →
> REPAIR/THICKEN/HOLLOW (remove the pain points: thin legs, floaters, fragile joints) → SUPPORTS (tree vs none +
> visualize) → SLICE/EXPORT (**3MF / OBJ / GLB / STEP / G-code** for the real Bambu A1, not just STL) → a
> "Print Readiness" panel + the agent's "here's how I'd print it & why" narrative. Phased P1→P4. The items below
> are the pieces of that pipeline.
- [~] **Export formats** (Vraj, "3mf and more"): today ASCII STL only (Download + InsForge upload).
      TODO: **3MF** (preferred for Bambu/Prusa/Orca — carries units/color/settings) · **OBJ/GLB** (keep figurine
      texture) · **STEP** (Fusion parts) · **G-code** sliced for the user's printer. Mesh formats via trimesh/
      manifold3d; G-code via a forked slicer CLI (key/edition-gated + "slice in your slicer" fallback).
- [ ] **Auto-orient for best print** (Vraj, "some print horizontal, some vertical"): score candidate
      orientations by support area / stability / height / strength → recommend a pose + WHY + apply (override via
      TransformControls). Fork Tweaker-3. *(also listed under "More beginner features".)*
- [ ] **Mesh print-readiness / pain-point removal** (Vraj, the ant): detect thin features, floaters,
      fragile joints, non-manifold → **auto-repair + auto-thicken (don't ask, just do it)** with before/after.
      Runs in the Blender headless path (3D-Print-Toolbox) and/or a trimesh+manifold3d sidecar (subprocess+timeout).
- [ ] **★ Decompose complex models into PARTS + nest on one plate** (Vraj): generate the whole ant,
      but for printing split it into parts that each print well (body/head/leg-clusters — keep the un-joined part
      graph from generation), add press-fit connectors from the **pre-built library**, and **arrange all parts on
      ONE Bambu A1 plate, printed together in a single job**, with an exploded→assembled preview. v1's slab split
      becomes one branch of this. Triggered by the per-iteration **"Prepare for print"** button (no live overlay).
- [~] **Supports**: basic overhang flag DONE (printPlan.analyzeOverhangs → needed + reason, shown in the
      Print Plan panel). TODO: tree/branch supports vs none + visualize the support structure in the viewport.
- [ ] **Infill strategy**: don't fill where it isn't needed; add internal fill only where the part
      is load-bearing/weak. Surface this as a decision, show it.
- [~] **Part splitting + joints**: RECOMMEND + PREVIEW DONE (Print Brain v1 — measures the model, decides
      one-piece-vs-split vs the bed, shows parts + seam positions + reason in the Print Plan panel). TODO:
      actually CUT along the seams + add press-fit connectors from the joint library + show reassembly (v1.1/v2).
- [ ] **Slice + layer preview**: real slicing and a layer-line view — see how the layers will look
      / stack before printing.

## Print + hardware
- [ ] **Actually print** to a real printer (Bambu/OctoPrint/Moonraker), with the live job + cam.

## UX / polish
- [ ] **Landing showcase — "made by the app"** (Vraj,): a section showing models the app
      itself generated (saved `public/assets/showcase/printer.glb` + `dragon.glb`, textured via NIM) as an
      **assembly animation** — parts joining to build the model — **with colors**, captioned that the app
      made it. Viewport already does GLTFLoader; landing uses GSAP. Touches the landing ("change the design").
- [~] **Less noise, bolder type**: remove unnecessary static/rendering; make the font system more
      deliberate and bold (less "default-AI"). *(noise removed; type pass still TODO — needs a
      "change the design" pass on DESIGN.md.)*
- [x] **Subtle versioning**: muted colors, no "+" button; versions appear only on a real change.

## More beginner features (near-future backlog)
- [ ] Guided first-run / onboarding ("what do you want to make?") with categories + example gallery.
- [ ] "Explain it to me" — plain-language why of each design choice (wall thickness, supports, infill).
- [ ] Size/scale helper with real-world references ("about the size of a phone") + unit toggle (mm/in).
- [ ] One-click material/printer presets (PLA/PETG; Bambu/Ender) that adjust tolerances automatically.
- [ ] Cost + time estimate up front (filament grams → ₹/$); "cheaper if I hollow this?" suggestions.
- [ ] Auto-orient for best print (least supports / strongest layers) with a before/after preview.
- [ ] Remix: start from an existing project and tweak ("make it 20% bigger", "add a lid").
- [ ] Shareable project link + export STL/3MF download button.
- [ ] Voice-first mode (Deepgram) — speak the idea, hear it back.
- [ ] Print queue / history with reprint, and printer-cam during the job.
- [ ] Safety/printability lint explained simply (overhangs, thin walls, tiny text) before printing.

## Watch-in-parallel (already possible today)
- OpenSCAD app: open `tools/_watch/model.scad`, enable Design → Automatic Reload and Preview.
- Blender: (Phase B) live window via blender-mcp; or headless stage renders into the web viewport.
