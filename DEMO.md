# DEMO — live, prompt-driven

The app boots to an empty "describe anything" state. The demo IS typing a real prompt and
watching the model actually build (real generation, not a script).

## Setup (before the demo)

1. `npm run dev` → http://localhost:3000
2. Ensure `ANTHROPIC_API_KEY` is in `.env.local` (restart dev server after adding)
3. Optional: open OpenSCAD on `tools/_watch/model.scad` (Automatic Reload) for the dual-view wow
4. Optional: connect Blender (N-panel → BlenderMCP → Connect) for live organic builds

## Beat 1 — Describe → watch it BUILD (~30s, OpenSCAD)

Open `/` → "Start designing" → skip sign-in → type or click "a gear with 24 teeth"

The agent feed shows: plan → write_openscad → render_preview (per stage) → mesh appears step-by-step
in the viewport. If OpenSCAD is open alongside, the SAME build appears in the native app.

**Line**: "You describe it; Claude designs it — with real threads, real gears, real tolerances."

### Best OpenSCAD prompts (verified working)
- "a simple phone stand" → 6 stages, cable slot, angled back, gussets
- "M10 hex bolt with threads" → real BOSL2 threaded_rod, 17mm across-flats
- "a gear with 24 teeth" → real spur_gear from BOSL2
- "a soap dish with drainage holes" → multi-stage parametric

## Beat 2 — Switch engines (~60s, NVIDIA or Blender)

Click the engine picker → **NVIDIA** → type "a chubby sitting dragon"

The clarify card asks style/wings/size. Pick options → Generate.
NVIDIA NIM TRELLIS produces a textured 3D model. The viewport shows it with color/texture.

**Line**: "Same app, different engine. NVIDIA NIM for characters, OpenSCAD for engineering."

### Best NVIDIA prompts
- "a chubby sitting dragon" → textured, detailed
- "a cute owl figurine" → smooth, organic
- "a tiny astronaut" → character with detail

### Best Blender prompts
- "a tiny rocket ship" → 3 stages, fins + nozzles + nose cone
- "a mushroom" → organic, smooth
- "a chess pawn" → clean turned shape

## Beat 3 — Print readiness (~10s)

After any model builds, the Print Center shows dynamic stats (grams, time, layers).
Click **"Prepare for print"** → readiness score, 4 checks, auto-orientation, and downloadable
STL/OBJ/3MF/G-code files.

**Line**: "Not just shapes — print-ready files. Oriented, checked, sliced for your Bambu A1."

## Beat 4 — Model search (Browserbase)

Click "Find an existing model" → search "benchy" → curated + live Printables results.
Click "Use this" on 3DBenchy → imports into the studio with Print Brain analysis.

**Line**: "Why generate when a great model already exists? Browserbase searches the web for you."

## Beat 5 — Refine in place

After a model builds, type "make it twice as tall" → v2 appears. Click v1/v2 in the version rail.

**Line**: "Edit by talking. Every version is saved."

## DO-NOT-BREAK

- Prompt (typed or example chip) → real `/api/generate` → step-by-step mesh in the viewport
- The same stages writing to `tools/_watch/model.scad` for the native-app watch
- Send-to-printer button → printing state
- Deterministic generator (house/box/cylinder) works with ZERO keys (offline-safe fallback)
- Engine picker works (all 5 engines + Clean in Blender)
- Model search returns results (curated fallback when no Browserbase key)
- Prepare for print → readiness score + format downloads

## FIXTURES (cache at h18 → /demo-fixtures)

Pre-run all objects; save PNG renders, STLs, G-code, and a printed physical copy.
If wifi/API/printer dies, mockStream replays these identically.
Rehearse: x3 live, x1 fixtures-only (wifi-death drill).
