# CLAUDE HARDWARE — Complete Build Playbook
### UC Berkeley AI Hackathon · 24 hours · everything you need in one file

> **What this is:** Your zero-to-demo runbook. Top section = pre-event (do at
> home this week). Then hour-0 setup commands. Then the exact contents of all 6
> project `.md` files. Then the Claude Design prompts. Then the hour-by-hour
> build flow. Work top to bottom on the day; you shouldn't need to think, just
> execute.
>
> **Format note:** this is markdown on purpose — it's full of commands and file
> contents you'll copy-paste into a real project, and markdown survives that
> cleanly (a Word doc would mangle the code). Open it in any editor.

---

# PART 0 — DO THIS WEEK (before June 20, all legal prep — no project code)

## 0.1 Install these apps at home (heavy downloads, miserable on venue wifi)
- **Blender 4.x** — blender.org
- **OpenSCAD nightly** (Manifold backend) — openscad.org/downloads → snapshot
- **OrcaSlicer** — github.com/SoftFever/OrcaSlicer/releases
- **Bambu Studio** — bambulab.com/download (likely the venue printer brand)
- **Node.js LTS** — nodejs.org · **Python 3.11** (exactly 3.11) — python.org
- **Claude Code CLI** — install AND run the login flow at home
- **VS Code**, **Git**
- *(optional)* **Docker Desktop** — for local Redis fallback

## 0.2 Two setup steps that need network (do at home)
- Open OrcaSlicer and Bambu Studio once each → let them download printer/filament
  profiles (happens on first launch).
- Run `claude` login flow; log into claude.ai (Design) in your browser.

## 0.3 Verify the one risky thing — bpy
```bash
python3.11 -m venv ~/bpytest && source ~/bpytest/bin/activate
pip install bpy trimesh manifold3d
python -c "import bpy; print('bpy OK', bpy.app.version_string)"
```
If that prints a version, your hardest dependency works. (Then `deactivate`,
delete the folder — the pip cache stays warm.)

## 0.4 Research / decisions to close before the day
- **Email organizers NOW:** which printer models, which slicer, filament policy,
  is the print queue first-come? Every answer changes Saturday.
- **Mesh-gen bake-off** (in their web playgrounds, no code): run the same 3
  prompts + 1 image through **Tripo**, **Meshy**, **Hunyuan3D**. Pick ONE
  primary on watertightness + limb quality + speed. Get an API key for it.
- **Stage API keys:** Anthropic, Deepgram, Redis (Redis Cloud free tier),
  your chosen mesh-gen, Runpod (stretch).
- **Pick 3 demo objects:** one parametric (phone stand), one figure-from-image
  (your ORIGINAL character — no named IP), one hybrid w/ swappable joints. Each
  small enough to print < 90 min.
- **Joint research:** ball Ø, socket clearance 0.3–0.4mm, min wall 1.6mm — this
  becomes your connector library specs.

## 0.5 Airplane-mode readiness test (the one test that matters)
On airplane mode at home you can: scaffold a Next.js app · `import bpy` ·
render an STL → PNG · repair a mesh with trimesh · slice an STL → G-code.
If all five work offline, wifi can't kill your core loop.

---

# PART 1 — HOUR-ZERO SETUP (run at the venue, ~10 min)

## 1.1 Scaffold the project
```bash
npx create-next-app@latest claude-hardware --typescript --tailwind --app --eslint
cd claude-hardware
npm i three @react-three/fiber @react-three/drei \
      @anthropic-ai/claude-agent-sdk @modelcontextprotocol/sdk \
      redis zod
# python side (mesh tools), in a venv inside the repo:
python3.11 -m venv .venv && source .venv/bin/activate
pip install bpy trimesh manifold3d
```

## 1.2 Create the folder skeleton
```bash
mkdir -p src/components src/design src/lib tools \
         demo-fixtures design-reference public/fonts docs
```

## 1.3 Drop in the 6 .md files (contents in PART 2)
Create each at the repo root (or in /docs, your call — keep CLAUDE.md at root
so Claude Code auto-reads it):
`CLAUDE.md  PROGRESS.md  DECISIONS.md  ARCHITECTURE.md  DESIGN.md  DEMO.md`

## 1.4 Self-hosted fonts (no CDN dependency in the demo)
Download Inter + JetBrains Mono `.woff2` into `public/fonts/` and wire them in
`globals.css`. (Grab these at home in 0.1 if you can.)

