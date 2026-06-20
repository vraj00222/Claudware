# ARCHITECTURE

Full design rationale: docs/superpowers/specs/2026-06-13-claude-hardware-design.md
Forkable OSS for each part: docs/oss-toolbox.md

## The contract (the ONE interface UI and backend share)
type AgentEvent =
  | { t: string; kind: "plan" | "fix"; text: string }
  | { t: string; kind: "tool";
      name: "write_openscad" | "write_blender" | "write_fusion" | "fusion_build"
          | "generate_mesh" | "repair_mesh" | "add_joints"
          | "render_preview" | "inspect_render" | "validate" | "slice"
          | "export" | "send_to_printer";
      status: "running" | "done" | "warn" | "error"; detail: string }   // status carries the TRANSPARENT
      // per-engine/provider failure surfacing: NIM ✓/✗reason · Blender live/headless/NOT-CONNECTED · Fusion connected/NOT-RUNNING
  | { t: string; kind: "inspect"; ok: boolean;
      marker?: { x: number; y: number; z: number; note: string } }
  | { t: string; kind: "print"; printer: string; layer: number;
      totalLayers: number; etaMin: number }
  | { t: string; kind: "mesh"; url: string; label: string; stage: number; totalStages: number }
  | { t: string; kind: "estimate"; grams: number; minutes: number; layers: number; material: string }
  | { t: string; kind: "printplan"; plan: PrintPlan }    // Print Brain: dims · one-piece-vs-split · supports · download
  | { t: string; kind: "summary"; text: string;
      source?: string; engine?: "openscad" | "blender";    // final recipe → refine-in-place
      meshUrl?: string };                                   // durable InsForge Storage URL of the finished mesh

- src/lib/mockStream.ts  → (legacy) timed scripts; no longer auto-played in the product.
- src/lib/agentStream.ts → REAL: POST prompt to /api/generate, parse SSE → AgentEvents.
- UI must not know which one it's consuming. The `mesh` event swaps the live viewport STL per
  build stage (step-by-step); `estimate` fills the Print Center stats dynamically.

## Real generation backend (LIVE — src/app/api/generate + src/server/{openscad,blender,fusion,meshgen}.ts)
POST /api/generate {prompt, engine, base?, sizeMm?, refImageUrl?, postSteps?} → SSE of AgentEvents.
`engine` = "auto" | "openscad" | "blender" | "fusion" | "nvidia". The route RESOLVES it first
(src/server/engineRoute.resolveEngine: Auto → classifyEngine(prompt); a manual pick always wins) and emits
a `plan` chip naming the pick + reason. Then it dispatches to one of FOUR engines + a shared finish() tail
(optional Clean-in-Blender post-step → validate → estimate → durable upload → printplan → summary). The
summary's `engine` is the RESOLVED concrete engine so the client stores it on the version.

- engine="openscad" (src/server/openscad.ts): deterministic TS generator for house/box/cylinder, else
  `claude -p` writes staged .scad (@@@STAGE) + BOSL2. Per stage: render `openscad -o stageN.stl` + write
  tools/_watch/model.scad so the native OpenSCAD app (Automatic Reload) shows the SAME build.
- engine="blender" (src/server/blender.ts): `claude -p` writes staged `bpy` (+ the Blender skills primer).
  LIVE — TCP socket to the running Blender (BlenderMCP addon 127.0.0.1:9876) → user WATCHES it build +
  STL exported; HEADLESS — `blender --background --python` fallback. (Drive the addon SOCKET directly — no
  Claude Code MCP. Start it in Blender: N-panel → Connect.)
