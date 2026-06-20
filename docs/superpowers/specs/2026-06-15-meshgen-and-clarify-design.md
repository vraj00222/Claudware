# Meshgen + Clarify-First — design

Real text→3D generation for figures/organic models (Hyper3D Rodin + NVIDIA NIM), a textured GLB
preview in the viewport, clarifying questions before generating, and a search-import fix. Supersedes
the procedural-bpy-only figure path. ROADMAP lines 59–110 + 137–139 are the backlog this realizes.

## Why (the bug + the gaps)

- **Every figure prompt → the same blob.** `engine:"blender"` calls `claudeBpyPlan()`; it throws every
  time (timeout/parse-fail) and falls to `fallbackBpyPlan` — a single hardcoded creature
  (body+head+eyes/ears/feet). Evidence: the UI says "**figure** ready" and only the fallback sets
  `object:"figure"`; the steps `base_body → add_head → add_features (+ eyes, ears, feet)` are that
  fallback's literal labels. So "dragon", "vase", everything → one snowman. (Tests 1 & 5.)
- **Size ignored.** "a vase 30 cm tall" came out 39 mm — the fallback never reads the prompt, and
  nothing scales the mesh to a requested real-world size. Print Brain's split logic therefore never trips.
- **Search dead-ends.** Login-walled live results show only "View on Printables ↗" — no way to use them
  here. (Test 4.)

## Goals

1. A real text→3D path so "a chubby sitting dragon with folded wings" produces a recognizable, detailed,
   **textured** dragon — with scales/skin — not a blob.
2. See the texture/color on screen (printability unchanged — single-material printers print geometry only).
3. Ask the user the *right* questions first (scales vs feathers, pose, reference, **size**) so the result
   matches intent, and so size is honored (fixes the 30 cm bug).
4. Make any search result usable ("Make this with AI") instead of a dead-end link.

## Non-goals (this push)

- Replacing OpenSCAD for mechanical/parametric parts — that path is good and stays the default for parts.
- Print-ready guarantees on raw meshgen output beyond what Print Brain v1 already does (measure /
  one-piece-vs-split / supports flag / Download STL). Mesh repair/decimate is best-effort here.
- Browserbase-Sessions authenticated downloads (still a later stretch; "Make this with AI" covers test 4).
- Real multi-material/color PRINTING. Texture is preview-only.

---

## Architecture overview

```
prompt ──▶ /api/clarify (JSON)         ── classify + 0–3 questions (chips)
   │            ▲ answers folded into prompt + size→scale target
   ▼
/api/generate (SSE, unchanged contract)
   ├─ engine "openscad" → parametric (unchanged)
   └─ engine "blender"/figure → generateMesh(req)  ── meshgen seam (NEW)
                                   ├─ rodin.ts   (BlenderMCP socket; LIVE in GUI; STL+GLB)
                                   ├─ nim.ts     (NVIDIA NIM TRELLIS/Edify; cloud; GLB→STL)
                                   └─ procedural.ts (today's claude bpy / fallback; zero-key)
                                          │
                              final STL (+ optional textured GLB)
                                          ▼
                     estimate ─ uploadFinalStl ─ buildPrintPlan ─ summary
                                          ▼
                          viewport: GLB (textured) if present, else STL
```

The UI engine toggle stays `[OpenSCAD | Blender]`. Under the hood the **Blender/figure path becomes
meshgen-first** with procedural as the last-resort fallback. No new UI engine; no design churn beyond the
viewport's new GLB support (§2).

---

## 1. Meshgen provider seam — `src/server/meshgen/`

Mirrors `src/server/modelSearch/`. Pure provider modules behind one entry point; key/availability-gated;
first success wins; always falls back so the route never hard-fails.

- `types.ts`
  - `MeshGenRequest { prompt: string; refImageUrl?: string; preferLive: boolean; sizeMm?: number }`
  - `MeshGenResult { stlPath: string; glbPath?: string; textured: boolean; provider: "rodin"|"nim"|"procedural"; live: boolean }`
- `index.ts` — `generateMesh(req): Promise<MeshGenResult>`; tries providers in order, catching each:
  1. `rodin` (if BlenderMCP socket up — `preferLive`)
  2. `nim` (if `NVIDIA_NIM` set)
  3. `procedural` (always)
