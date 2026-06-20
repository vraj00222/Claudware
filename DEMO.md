# DEMO — live, prompt-driven. (Updated: the scripted phone-stand auto-demo was removed.)
# The app boots to an empty "describe anything" state; the demo IS typing a real prompt and
# watching the model actually build (real OpenSCAD generation, not a script).

## Beat 1 — Describe → watch it BUILD (~30s)   [LIVE today]
Type / pick "a block house with 2 windows and a door" → PNG RenderLoader while it designs →
feed streams plan→write_openscad→render_preview×N → the viewport assembles STEP-BY-STEP
(base → walls → door → 2 windows → gable roof). Line: "you describe it; it builds it, printable."

## Beat 2 — Watch it build in a REAL CAD app too (~20s)   [LIVE today]
Have OpenSCAD open on tools/_watch/model.scad (Design → Automatic Reload). The SAME build
appears stage-by-stage in the native app as the agent writes it. (Blender path = Phase B.)

## Beat 3 — Print (~25s)
Print Center shows DYNAMIC stats from the model (grams/time/layers) → Send to printer →
point at the real printer / hand judge a printed piece. Close:
"Claude Code writes software. This one ships objects."

## DO-NOT-BREAK
- prompt (typed or example chip) → real /api/generate → step-by-step mesh in the viewport
- the same stages writing to tools/_watch/model.scad for the native-app watch
- Send-to-printer button → printing state
- deterministic generator (house/box/cylinder) works with ZERO keys (offline-safe fallback)

## FIXTURES (cache at h18 → /demo-fixtures)
Pre-run all 3 objects; save PNG renders, STLs, G-code, and a printed physical
copy of the hybrid figure. If wifi/API/printer dies, mockStream replays these
identically. Rehearse: ×3 live, ×1 fixtures-only (wifi-death drill).
