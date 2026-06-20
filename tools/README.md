# tools/

Python-side engine helpers (run as subprocesses with timeouts, per CLAUDE.md):
- bpy scripts: mesh repair, joint cut + connector insertion, inspection renders
- connector library: pre-built ball-socket params (Ø, clearance 0.3–0.4mm, min wall 1.6mm)
- OpenSCAD / slicer wrappers

Run against the 3.11 venv: `source ../.venv/bin/activate`.