## 1.5 Start the background services (keep a terminal tab per service)
```bash
# Redis (pick one):
docker run -p 6379:6379 redis:alpine        # local fallback
# ...or just use your Redis Cloud connection string in .env

# Verify the engines respond (smoke test, not a server — these are CLIs):
openscad --version
python -c "import bpy, trimesh; print('engines ok')"
orcaslicer --help 2>/dev/null | head -1 || echo "use Bambu Studio CLI"
```
> Blender/OpenSCAD/slicer are NOT long-running servers — your agent shells out
> to them per call. "Start Blender in the background" = just confirm `bpy`
> imports; there's no daemon to babysit. The only persistent service is Redis.

## 1.6 `.env` (never commit)
```
ANTHROPIC_API_KEY=...
DEEPGRAM_API_KEY=...
MESHGEN_API_KEY=...
REDIS_URL=redis://localhost:6379
```

---

# PART 2 — THE 6 PROJECT FILES (paste each verbatim)

## ───────────── FILE 1: CLAUDE.md ─────────────
```markdown
# CLAUDE HARDWARE — agent constitution

Mission: Claude Code for physical objects. A user describes or shows an object;
this agent designs it, INSPECTS ITS OWN RENDER, fixes its own mistakes, slices,
and prints on the venue printer. Track: Lab. Demo time: [FILL]. Hour-0 was
[FILL]; the cut lines below are absolute.

## Stack
Next.js + TS + Tailwind · react-three-fiber/drei viewport · Claude Agent SDK ·
OpenSCAD CLI (parametric) · [Tripo|Meshy] API (figure mesh) · headless bpy
(studio ops: joints, repair, inspection renders) · trimesh + manifold3d
(validate) · OrcaSlicer/Bambu CLI (slice) · Redis (state) · Deepgram (voice).

## Engines (LOCKED — do not add others)
- PARAMETRIC = OpenSCAD. Agent writes .scad; CLI renders PNG + exports STL.
- FIGURE = mesh-gen API. Image/text → mesh.
- STUDIO OPS = headless bpy. Cut meshes, insert joints from the connector
  library, repair, render inspection angles.
- Joints come from a PRE-BUILT connector library; no freeform joint synthesis.
- Pose comes from the reference image; no text re-posing.
- CUT: FreeCAD, Fusion, Tinkercad, "Auto/Precise/Organic/Pro" routing.

## RULES — every session, no exceptions
1. SESSION START: read PROGRESS.md + DECISIONS.md before writing any code.
   Resume from PROGRESS "NEXT". Never re-litigate a settled decision.
2. TASK DONE / SESSION END: update PROGRESS.md FIRST, then continue or stop.
3. Never modify src/components/, src/design/, or DESIGN.md unless the
   instruction literally contains "change the design".
4. All dynamic UI data flows through the AgentEvent interface (ARCHITECTURE.md).
   UI components are pure: typed props in, JSX out. UI never imports backend.
5. Every external process (openscad, bpy, slicer) runs in a subprocess WITH A
   TIMEOUT. One bad mesh must never hang the loop.
6. No new dependencies after hour 18. No refactors after hour 20.
7. Blocked >20 min on one bug → log it to PROGRESS BLOCKED with what you tried,
   switch to the next task, tell Vraj.
8. Anything in DEMO.md "do-not-break" is frozen after hour 20.
9. Keep file updates terse. PROGRESS.md is a state board, not a diary.

## PHASE MAP (cut lines)
MUST   (h0–10): UI shell vs mock stream · scad→render→inspect→fix loop ·
                STL export · slice CLI · viewport states
SHOULD (h10–18): mesh-gen engine · mesh repair · joint cut+insert · Deepgram ·
                version rail · send_to_printer (real)
STRETCH (h18–22): MCP-server wrapper · Runpod mesh-gen port · landing page ·
                hybrid demo polish · printer cam
FROZEN: h20+ demo paths locked · h22+ code freeze except demo-path bugs
```

## ───────────── FILE 2: PROGRESS.md ─────────────
```markdown
# PROGRESS — updated [hh:mm] (hour [n]/24)

## DONE
- [x] (nothing yet)

## IN PROGRESS
- [ ] task — session A/B — started hh:mm

## BLOCKED
- [ ] thing — what was tried — needs: [decision | key | Vraj]

## NEXT (ordered)
1. Scaffold + 6 files + services up
2. Claude Design shell → handoff → mock stream renders in UI
3. OpenSCAD tool: write_scad → render_preview (PNG)
4. inspect_render (vision) → fix loop on a deliberately-bad .scad
5. export STL → slice CLI → G-code
6. viewport states wired to AgentEvent

## CUT (decided — do not revisit)
- multi-engine picker UI · FreeCAD/Fusion · virtual-only printer · 48h scope
```

