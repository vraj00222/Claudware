# SETUP — Claude Hardware (macOS / Apple Silicon)

## Verified installed
| Tool | Version | Notes |
|---|---|---|
| Python 3.11 | 3.11.15 | REQUIRED for bpy — build venv against this, not system 3.14 |
| OpenSCAD (snapshot) | 2026.06.10 | Manifold backend. CLI: /Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD |
| OrcaSlicer | installed | CLI: /Applications/OrcaSlicer.app/Contents/MacOS/OrcaSlicer |
| Bambu Studio | installed | likely the venue printer brand |
| Blender | 5.1.2 | desktop (visual debugging); bpy via pip is the headless engine |
| Redis | 8.8.0 | `redis-server` to run, or use Docker |
| Node / npm | v25.6.1 / 11.9.0 | works (Current, not LTS) |
| Docker | 29.3.1 | Redis fallback |
| Claude Code | 2.1.177 | |
| bpy / trimesh / manifold3d | 5.0.1 / 4.12.2 / ok | import-verified on Python 3.11 (airplane test passed) |

## Remaining hour-0 steps (not yet done)
1. Scaffold the app (and decide frontend integration — see ARCHITECTURE.md):
   npx create-next-app@latest . --typescript --tailwind --app --eslint
   npm i three @react-three/fiber @react-three/drei \
         @anthropic-ai/claude-agent-sdk @modelcontextprotocol/sdk redis zod
2. Project python venv (MUST be 3.11):
   python3.11 -m venv .venv && source .venv/bin/activate
   pip install bpy trimesh manifold3d
3. Fonts (self-host for the offline demo — design uses Space Grotesk + JetBrains Mono):
   download .woff2 → public/fonts/, wire in globals.css (no CDN in the demo)
4. Services: `redis-server` (or `docker run -p 6379:6379 redis:alpine`)
5. Secrets: secrets go in `.env.local` (gitignored); `.env.example` is the committed template.
   Keys: Anthropic · Deepgram · mesh-gen · Redis URL · InsForge (URL/anon + server URL/API key) ·
   **Browserbase** (`BROWSERBASE_API_KEY` [+ `BROWSERBASE_PROJECT_ID`]) for model search.
   NOTE: adding/changing env vars requires a `npm run dev` RESTART for Next to load them.

## macOS gotchas
- Filesystem is case-insensitive: DESIGN.md and design.md alias. The Trunk
  landing system was moved to docs/landing-trunk-design.md to free DESIGN.md.
- openscad / orcaslicer are NOT on PATH from cask installs — use the full
  /Applications/.../MacOS/... paths (or alias them) in subprocess calls.

## Preview the design bundle
Open frontend/Claude Hardware.dc.html in a browser, or:
   cd frontend && python3 -m http.server 8080   # → http://localhost:8080
