# SETUP

## Prerequisites

| Tool | Required? | Install |
|------|-----------|---------|
| Node.js 20+ | Yes | `nvm install 20` or [nodejs.org](https://nodejs.org) |
| OpenSCAD | For parametric engine | `apt install openscad` / `brew install openscad` |
| Blender 3.x+ | For organic engine | `apt install blender` / `brew install blender` |
| PrusaSlicer | For real G-code slicing | `apt install prusa-slicer` / `brew install prusaslicer` |

## Quick setup

```bash
# 1. Clone
git clone https://github.com/vraj00222/Claudware.git
cd Claudware

# 2. Install Node dependencies
npm install

# 3. Environment
cp .env.example .env.local
# Fill in API keys — see README.md "Environment variables"
# The app works with ZERO keys (deterministic fallbacks)

# 4. BOSL2 for OpenSCAD mechanical parts (gears, threads, bearings)
git clone https://github.com/BelfrySCAD/BOSL2.git tools/openscad-libs/BOSL2

# 5. Build + verify
npm run build    # Should show 13 routes, no errors
npm test         # 216 tests should pass

# 6. Run
npm run dev      # → http://localhost:3000
```

## Ubuntu / Debian (CI / Devin)

```bash
sudo apt-get update -qq
sudo apt-get install -y openscad blender prusa-slicer python3-numpy
```

## macOS

```bash
brew install openscad blender prusaslicer
```

Note: Homebrew cask apps aren't on PATH — the app auto-detects them at:
- `/Applications/OpenSCAD.app/Contents/MacOS/OpenSCAD`
- `/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer`

## Optional: live CAD sync

### OpenSCAD live preview
Open `tools/_watch/model.scad` in OpenSCAD → Design → Automatic Reload and Preview.
The same build appears stage-by-stage in the native app as the agent writes it.

### Blender live build
Open Blender → N-panel → BlenderMCP → Connect (socket 9876).
Claude builds the model in your Blender window in real time.

### Fusion 360
Start the Fusion HTTP MCP on `127.0.0.1:27182`.
Claude writes `adsk` scripts and you watch them build in Fusion.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `openscad: command not found` | Install it or set `OPENSCAD_BIN` in `.env.local` |
| `blender: command not found` | Install it — headless fallback still works |
| Models come out as generic blocks | Check `ANTHROPIC_API_KEY` is set + restart `npm run dev` |
| NVIDIA shows "procedural fallback" | Normal when Blender isn't running for GLB→STL; or NIM endpoint is slow |
| "Command failed" on complex parts | Claude hit the timeout — try a simpler prompt or run one at a time |
| Env vars not loading | Restart `npm run dev` after editing `.env.local` |