## ───────────── FILE 3: DECISIONS.md ─────────────
```markdown
# DECISIONS — append-only (newest at top). Format: [hh:mm] choice — why.

[h0] Engines locked to OpenSCAD + mesh-gen + bpy — scope for 24h, demo legibility.
[h0] Printers are provided on site — Print stage is live; simulation = fallback.
[h0] Name = Claude Hardware (pitch lineage); fallback swap is find/replace.
[h0] Demo uses original characters only — no named IP (permanent Devpost page).
[h0] Sponsor build = Anthropic + Deepgram + Redis; Runpod + MCP-server = stretch.
```

## ───────────── FILE 4: ARCHITECTURE.md ─────────────
```markdown
# ARCHITECTURE

## The contract (the ONE interface UI and backend share)
type AgentEvent =
  | { t: string; kind: "plan" | "fix"; text: string }
  | { t: string; kind: "tool";
      name: "write_scad" | "generate_mesh" | "repair_mesh" | "add_joints"
          | "render_preview" | "inspect_render" | "validate" | "slice"
          | "send_to_printer";
      status: "running" | "done" | "warn" | "error"; detail: string }
  | { t: string; kind: "inspect"; ok: boolean;
      marker?: { x: number; y: number; z: number; note: string } }
  | { t: string; kind: "print"; printer: string; layer: number;
      totalLayers: number; etaMin: number }
  | { t: string; kind: "summary"; text: string };

- src/lib/mockStream.ts  → emits the DEMO.md sequence on a timer (build UI on this)
- src/lib/agentStream.ts → same interface, real backend (swap in later)
- UI must not know which one it's consuming.

## Agent tool loop (server side)
plan → choose engine → generate (write_scad | generate_mesh)
     → render_preview (PNG, 3–4 angles)
     → inspect_render (vision: Claude looks at the PNGs, returns ok/marker)
     → if !ok: fix (edit code / adjust mesh) → re-render → re-inspect
     → validate (trimesh: watertight, walls, overhangs)
     → [hybrid] add_joints (bpy: cut + insert connector from library)
     → slice (CLI → G-code) → send_to_printer

## Engine call patterns (all subprocess + timeout)
OpenSCAD render:  openscad -o a.png --imgsize=1024,1024 --autocenter --viewall \
                  --camera=0,0,0,55,0,25,140 model.scad
OpenSCAD export:  openscad --backend=Manifold -o model.stl model.scad
OpenSCAD param:   openscad -D height=108 -o model.stl model.scad   # fast refine
Mesh validate:    trimesh.load("m.stl").is_watertight / .bounds
bpy ops:          run a generated python script via subprocess, timeout 60s
Slice:            orcaslicer --load printer.ini --export-gcode -o out.gcode m.stl

## Directories
src/components (pure UI) · src/design (tokens) · src/lib (streams, engine calls)
tools/ (python: bpy scripts, connector library) · demo-fixtures/ (cached runs)
```

## ───────────── FILE 5: DESIGN.md ─────────────
```markdown
# DESIGN — source of truth from the Claude Design handoff bundle.
# READ-ONLY to the agent unless an instruction says "change the design".
# (Replace this file's body with the exported bundle's design system on the day.)

System: "Hardware Dark" — dark inversion of the Trunk Minimal CI system.
Soul: monochrome, ONE semantic green, flat depth, thin borders, pill controls.
NEVER: shadows, gradients, glassmorphism, decorative glow, uppercase tracking,
>1 green-filled button per screen, spinners.

Tokens:
canvas #08090B · surface #0D0F12 · inset #121519 · border #232323 ·
border-subtle #1A1C20 · text #E2E8F0 · text-2nd #8B919A · faint #5A6069 ·
accent #00A44A · accent-weak #5ACB82 · warn #F0A020 · error #D92D20

Type: SANS (Inter) = human; MONO (JetBrains Mono) = machine. Apply ruthlessly.
Motif: the layer line — accumulating 1px horizontal lines for dividers,
progress fills, and the forming animation. The only flourish.

Five hero moments (see DEMO.md): Boot · Forming · Inspection (amber marker
pinned to the geometry flaw) · Studio (exploded joint insertion) · Send-to-print.
```