- engine="fusion" (src/server/fusion.ts): backend POSTs JSON-RPC to Fusion's OWN HTTP MCP
  (http://127.0.0.1:27182/mcp; initialize→initialized→tools/call fusion_mcp_execute). Claude writes an
  `adsk` run() (+ the cad-modeling primer) that builds in a NEW Fusion doc (watchable) + exports ASCII STL.
  API units cm (1.0=10mm); exported STL is mm → no rescale. The adsk script is the editable recipe.
- engine="nvidia" (src/server/meshgen/nim.ts): NVIDIA NIM TRELLIS text→3D → textured GLB + STL. Enrich
  the prompt (promptEnrich; folds a 📎 reference image via Claude vision) → NIM (transparent ✓/✗→procedural
  chips, called directly so the failure reason shows) → ALWAYS scale to real mm (default 120) → SELF-INSPECT
  (src/server/inspect: render→Claude-vision likeness score → ONE bounded retry <0.45, fails open) → import
  the GLB into the live Blender if the socket's up (the nvidia+blender "see it in Blender" win).
- postSteps.cleanInBlender (combo): after a non-Blender gen, import the STL into Blender (live or headless),
  weld/recalc-normals/decimate, re-export the cleaned STL (blender.cleanStlInBlender). Best-effort + chips.
- base (refine-in-place): recipe engines (OpenSCAD/Blender/Fusion) MODIFY the base script; NVIDIA/imported
  have no recipe → regenerate on-subject (pure size edits go through /api/transform instead).
- SKILLS under the hood: src/server/skills.enginePrimer(engine) injects a distilled per-engine expertise
  primer (cad-modeling / manifold-bpy / BOSL2) into that engine's Claude prompt.

Final STL → estimateFromStl → `estimate` event. During the build, per-stage STLs stream from
public/generated/<job>/ (fast, gitignored). The FINISHED mesh is also uploaded to InsForge Storage
(bucket `models`, server-side admin client) → its durable public URL rides the `summary` event so a
reopened project shows the real model after a restart/redeploy.

PRINT BRAIN (src/server/printPlan.ts — pure, no I/O): after the final mesh, the route computes a
`PrintPlan` from that STL (bounding box → W×D×H mm · overhang heuristic → supports flag · split decision
vs a 220×220×250 bed) and emits a `printplan` event → `vm.printPlan` → the landing-styled `<PrintPlan>`
panel + persisted on the ProjectVersion. v1 = recommend + preview only (no cutting / no joints).

## Implemented integration seams (key-gated, working fallbacks)
- VOICE: src/lib/useSpeechToText.ts — Web Speech engine now; Deepgram behind the same hook later.
- AUTH: src/lib/insforge.ts — InsForge **Google OAuth** (SPA flow; SDK auto-exchanges ?insforge_code).
  `insforge` is null when unconfigured → app still boots zero-key. Sign-in gates the post-login shell.
- PERSISTENCE: src/lib/projects.ts — `AsyncProjectStore` with two impls: `insforgeProjects` (InsForge
  DB, per-user via RLS) and `localProjectsAsync` (localStorage, zero-key). `pickStore(signedIn)` swaps
  them; the legacy sync `localProjects`/`ProjectStore` still backs the current pre-login app.
- STORAGE: finished meshes → InsForge bucket `models` (public), uploaded server-side in the generate
  route; durable URL persisted on the project version. Falls back to the local /generated URL if no key.
- GENERATION: src/lib/agentStream.ts <-> src/app/api/generate — Claude CLI (no key) + deterministic
  fallback; UI consumes AgentEvents identically regardless of engine/source.

## InsForge backend (project `claude-hardware`, Pro org · us-west · host f7c2td39.us-west.insforge.app)
- DB table `projects` (migrations/2026…_create-projects.sql): id uuid · user_id uuid DEFAULT auth.uid()
  → auth.users · title · `data` JSONB (the whole Project: versions[], messages[], estimates, recipes) ·
  created_at/updated_at. RLS `authenticated` + USING/CHECK user_id = auth.uid() → each user sees only
  their own. Index (user_id, updated_at DESC); updated_at auto-trigger.
- Why a single `data` JSONB column: it maps 1:1 to the ProjectStore.save(Project) interface and rows
  stay small (a few KB) — well under the JSONB caution threshold. title/updated_at are extracted for
  the gallery list + ordering.
- Bucket `models` (public): finished STLs. Env: NEXT_PUBLIC_INSFORGE_URL/_ANON_KEY (browser, public),
  INSFORGE_URL/INSFORGE_API_KEY (server-only admin; never NEXT_PUBLIC). `.insforge/`, `.env*` gitignored.
- DEFERRED until the post-login shell exists: rewiring Studio.tsx to the async store + the auth provider
  (the Claude Design landing → Google login → studio route changes the app structure; doing it now = rework).

## Layers
1. Frontend (Next.js + Tailwind · "Hardware Paper"): r3f/drei viewport (OrbitControls camera +
   TransformControls/PivotControls = move object in free space), live feed, issue markers,
   version rail, print center. PURE components; consume AgentEvent only; never import backend.
2. Agent core (Claude Agent SDK): the single orchestrator; runs the tool loop below.
3. Engines (subprocess + timeout): OpenSCAD/JSCAD, Blender/bpy (via blender-mcp), trimesh/
   manifold3d, Blender 3D-Print-Toolbox, slicer CLI.
4. Integration layer (key-gated adapters + fallbacks): voice→Deepgram(Web Speech), telemetry→
   Sentry(no-op), realtime/state→Redis(in-mem+SSE), trace→Arize Phoenix(no-op),
   auth→InsForge Google OAuth(zero-key boot), persistence→InsForge DB(localStorage),
   storage→InsForge bucket(local /generated), meshgen→Novita(Claude-procedural).

## The editable model = a "recipe" (not a frozen mesh)
- PARAMETRIC → OpenSCAD/JSCAD script + named params. Edit-by-prompt = patch a param, re-run.
- ORGANIC → Blender Python script (+ optional Novita base mesh) + append-only edit ops.
- Each prompt → new version → fresh mesh + renders → version rail (vN). Reproducible, diff-able.
- recipe/* holds pure patch functions; the recipe diff also drives the forming animation.

## Frontend reality (the Claude Design export)
The visual contract is frontend/Claude Hardware.dc.html (playable workspace) +
frontend/Hardware States Board.dc.html (system reference), run by frontend/support.js.
The export draws the viewport with a 2D <canvas> and runs its own internal demo timeline,
NOT the AgentEvent stream. When porting to Next.js:
- Reproduce layout, tokens, and the 5 hero animations 1:1 (DESIGN.md).
- Viewport loads REAL meshes via react-three-fiber; keep the layer-line/forming aesthetic.
- Replace the internal timeline with mockStream.ts emitting AgentEvents.

### Phase ↔ AgentEvent mapping
boot → (UI-only)                   forming → plan + tool(write_*) + tool(render_preview)
inspecting → inspect{ok,marker}    fix → fix + tool(render_preview) re-run
complete → tool(validate, done)    studio → tool(add_joints) (exploded anim)
printing → print{layer,totalLayers,etaMin}

## Agent tool loop (server side)
plan → choose engine → generate (write_openscad | write_blender | generate_mesh[backup])
     → render_preview (PNG, 3–4 angles)
     → inspect_render (Claude vision → ok/marker)
     → if !ok: fix (patch recipe) → re-render → re-inspect
     → validate (4 checks: thin walls, non-manifold/breaks, overhangs, joints/clearance)
     → [hybrid] add_joints (bpy: cut + insert connector from library)
     → export (3MF/STL) → slice (CLI → G-code) → send_to_printer

## Engine call patterns (all subprocess + timeout)
OpenSCAD render:  openscad -o a.png --imgsize=1024,1024 --autocenter --viewall \
                  --camera=0,0,0,55,0,25,140 model.scad
OpenSCAD export:  openscad --backend=Manifold -o model.stl model.scad
OpenSCAD param:   openscad -D height=108 -o model.stl model.scad   # fast refine
Mesh validate:    trimesh.load("m.stl").is_watertight / .bounds ; Blender 3D-Print-Toolbox
bpy ops:          generated python via subprocess (or blender-mcp), timeout 60s
Slice:            orcaslicer --load printer.ini --export-gcode -o out.gcode m.3mf
                  (or prusa-slicer / CuraEngine)

# macOS: openscad/orcaslicer aren't on PATH from cask installs:
#   /Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD
#   /Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer
# Build the python venv against 3.11 explicitly: python3.11 -m venv .venv

## Directories
frontend/ (Claude Design export — design contract; READ-ONLY) ·
src/components (pure UI) · src/design (tokens) · src/viewport (r3f) ·
src/lib (streams, recipe, providers) · src/app/api (backend routes) ·
src/lib/checks (mesh→issue parsers) · tools/ (python: bpy, connector library) ·
demo-fixtures/ (cached runs) · docs/ (spec, setup, oss-toolbox)

## Stretch: search existing free models
Before generating, optionally search free repositories (Thingiverse/Printables/MakerWorld/
Thangs); if a good free model exists, fetch + adapt it instead of generating. Implement the
web-using agent via Browserbase (sponsor track). Behind a `ModelSearch` provider; off by default.