- `rodin.ts` — drives the **BlenderMCP addon socket** (127.0.0.1:9876), reusing `blenderSend` from
  `blender.ts`. Flow = the addon's Rodin pipeline: `create_rodin_job` (text→3D) → poll
  `poll_rodin_job_status` → `import_generated_asset` → the textured mesh lands in the **live Blender
  scene** (user watches). Then export **STL** (ascii, Z-up — reuse `wrapStage`'s export tail) **and GLB**
  (`bpy.ops.export_scene.gltf`, keep materials) from that same scene. Key is the addon's own free-trial
  key (set via "Set Free Trial API Key"); nothing in our env. **Exact socket `type` strings verified from
  the installed addon source at implementation** (blender-mcp exposes `create_rodin_job` /
  `poll_rodin_job_status` / `import_generated_asset` / `get_hyper3d_status`).
- `nim.ts` — **NVIDIA NIM** cloud (`NVIDIA_NIM=nvapi-…`). `text-to-3d` (and `image-to-3d` for refs) via
  **MSFT TRELLIS** (fast) by default; **Shutterstock Edify 3D** option for 4K-PBR finals. POST prompt
  (+ optional `refImageUrl`) → receive a GLB (asset URL or base64) → write GLB → convert to STL in
  **headless Blender** (`blender --background --python`: import GLB, export STL). Textured GLB kept for
  preview. **Exact endpoint + request/response shape verified from each model card at implementation.**
- `procedural.ts` — thin wrapper over the existing `claudeBpyPlan`/`fallbackBpyPlan` so the zero-key path
  is unchanged. Returns `{ stlPath, textured:false, provider:"procedural" }` from the final stage's STL.

Every external call runs in a subprocess/socket **with a timeout** (constitution rule 5). One bad job
must never hang the stream.

## 2. Textured GLB preview + viewport (the one design touch)

- `mesh` AgentEvent gains optional `glbUrl?: string` and `textured?: boolean`.
- **Viewport**: if `glbUrl` present → load via **GLTFLoader**, keep PBR materials (you SEE scales + skin
  color); else STL via STLLoader as today. Keep the imperative load (no flicker). Frame/scale to fit.
- **Print Brain + Download STL always use the STL** — print-accurate, single-material.
- `ProjectVersion` persists both `meshUrl` (STL) and `glbUrl`; reopen/version-switch restores the textured
  preview. This is the "change the design" touch (viewport gains GLB); DESIGN.md updated.

## 3. Clarify-first — `POST /api/clarify`

A pre-step (not part of the AgentEvent build loop — same separation as search's `SearchEvent`).

- Request `{ prompt, engine }` → Response `{ kind, questions: Question[] }`.
  `Question { id, label, options: string[], allowFreeText: true, skippable: true }`.
- Server logic = fast `claude -p` (JSON-ish, delimiter-parsed) **with a keyword-heuristic fallback** so it
  works zero-key and never blocks generation:
  - **Every prompt** → one light generic question, e.g. *"About how big? palm · hand · display-size"* (maps
    to a target height in mm).
  - **Organic figure / named character** (dragon, creature, "build Kratos") → richer prompt-specific
    questions: skin (*scales / smooth / feathered*), pose, *reference image?*, style.
  - **Precise part** (bracket, mount) → just size, then build.
- **UI**: a small in-conversation **clarify card** built from existing chip styling (landing tokens):
  chips per question + a free-text field + **Skip**. On submit, answers fold into the generation prompt:
  `…\nPreferences: skin=scales; pose=sitting; size≈30cm`. A chosen size sets `sizeMm` on the meshgen
  request.
- **Size → scale step** (fixes test 5): after meshgen, scale the mesh so its tallest axis ≈ `sizeMm`
  (uniform scale, recompute bbox), then estimate/print-plan. Now "30 cm" really is 300 mm and Print Brain
  splits correctly against the 220×220×250 bed.

## 4. Search-import fix — "Make this with AI" (test 4)

- In `ModelSearchPanel`, every card keeps its source link, and login-walled results gain a primary action
  **"✨ Make this with AI"** → calls a generate flow with the result's **thumbnail as `refImageUrl`** (and
  title as prompt) → NIM `image-to-3d` (TRELLIS/Edify) or Rodin → a printable, textured version appears in
  the studio (reusing the import→estimate→print-plan→viewport path). No more dead ends; showcases meshgen.
- Directly-downloadable results still "Use this" (unchanged). Curated importable library unchanged.

## 5. Build/run progress (presentation)

Meshgen yields one final mesh, not cumulative stages. The web feed shows **honest** progress —
`plan: designing "<prompt>"` → `tool: generating mesh · Rodin (live)` → `tool: importing` →
`mesh` (final textured reveal) → `validate` → `estimate` → `printplan` → `summary`. When BlenderMCP is
connected the user **also watches the mesh build/import live in the Blender GUI**. No fake intermediate
geometry (avoids glitches). Procedural fallback still streams its real cumulative stages.

---

## Interfaces touched (small, additive)

- `AgentEvent.mesh`: `+ glbUrl?`, `+ textured?` (back-compatible; STL-only events unaffected).
- `viewModel` reducer: carry `glbUrl`/`textured` onto the current mesh.
- `ProjectVersion`: `+ glbUrl?`.
- New routes: `POST /api/clarify` (JSON). `/api/generate` accepts `+ sizeMm?`, `+ refImageUrl?`. `/api/import`
  reused by "Make this with AI" (already streams the right events) or a thin `/api/generate` image path.
- New: `src/server/meshgen/{types,index,rodin,nim,procedural}.ts`; `src/lib/clarify.ts` (client) +
  `ClarifyCard` component (chip styling).

## Provider matrix + keys (setup)

| Provider | Input | Output | Key / setup | Role |
|---|---|---|---|---|
| **Hyper3D Rodin** (addon) | text (img later) | textured mesh in live Blender → STL+GLB | free-trial key **in the Blender addon** ("Set Free Trial API Key" ✓); BlenderMCP **Connected** (9876) | **primary**, live wow |
| **NVIDIA NIM — TRELLIS** | text + image | GLB → STL | `NVIDIA_NIM=nvapi-…` in `.env.local` ✓ | cloud fallback, fast, ref-image |
| **NVIDIA NIM — Edify 3D** | text + image | GLB + 4K PBR → STL | same key | textured finals (option) |
| **Procedural (claude bpy)** | text | STL | none | zero-key last resort |

User-side: Rodin key set in addon ✓ · `NVIDIA_NIM` set ✓ (the `nvapi-` secret; the UUID is just the key
ID) · keep BlenderMCP Connected for the live path · restart `npm run dev` after env. With **no** keys the
app still boots/demos on the procedural fallback (constitution).

## Risks / mitigations

- **Rodin socket flow undocumented in README** → verify exact `type` strings from the installed addon
  source before wiring; headless GLB-import path is the same regardless. If Rodin is down → NIM → procedural.
- **NIM request/response shape** → confirm per model card; isolate in `nim.ts` behind `MeshGenResult`.
- **GLB→STL fidelity / non-manifold** → Print Brain already tolerates imported meshes (binary+ascii STL);
  decimate/repair is best-effort and out of scope to perfect here.
- **Free-tier limits** (Rodin/day, NIM credits) → provider fan-down + procedural fallback keep the demo alive.
- **Latency** → meshgen is slower than parametric; the live Blender view + honest progress steps cover the wait.

## Skills to evaluate (better generation)

Run `find-skills` for Blender/bpy, 3D-generation, and texturing/material skills; install the useful ones
(e.g. procedural-modelling, material/PBR helpers) and note them here. Non-blocking; improves prompt→bpy and
GLB handling quality.

## Build sequence (detail in the plan)

1. meshgen seam (`types`/`index`/`procedural`) + route rewire (figure path → `generateMesh`), procedural
   parity first (no regression).
2. `nim.ts` (TRELLIS text→3d) → real textured dragon via cloud; GLB→STL convert; viewport GLB support.
3. `rodin.ts` (addon socket, live) — primary.
4. `/api/clarify` + `ClarifyCard` + prompt-fold + `sizeMm` scale step (fixes 30 cm).
5. "Make this with AI" in search (test 4).
6. Persist `glbUrl`; DESIGN.md/ROADMAP/DECISIONS/PROGRESS updates; find-skills pass.