## ───────────── FILE 6: DEMO.md ─────────────
```markdown
# DEMO — 90 seconds, 3 beats. FROZEN at hour 20.

## Beat 1 — Functional (~30s)
Mic: "A phone stand with a 15° angle and a cable slot"
→ chip [⚙ parametric] → feed: plan→write_scad→render→⚠ slot intersects wall
→ fix→clean → viewport forms bottom-up, settles. Line: "it caught its own mistake."

## Beat 2 — Figure (~35s)
Drop original-character image → chip [⚙+✦ hybrid]
→ generate_mesh→repair→add_joints→⚠ socket wall thin→fix→validate
→ STUDIO moment: parts separate, sockets slide in, snap. → design notes panel.

## Beat 3 — Physical (~25s)
Print Center "14g PLA · 1h 23m" → Send to printer → point at the real printer
→ hand judge YESTERDAY'S printed articulated figure. Close:
"Claude Code writes software. This one ships objects. Yours is done in an hour."

## DO-NOT-BREAK (frozen h20)
- mic → transcript → parametric generate → inspect/fix → forming animation
- image drop → hybrid feed → studio exploded animation
- Send-to-printer button → printing state
- fixtures fallback path (below)

## FIXTURES (cache at h18 → /demo-fixtures)
Pre-run all 3 objects; save PNG renders, STLs, G-code, and a printed physical
copy of the hybrid figure. If wifi/API/printer dies, mockStream replays these
identically. Rehearse: ×3 live, ×1 fixtures-only (wifi-death drill).
```

---

# PART 3 — CLAUDE DESIGN (hour 0, in the browser — parallel to setup)

## 3.1 Master prompt — paste into Claude Design, attach trunk.io-design.md
> Use the full FINAL master prompt (the five-hero-moments version). It's long;
> keep it in its own file on your USB stick as `hour-zero-master-prompt.md` and
> paste the PROMPT 1 block. Summary of what it must contain so you can sanity-
> check the paste: Hardware Dark tokens · sans/mono grammar · layer-line motif ·
> three-panel layout · the 5 hero moments (Boot, Forming, Inspection w/ pinned
> marker, Studio exploded joints, Send-to-print) · both feed sequences · the
> PrinterLoader ASCII frames · clickable mode-chip override · motion law · the
> deliverable list.

## 3.2 After the first pass
Fire iteration prompts only where weak (the master file lists 8). Priorities:
Inspection state (the soul), Studio exploded view, feed legibility.

## 3.3 Export → Hand off to Claude Code
Use the Handoff Block (below). Commit the bundle to /design-reference first.

### HANDOFF BLOCK (paste into Claude Code with the export bundle)
```
You're implementing the CLAUDE HARDWARE workspace from the attached Claude
Design bundle. Stack: Next.js (App Router) + TS + Tailwind + Three.js.
1. DESIGN IS A CONTRACT — reproduce the bundle exactly. All tokens in
   src/design/tokens.ts + the tailwind theme. No hardcoded colors/sizes elsewhere.
2. PRESENTATIONAL COMPONENTS ONLY — everything in src/components/ is pure:
   typed props in, JSX out. No fetching, no agent imports inside components.
3. ONE ADAPTER LAYER — all dynamic data flows through the AgentEvent interface
   in ARCHITECTURE.md. Implement src/lib/mockStream.ts (emits the DEMO.md
   sequence on a timer) and src/lib/agentStream.ts (same interface, real
   backend). The UI must not know which it consumes.
4. VIEWPORT STATE MACHINE — empty | forming | complete | inspecting | studio,
   driven only by events. Mesh loads from an STL url prop.
5. PRINTERLOADER — a <pre> cycling the bundle's exact ASCII frames via one
   interval; variants sm | md; respects prefers-reduced-motion.
6. LATER BACKEND CHANGES: do NOT touch src/components/, src/design/, or
   DESIGN.md unless I say "change the design". Backend work lives in src/lib/,
   src/app/api/, tools/.
Commit the design bundle to /design-reference before writing code.
```

