# Multi-engine generation: smart routing, transparent failures, + Fusion

Date: · Status: APPROVED (design) → spec review → plan

## 1. Context & motivation

The studio today exposes a `[OpenSCAD | Blender]` engine toggle. Under the hood the **"Blender"
choice silently means NVIDIA**: a *fresh* figure on the Blender engine is routed to NVIDIA NIM
(TRELLIS text→3D); real Blender `bpy` only runs on *edits*. This hidden split is the most likely
cause of the inconsistency Vraj observed — "mushroom house" looks great (NVIDIA) but "Luffy Gear 2"
or "Kratos" come out bad. The engine choice also **persists in localStorage**, so once OpenSCAD is
selected, an organic/character prompt silently lands on OpenSCAD → a garbage block.

Vraj has now installed **Fusion 360** and wants it integrated as a real engine, plus all four engines
(OpenSCAD, Blender, Fusion, NVIDIA) selectable separately and in combination. This **reverses two
items on the constitution's CUT list** ("multi-engine picker UI", "FreeCAD/Fusion") — done on Vraj's
explicit instruction. Vraj's request to "add them as options to choose" is the **authorization to touch
the engine-selection UI** (otherwise frozen by CLAUDE.md rule 3).

Verified live state:
- **Fusion MCP** = HTTP server hosted by Fusion itself at `http://127.0.0.1:27182/mcp` (PID = the
  Autodesk Fusion app). The Next.js backend can drive Fusion directly over HTTP MCP JSON-RPC — no
  Claude Code in the loop.
- **Blender** running, BlenderMCP addon socket `127.0.0.1:9876` OPEN (live path available).
- **OpenSCAD** installed (BOSL2 vendored at `tools/openscad-libs`).
- **NVIDIA NIM** key present (`NVIDIA_NIM`); TRELLIS text→3D endpoint working.

## 2. Goals / non-goals

**Goals**
- Four explicit, separately-testable engines: OpenSCAD · Blender · Fusion · NVIDIA.
- **Auto routing (default)** so a prompt always reaches the right engine — kills the silent-wrong-engine
  inconsistency. Manual override always available.
- **Transparent failures**: every engine/provider attempt surfaces its real status + reason as an
  inline chip in the build feed — no silent fallback (NVIDIA-broke / Blender-not-connected visible).
- **Fusion engine**: Claude-written `adsk` Python → runs in live Fusion via HTTP MCP → exports STL →
  normal mesh/estimate/printplan stream.
- **Combinations**: one primary generator + optional "Clean in Blender" post-step (the nvidia+blender
  combo). Optional "Open in Fusion" later.
