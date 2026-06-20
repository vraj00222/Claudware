# OSS Toolbox — fork/use, don't hand-roll

Curated open-source repos, libraries, and MCP servers mapped to each subsystem of
the Claude Hardware design. Tags: **[core]** build on it · **[rec]** strong fit ·
**[opt]** stretch/optional. Verified June 2026.

## MCP servers (Claude drives real tools) — the biggest buffs
- **[core] blender-mcp** — ahujasid/blender-mcp — Claude ↔ Blender over MCP; prompt-assisted
  modeling, scene ops, render, export. Lets the agent BE the Blender engine.
  https://github.com/ahujasid/blender-mcp
- **[opt] blender-mcp-pro** — youichi-uda/blender-mcp-pro — 120+ tools (modifiers, geometry
  nodes, shaders) if we need deeper Blender control. https://github.com/youichi-uda/blender-mcp-pro
- **[rec] mcp-3D-printer-server** — DMontgomery40 — slice + control printers via OctoPrint/
  Moonraker/Klipper/etc. from MCP. https://github.com/DMontgomery40/mcp-3D-printer-server
- **[opt] bambu-mcp** — schwarztim — Bambu-specific MCP control. (glama.ai/mcp/servers/schwarztim/bambu-mcp)
- **[opt] PrusaMCP** — Noosbai/PrusaMCP — `slice_prusaslicer` tool over MCP.
- **[already installed] Playwright MCP** — drive the dev server, screenshot + verify the 5 hero UI states.

## 3D viewport + manipulation (move in free space + orbit camera)
- **[core] three.js** + **@react-three/fiber** — WebGL viewport in React.
- **[core] @react-three/drei** — `OrbitControls` (camera), `TransformControls`/`PivotControls`
  (drag/rotate/scale gizmos = "move object in free space"), `GizmoHelper`, `Bounds`,
  `Center`, STL/GLTF loaders.
- **[rec] three-mesh-bvh** — fast raycasting for picking/measuring/section in the viewport.
- **[rec] three-stdlib** — STLLoader/STLExporter, 3MFLoader, GLTFExporter (loaders/exporters).
- **[rec] @react-spring/three** or **framer-motion** — the layer-line forming/inspect animations.
- **[opt] leva** — quick debug param sliders during dev.

## Parametric CAD the agent writes (editable by prompt)
- **[core] OpenSCAD** CLI (installed) — Claude writes `.scad` → STL/PNG.
- **[rec] openscad-wasm** — OpenSCAD as an ES6 module → instant in-browser preview, no server round-trip.
  https://github.com/openscad/openscad-wasm
- **[rec] JSCAD (@jscad/modeling)** — programmatic parametric CAD in JS, browser+node,
  "especially useful for ready-to-print designs." Agent can emit JS instead of .scad.
  https://github.com/jscad/OpenJSCAD.org
- **[opt] replicad** — JS CAD on OpenCascade (true B-rep: fillets/chamfers, CAD-grade).
  https://github.com/sgenoud/replicad
- **[opt] manifold-3d** (npm wasm) — robust mesh booleans for joins/cuts in-browser.

## Organic / figure generation (Claude-procedural primary; OSS mesh-gen backup)
- **[core] Blender / bpy** (installed) — procedural figures (primitives, metaballs), boolean joints. Drive via blender-mcp.
- **[opt backup] Hunyuan3D-2.1** — Tencent — image/text→3D, production PBR (self-host on GPU).
  https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1
- **[opt backup] TRELLIS / TRELLIS.2** — MIT, image→3D, runs on ~6GB GPU.
- **[opt backup] TripoSR** — MIT, fast single-image→mesh.
- (Novita API = hosted backup for the same, if credits/wifi cooperate.)

## Mesh validate + repair + the 4 printability checks
- **[core] Blender 3D-Print-Toolbox** (`object_print3d_utils`, ships with Blender) — thin walls,
  overhangs, non-manifold, intersections out of the box. Covers all 4 checks.
- **[core] trimesh** (installed) — is_watertight, broken_faces, bounds, repair helpers.
- **[core] manifold3d** (installed) — guaranteed-manifold booleans + checks.
- **[rec] PyMeshLab** — heavy-duty repair/remesh/decimate (MeshLab scripting).
- **[opt] numpy-stl / admesh** — lightweight STL stats + auto-repair.
- **[opt] Open3D** — point/mesh ops if needed.

## Slice → real printable file
- **[core] OrcaSlicer / Bambu Studio CLI** (installed) — STL/3MF → G-code.
- **[rec] PrusaSlicer CLI** — robust CLI slicing of STL/OBJ/3MF (alt engine).
- **[rec] CuraEngine** — Ultimaker/CuraEngine — scriptable slicing core. https://github.com/Ultimaker/CuraEngine
- **[core] 3MF** export (slicer-native, the "file that works on any printer"). **lib3mf** for proper read/write.

## Send to the printer they have
- **[rec] bambu-printer-manager (BPM)** — pure-Python Bambu wrapper (MQTT state, commands, FTP).
- **[opt] OctoPrint** REST API / **Moonraker** (Klipper) — universal "any printer" path.
- ⚠️ **Bambu Jan-2025 firmware requires auth for LAN control** — need the printer access code /
  cert. Confirm with organizers; have fixtures + sim fallback for the demo.

## Voice (Deepgram sponsor)
- **[core] @deepgram/sdk** — STT/TTS/voice-agent.
- **[fallback] Web Speech API** (browser, zero deps) · **faster-whisper / whisper.cpp** (OSS local STT).

## Observability (Sentry + Arize sponsors)
- **[rec] @sentry/nextjs** — error + perf monitoring on app + agent (~1hr wire-up).
- **[rec] Arize Phoenix** — arize-ai/phoenix — OSS, OpenTelemetry, **explicitly supports the
  Claude Agent SDK**, self-hostable & offline. Hits the Arize track with no key.
  https://github.com/arize-ai/phoenix

## Brain / backend / state
- **[core] @anthropic-ai/claude-agent-sdk** — the orchestrator (tool use + vision inspect).
- **[have credits] @insforge/sdk** — auth, projects/versions DB, file storage.
- **[rec] redis / ioredis** (node) — live-progress pub/sub + agent session/job state (Redis sponsor).

## Stretch: search existing free models first (Browserbase sponsor)
Before generating from scratch, search free model repos; if a good match exists, fetch + adapt.
- **[stretch] Browserbase / Stagehand** — web-using agent to search + fetch (sponsor track:
  "any agent that uses the web, powered by Browserbase").
- Sources: Printables, MakerWorld, Thingiverse, **Thangs** (has search API/3D similarity).
- Behind a `ModelSearch` provider; off by default. Reuse beats regenerate for common objects.