## 3.4 Landing page — PROMPT 2 (Sunday morning ONLY, if core loop is done)
```
Using my attached Trunk Minimal CI design system EXACTLY as written (light,
white canvas, editorial, green accent — do NOT dark-invert it), design a single
landing page for CLAUDE HARDWARE, the agentic fabrication studio.
Hero: display headline "Describe it. Hold it." + body-lg subline "An engineering
agent that turns plain language into manufacturable objects — it designs,
inspects its own work, and hands you a print-ready file." Primary black pill
"Open the studio", tertiary link "Watch the 90-second demo".
Below: one large thin-framed (#232323) screenshot slot of the dark studio (the
light page framing the dark app is the intended contrast). Then three quiet
body-md columns: "It catches its own mistakes" / "It explains every engineering
choice" / "From a sentence to G-code". Thin layer-line divider, one-line footer.
No pricing, no testimonials, no feature grid. One screen of restraint.
```

---

# PART 4 — DEVELOPMENT FLOW (hour by hour)

## The two-track principle
Frontend (Claude Design → Claude Code, builds against `mockStream`) and backend
(the agent tool loop) develop IN PARALLEL and meet ONLY at the `AgentEvent`
interface. This is your Agent-Farm instinct: clean boundary, no collisions. If
solo, alternate; if you have help, split by the directory boundaries in CLAUDE.md.

## h0–2 — Foundations
- Setup (PART 1) done; 6 files in place; Redis up; engines smoke-tested.
- Claude Design master prompt fired; first pass reviewed; handoff to Claude Code.
- Claude Code scaffolds the shell against `mockStream` → the UI already "runs"
  the demo on mock data. **You now have a demoable shell on hour 2.**

## h2–6 — The core loop (the heart)
- `write_scad` tool: Claude writes a .scad, CLI renders PNG. 
- `inspect_render`: feed the PNGs to Claude vision; return ok/marker. Test it on
  a DELIBERATELY broken .scad (slot through a wall) so the ⚠→fix→clean episode
  is real, not staged.
- `render_preview` loop closes; `export STL`; `slice` CLI → G-code.
- Wire real events into `agentStream.ts`; flip the UI from mock to real for the
  parametric path. **Milestone: speak → parametric object → sliced. Beat 1 works.**

## h6–12 — Figure + studio
- Mesh-gen API integration (`generate_mesh`); `repair_mesh` via trimesh.
- Connector library (ball-socket params) + `add_joints` bpy script: cut at
  planned seams, boolean-insert connectors, re-validate.
- Studio exploded animation wired to the add_joints events.
- Deepgram voice input. **Milestone: image → articulated hybrid. Beat 2 works.**

## h12–18 — Real printer + polish
- `send_to_printer` → slicer profile → printer (Bambu/Orca CLI or network API).
- Version rail, design-notes panel populated from validate events.
- First REAL test print queued by ~h18 (queues clog Sunday — anything judges
  hold must start printing Saturday night).
- Stretch if ahead: MCP-server wrapper (expose your tools — "the missing MCP
  server for fabrication"), Runpod mesh-gen port, printer cam.

## h18–20 — Freeze prep
- Cache all 3 demo objects → /demo-fixtures (renders, STLs, G-code) + print the
  physical hybrid figure.
- DEMO.md locked. Rehearse ×3 live.

## h20–22 — Lock
- Feature freeze. Rehearse ×1 fixtures-only (wifi-death drill). 
- Landing page (Prompt 2) only if everything above is solid.

## h22–24 — Code freeze + ship
- Only demo-path bugfixes, each logged in DECISIONS.md.
- Devpost: title, 90s video (record a clean run now as backup), original-IP
  screenshots, the lineage one-liner. Submit with buffer.

---

# PART 5 — FAILURE DRILLS (pin these)
- **Wifi dies** → fixtures replay via mockStream; demo is identical. Hotspot for
  the small API calls (Anthropic/Deepgram/mesh-gen); installs are already done.
- **Mesh-gen API down** → switch to a cached mesh fixture; or self-hosted Runpod
  if you built it.
- **bpy crashes on a mesh** → subprocess timeout catches it; agent logs warn,
  falls back to the un-jointed mesh; demo uses the cached articulated figure.
- **Printer queue jammed** → the in-hand printed figure IS the payoff; the live
  send still shows the pipeline working.
- **Deepgram unreachable** → Web Speech API fallback (browser, zero deps); mic
  button swaps provider behind one function.
- **OpenSCAD hangs** ($fn too high on minkowski) → timeout + retry with lower $fn.

---

# THE ONE-LINER (say it in the pitch, don't brand it)
"Claude Code writes software. Claude Cowork does knowledge work. This is the
missing one — an agent whose output is a physical object. You talk; it designs,
checks its own work, and prints."
