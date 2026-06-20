# Model Search — "reuse before regenerate" (Browserbase) — design

Date: · Status: APPROVED (Vraj) · Sponsor: **Browserbase #6**
Spec for: a web-using agent that finds existing free 3D models so beginners can *reuse* one
instead of always generating from scratch. Sits behind a `ModelSearch` provider, key-gated with a
zero-key fallback (constitution: the app boots/demos with no keys).

## Goal / success criteria
- A user can, from the studio, **search free model repos** for a generic object ("a 20mm hex bolt",
  "a Pikachu") and see real candidates with thumb, title, author, **license**, and source.
- Picking one **imports it into the studio**: it appears in the viewport, gets the full Print Brain
  readout (dimensions / split / supports) + estimate, is **Downloadable**, and is **saved to their
  project** — with attribution. No further generation/computation on our end.
- Uses **Browserbase** for the real web fetch (anti-bot / proxy / verified browser).
- Works with ZERO keys via a curated fallback so the app always boots/demos.

## Decisions (locked with Vraj)
- **Live Browserbase now** (key provided, in `.env.local`). Still behind the `ModelSearch` seam with a
  fallback (constitution rule: key-gated adapter + fallback).
- **Trigger = Both**: an explicit **`🔍 Find existing`** action (always available, next to `✨ Design it`)
  AND a proactive **smart hint** ("ready-made versions exist →") when a cheap classifier thinks the ask
  is a common object.
- **Sources = parallel fan-out across all repos, merged.** Build **Printables first** (public pages, no
  login wall, direct STL, clear CC license = easiest + cleanest attribution), then add Thangs /
  Thingiverse / MakerWorld into the same parallel fan-out. (Vraj: "start with something easy, then add
  all and search in parallel, pull results.")
- **Extraction = Browserbase Fetch API** (`@browserbasehq/sdk`, `bb.fetchAPI.create({ url })`) — per the
  official Browserbase skill. Managed fetch through verified-browser + proxies + CAPTCHA solving. **No
  Playwright, no Stagehand, no second LLM key.** One new server-only dep: `@browserbasehq/sdk`.
- **Imported model is terminal for editing** (YAGNI): it has no editable recipe, so submitting a prompt
  while viewing an imported version starts a FRESH generation (with a subtle note). Print Brain still
  fully applies. No mesh-scaling edits in v1.

## Architecture

Reuse the entire existing pipeline; add only a **search front-door** and an **import door**. A found
model is just an STL — once fetched it flows through the SAME `estimateFromStl` + `buildPrintPlan` +
`uploadFinalStl` path a generated model uses, so it lands in the viewport + Print Plan panel + saved
projects with no new viewport/persistence code.

### 1. Provider seam — `src/server/modelSearch/`
- `types.ts`
  - `ModelResult { id; title; author; license; sourceSite; sourceUrl; thumbUrl; stlUrl?; downloadPage }`
  - `ModelSearchProvider { search(query: string, opts?): Promise<ModelResult[]> }`
- `index.ts` — `pickModelSearch()` → Browserbase provider when `BROWSERBASE_API_KEY` is set, else
  `fallbackSearch` (curated). Same shape both ways.
- `browserbase.ts` — the real provider. Fans out across source adapters **in parallel**
  (`Promise.allSettled`), merges + ranks + dedupes, returns top N.
- `sources/printables.ts` (built first) + scaffolds `thangs.ts` / `thingiverse.ts` / `makerworld.ts`.
  Each adapter: build the site's search URL (prefer its JSON/GraphQL endpoint) → `bb.fetchAPI.create({
  url })` → parse `response.content` into `ModelResult[]`.
- `fallback.ts` — a small curated catalog of real, CC-licensed models (thumb + STL URL), keyword-
  filtered. Zero-key path so the app always boots/demos.

### 2. Smart-hint classifier
A cheap `claude -p` yes/no ("is '<prompt>' a common existing object likely found on 3D model repos?
answer yes/no") on submit. If yes → show the non-blocking nudge while generation proceeds. Heuristic
fallback (keyword list) when the CLI is unavailable. Never blocks the build.

### 3. Transport — SSE, on the AgentEvent seam (rule 4)
- `POST /api/search` (Node runtime, SSE). Streams each result as its source resolves, then done.
- Add **additive** `AgentEvent` kinds (back-compatible):
  - `{ kind: "result"; model: ModelResult }`
  - `{ kind: "searchdone"; count: number }`
- Consumed via the same stream reader as `playAgentStream` (a sibling `playSearchStream`).

### 4. Import door — `POST /api/import` (Node, SSE)
- Body `{ result: ModelResult }`. Fetches the STL (via Browserbase if bot-walled, else direct) →
  `public/generated/<job>/model.stl` → **reuses** `estimateFromStl` + `buildPrintPlan` +
  `uploadFinalStl` → streams the normal `mesh` / `estimate` / `printplan` / `summary` events.
- `summary` carries `engine: "imported"` + attribution so Studio saves it as a version.

### 5. Project / version marker + attribution
- `ProjectVersion.engine` gains `"imported"`; add optional attribution:
  `attribution?: { author; license; sourceUrl; sourceSite }`.
- Refine-in-place: when the open version is `imported` (no `source` recipe), a new prompt regenerates
  fresh (existing `isEdit` logic already keys off `base = source`, so this falls out naturally) — add a
  one-line note in the conversation.

### 6. UI (new; hand to Vraj to test)
- Empty state: **`✨ Design it`** (default) + **`🔍 Find existing`**.
- Results panel/overlay: cards (thumb, title, author, **license badge**, source link) + **`Use this`**
  and a **`Design my own instead`** escape. Built in the app's design language.
- Smart hint: a subtle inline nudge that opens the results panel.

### 7. Legal / attribution
Always show author + license + "from <site>" link on cards AND on the imported version. We proxy the
user's own download; no redistribution by us.

## Error handling
- Browserbase/source failure → `Promise.allSettled` drops that source; other sources still return.
- Zero results → empty state in the panel with "design it instead →".
- No key → fallback provider (curated), app unaffected.
- Import fetch failure / non-mesh / empty STL → reuse the route's existing "verify STL non-empty before
  emitting mesh" guard; show a friendly error, offer to design instead.
- Every external call in a subprocess/fetch **with a timeout** (constitution rule 5).

## Testing
- Pure units (vitest, zero-key): result **merge / rank / dedupe**; fallback keyword filter; each source
  adapter's **parser** against a captured sample payload (no network).
- Browserbase adapter behind the key gate: manual integration test with the real key.
- Import path: curl `/api/import` with a known STL URL → mesh + estimate + printplan + summary.
- `tsc` + existing suite stay green.

## Out of scope (v1.1+)
- Mesh-level edits on imported models (scale/repair). 3D-similarity ("find something like this image").
- Caching/rate-limit handling beyond timeouts. Auth'd/login-walled repo flows (MakerWorld deep links).