- **Skills under the hood**: per-engine expertise primers injected into the generation prompts (the
  skills' know-how baked into the model instructions, not just dev-time).
- A WOW organic pipeline with a bounded self-inspect→retry, and an honest documented quality ceiling.

**Non-goals (YAGNI / deferred)**
- A free-form pipeline builder (only primary + post-step toggles).
- Paid meshgen providers (Rodin/Meshy/fal) — credit-gated, stay off.
- Self-hosted TRELLIS / fixed image→3D (the real character unlock) — documented as a known ceiling.
- Any change to persistence, auth, print-brain, or model-search beyond what these engines emit.

## 3. The four engines

| Engine | Mechanism | Best for | Bridge |
|---|---|---|---|
| **OpenSCAD** | deterministic TS gen + `claude -p` → `.scad`, BOSL2 | mechanical/parametric: gears, brackets, threads | subprocess |
| **Fusion** *(new)* | `claude -p` → `adsk` Python → run in live Fusion → export STL | precise parametric/history CAD | HTTP MCP `127.0.0.1:27182/mcp` |
| **NVIDIA** *(promoted)* | NIM TRELLIS text→3D → textured GLB + STL | organic/characters/creatures (the "wow") | HTTPS API |
| **Blender** | `claude -p` → staged `bpy` → live GUI build or headless | watch-it-build, procedural; **post-step cleanup** | socket `127.0.0.1:9876` |

**Disentangle**: NVIDIA becomes its own `engine` value (today's fresh-Blender behavior). The Blender
engine becomes the *real* staged-`bpy` build (live in the GUI), and is also the implementation behind
the "Clean in Blender" post-step. OpenSCAD and Fusion are the two parametric engines.

## 4. Engine routing — Auto (default)

`classifyEngine(prompt)` (pure, deterministic heuristic; optional `claude -p` upgrade behind a flag)
returns a recommended engine + a short human reason:
- character / figure / creature / person / animal / organic / "statue" / named IP → **NVIDIA**
- gear / bracket / mount / enclosure / thread / screw / bearing / "parametric" / "precise" → **OpenSCAD**
  (or **Fusion** when the user has set Fusion as their parametric preference — see UI)
- "watch it build" / "in blender" / simple procedural / when NVIDIA is down → **Blender**
- ambiguous → NVIDIA if it reads organic, else OpenSCAD.

`engine` request values become: `"auto" | "openscad" | "blender" | "fusion" | "nvidia"`. **Auto is the
default** so the demo is consistent. In Auto, the route resolves the concrete engine first and emits a
`plan` event naming the pick + reason ("looks like a character → NVIDIA"). A manual selection always
wins and is shown as chosen.

## 5. Generation contract changes

`POST /api/generate` body gains:
- `engine: "auto" | "openscad" | "blender" | "fusion" | "nvidia"` (default `"auto"`)
- `postSteps?: { cleanInBlender?: boolean }`

`AgentEvent` (additive — UI stays a pure consumer):
- reuse existing `kind:"tool"` with `status:"running"|"done"|"warn"|"error"` for every engine/provider
  attempt + connection state (the transparent-failure chips). Add tool `name` values as needed:
  `"engine_select"`, `"fusion_build"` (mapped into the existing union; `inspect_render` reused for the
  vision self-check). No breaking changes to the reducer.
- `summary.engine` widens to include `"fusion" | "nvidia" | "imported"` (string).

## 6. WOW organic pipeline (NVIDIA) + self-inspect→retry

Pipeline for the NVIDIA engine (and Auto→NVIDIA):
1. enrich prompt (Claude; folds clarify prefs + reference-image vision) — existing.
2. NIM TRELLIS text→3D, high sampling — existing.
3. **NEW — bounded self-inspect**: render the result (or use the GLB), ask Claude vision "does this
   clearly read as {subject}? score 0–1 + one-line reason". If score is below threshold AND time
   budget remains, **one** retry with stronger enrichment / a new seed. Hard-capped at 1 retry and a
   wall-clock budget so the demo never hangs (constitution rule 5). Surfaced as `inspect_render` chips.
4. always scale to real size (existing `meshScale`), Blender auto-cleanup (existing `glbToStl`).

**Honest ceiling (documented, not a bug)**: free TRELLIS text→3D is strong on iconic/simple forms and
weaker on specific named characters in specific poses. The real unlock is image→3D (NVIDIA hosted 500s;
needs self-host or a credit'd provider — deferred). For demo wow on hard named subjects, the **📎
reference-image** path is the recommended lever and will be surfaced in the UI hint.

## 7. Combinations = primary + post-steps

- **Primary**: exactly one of the four engines (or Auto).
- **Post-step toggle "Clean in Blender"**: after a non-Blender generation, import the mesh into Blender
  (live socket if up, else headless), run repair/weld/recalc-normals/decimate, re-export the cleaned
  STL, and stream it as the final mesh. Builds on existing `importGlbToLive` / `glbToStl`. Emits its own
  status chips (incl. "Blender not connected → skipped cleanup").
- "Open in Fusion" post-step is **out of scope for v1** (placeholder only).

## 8. Transparent failure surfacing (inline chips)

Every engine maps its attempts to `tool` events with truthful detail:
- NVIDIA: `generate_mesh running "asking NVIDIA NIM…"` → `done "NVIDIA NIM · textured"` OR
  `warn "NVIDIA NIM failed: <reason> → procedural fallback"` (the procedural step then shows too).
- Blender: `write_blender done "blender · live window"` / `"blender · headless"` / `error "Blender not
  connected — start the addon (N-panel → BlenderMCP → Connect)"`.
- Fusion: `fusion_build running "building in Fusion…"` → `done "Fusion · exported STL"` OR
  `error "Fusion not running — open Fusion 360"`.
- OpenSCAD: per-stage `render_preview` already reports errors; keep.
No engine silently swallows a failure; the user always sees which engine ran and why a fallback happened.

## 9. Fusion engine (`src/server/fusion.ts`)

- **Connection check**: MCP JSON-RPC `tools/call fusion_mcp_read {queryType:"document",operation:"open"}`
  to `http://127.0.0.1:27182/mcp`. If it errors → emit the "Fusion not running" chip and skip (Auto
  re-routes to OpenSCAD for parametric).
- **Generate**: `claude -p` writes a single `adsk` Python `run(_context)` function that builds the part
  (using the `cad-modeling` primer + relevant Fusion API doc snippets) and **exports an STL** to a known
  temp path (`adsk.fusion` export manager). Backend reads that STL → estimate/printplan/stream.
- **Bridge detail**: POST MCP JSON-RPC `tools/call` with name `fusion_mcp_execute`,
  `{featureType:"script", object:{script:"…"}}`. Handle the HTTP-MCP session/`Accept` headers
  (`application/json, text/event-stream`) and `initialize` handshake if the server requires it — pin
  down exactly in the plan via a probe.
- **Timeout** wrapping the whole Fusion call (constitution rule 5); errors → chip + Auto fallback.

## 10. Skills under the hood

A small `src/server/skills/` module exposes a **per-engine primer** string injected into that engine's
Claude prompt:
- `fusion` ← distilled `cad-modeling` skill (design intent, parametric features, sketch→feature flow) +
  a few Fusion API doc snippets fetched live via `fusion_mcp_read apiDocumentation` and cached.
- `blender` ← distilled `blender` / `blender-mcp` skill guidance (clean bpy: mesh ops, modifiers,
  export gotchas).
- `openscad` ← BOSL2 primer (formalize the guidance currently inline in `claudePlan`).
- `nvidia` ← prompt-enrichment is the skill (existing `promptEnrich`); no separate primer.

Mechanism = short constant primers (distilled once), **not** dumping full SKILL.md files into every
prompt (token cost). The loader returns `""` for engines without a primer so callers stay uniform.

## 11. UI (extend the toggle — authorized)

`src/components/AgentFeed` header toggle grows from `[OpenSCAD | Blender]` to
`[Auto · OpenSCAD · Blender · Fusion · NVIDIA]` + a small "Clean in Blender" checkbox, in the existing
design language (tokens, no new surface). The chosen engine drives the `engine` field; Auto shows the
resolved pick as a feed note. `Studio.tsx` maps the selection (and clears the stale-persisted-engine
footgun by defaulting to Auto). Keep components pure (props in, JSX out); Studio owns state.

## 12. Testing strategy

**Automated (non-visual, per the workflow rule):**
- `classifyEngine` unit tests (character→nvidia, gear→openscad, "watch in blender"→blender, ambiguous).
- Fusion bridge: a thin `fusionExec(script)` unit-tested against a mock MCP HTTP server (request shape,
  error handling); a live curl probe documented for the real server.
- Self-inspect scorer parsing (pure) tested with sample Claude outputs.
- Skills primer loader returns expected non-empty strings per engine.
- tsc + existing 52 tests stay green; route still streams valid AgentEvents (curl).

**Manual checklist for Vraj (each engine separately + a combo):**
1. OpenSCAD — "24-tooth herringbone gear with hex bore" → real BOSL2 gear, chips show `openscad`.
2. Fusion — "a parametric phone stand, 75mm tall" → builds in live Fusion, STL imported, chip `Fusion ✓`.
3. NVIDIA — "a chubby sitting dragon" → bright textured dragon, chip `NVIDIA NIM ✓ textured`.
4. NVIDIA + 📎 — upload a Kratos reference → closer result, chip shows vision-read.
5. Blender — "watch a small rocket build" → live GUI build, chip `blender · live window`.
6. Auto — type each of the above with Auto selected → correct engine auto-picked, reason shown.
7. Combo — "NVIDIA dragon" + "Clean in Blender" → cleaned mesh, cleanup chips.
8. Failure UX — stop Fusion / disconnect Blender / (simulate) NIM fail → the right red/warn chip shows.

## 13. Phasing (approved order)

1. Disentangle engines + Auto routing (`classifyEngine`) + transparent failure chips. *(backend-heavy,
   highest demo value — fixes the consistency pain)*
2. 4-engine picker UI + "Clean in Blender" toggle.
3. Fusion engine (new HTTP-MCP bridge).
4. NVIDIA self-inspect→retry + per-engine skills primers.

## 14. Risks & open questions

- **Fusion HTTP-MCP handshake**: confirm whether `initialize` + a session id are required before
  `tools/call`, and the exact `Accept`/content-type. Resolve with a curl probe in step 3 of the plan.
- **Fusion STL export path** on macOS sandbox: confirm a writable temp dir the add-in script can write
  and the backend can read (likely `os.tmpdir()` or the project's `public/generated`).
- **Self-inspect latency**: vision call + possible retry adds seconds; the wall-clock cap keeps the demo
  safe but may skip the retry under load — acceptable.
- **Blender-as-generator quality**: pure `bpy` organic is cruder than NVIDIA; Blender-primary is framed
  for "watch it build"/procedural, not for beating NVIDIA on organic. Documented, not a defect.

## 15. Files (anticipated)

Add: `src/server/fusion.ts` · `src/server/engineRoute.ts` (classifyEngine) · `src/server/skills/index.ts`
· `src/server/inspect.ts` (vision self-check) · tests for each.
Change: `src/app/api/generate/route.ts` (engine dispatch + chips + post-step) · `src/lib/agentStream.ts`
(pass engine/postSteps) · `src/components/AgentFeed.tsx` + `src/components/Studio.tsx` (picker) ·
`src/server/meshgen/index.ts` + `nim.ts` (surface provider reason) · `ARCHITECTURE.md`/`DESIGN.md`/
`DECISIONS.md`/`PROGRESS.md` (document the engines + CUT-list reversal).
