# PROGRESS — (working: `/`=landing → /app Google-gated studio (Blender DEFAULT); InsForge DB persistence; UI recolored green→terracotta; PRINT BRAIN v1 BUILT (measure W×D×H · one-piece-vs-split · supports · Download STL + landing Print Plan panel + Blender roof fix); ACCOUNT: TopBar account pill + /profile page + Sign out; MODEL SEARCH (Browserbase sponsor #6) BUILT + LIVE-VERIFIED (search Printables → import STL → Print Brain → saved); REAL MESHGEN BUILT (NVIDIA NIM TRELLIS text/image→3D, textured GLB preview in viewport + Rodin-live wired/credit-blocked) + CLARIFY-FIRST (now PROMPT-SPECIFIC via Claude: Kratos→weapon/era, not dragon) + DETAILED ENRICHMENT (Claude writes a dense structured descriptor) + REFERENCE-IMAGE UPLOAD (📎 → Claude VISION describes it → text→3D) + BLENDER AUTO-CLEANUP + NIM-mesh-imported-into-LIVE-Blender + GLB dark-render fixed + Rodin gated OFF (ENABLE_RODIN); MULTI-ENGINE: 4 SEPARATE engines + Auto routing — [Auto · OpenSCAD · Blender · Fusion · NVIDIA] picker + "Clean in Blender" combo (AgentFeed); NVIDIA disentangled from Blender (its own engine); FUSION engine LIVE via HTTP-MCP (127.0.0.1:27182, Claude→adsk→STL); TRANSPARENT failure chips (NVIDIA-broke/Blender-not-connected/Fusion-not-running shown, no silent fallback); SELF-INSPECT→retry on NVIDIA (Claude vision likeness score, bounded); skills-primers injected per engine; VISUAL-TEST RND2: OpenSCAD ✓, Fusion/Blender/Auto-OpenSCAD/NVIDIA-mascot all FAILED — symptoms point to a Claude `claude -p` USAGE-LIMIT mid-session (Blender gave identical snowman/fox = shared hardcoded fallback; OpenSCAD worked early #8 then failed late #15); RETEST RND3: claude -p healthy again (snowman ✓ distinct); FUSION "Command failed" ROOT-CAUSED+FIXED (complex adsk reasons past 200s → pinned writer to `claude --model sonnet` + honest timeout chip; bracket now writes in 136s, reaches Fusion, fails honestly at ExtrudeFeatures.add = adsk-correctness ceiling); ★NEXT-SESSION FOCUS = working/expected output: (1) NVIDIA ref-image likeness — Vraj feels "NVIDIA can't access the image" (TRUE BY DESIGN: we send Claude's TEXT desc, not pixels → real fix = image→3D); (2) Clean-in-Blender downgrade (colorless+blobby+rescaled); (3) Fusion adsk traceback-retry)

## OPS —
- Pushed to GitHub `git@github.com:vraj00222/Claudware.git` (branch `main`, PUBLIC). `*.md` context docs + source
  + `.claude/settings.json` ARE pushed (no dates in doc bodies). KEPT OUT: `.env*`/`*.local` and `.insforge/`
  (holds a real InsForge API key). `.env.example` IS committed/public → keep it placeholder-only, NEVER paste
  real keys there (caught + reverted a real-key paste once). Security-audited: no secrets in any tracked file.
- ANTHROPIC_API_KEY set in `.env.local` (user has API credits) → REAL generation live.
- ★ ALL `claude -p` (agent CLI) calls REPLACED by the Anthropic Messages API (raw `fetch`, NO new dep) via a
  shared `src/server/claude.ts` → `claudeText()` (text) + `claudeVision()` (base64 image blocks; the CLI's
  Read tool could open a file path, the API can't). The CLI loaded MCP servers + reasoned agentically for
  MINUTES → blew past timeouts → generic fallbacks. Migrated: generate(OpenSCAD), blender(bpy), fusion(adsk ×4),
  classify(→haiku), clarify, promptEnrich(enrich + describe-image vision), inspect(likeness vision). Model
  aliases resolve sonnet→claude-sonnet-4-6 / opus→claude-opus-4-8 / haiku→claude-haiku-4-5 (env-overridable).
- OpenSCAD FIXED + verified live: also fixed a scad-header parse error (only the FIRST prompt line was
  commented, so a multi-line size pref `Preferences: size≈medium` landed as raw OpenSCAD → every stage "Command
  failed"). Real 6-step phone stand / 5-step soap dish render in ~30s (`N stages · claude`, watertight).
- BROWSERBASE_API_KEY in `.env.local` now has DEV-PLAN credits → model search (reuse-before-regenerate, sponsor
  #6) runs against the real Browserbase API, not just the built-in fallback library.
- DEEPGRAM_API_KEY in `.env.local` updated, ~$200 credit → voice (Deepgram sponsor) runs against the real STT
  API, not the Web Speech fallback. RESTART `npm run dev` after the env edit so the key loads.
- Verified: 115/115 tests green · `npm run build` clean (13 routes) · OpenSCAD + classify smoke-tested live.
  NEXT: Vraj visually tests Blender / Fusion / NVIDIA (now on the Messages API) + the voice loop.

## DEMO BACKLOG — from Vraj test feedback (10h to demo; priority order)
P1. NVIDIA NIM "fetch failed" — ROOT CAUSE: hosted TRELLIS function 500s (`nvcf-status: errored`) after ~91s,
    triggered by the heavy `ss_sampling_steps:50 / slat_sampling_steps:50` knob (server-side timeout). Also
    `requestGlb` doesn't catch network errors → a single blip throws "fetch failed" instead of retrying. FIX:
    lighter default sampling (test 20/20 or default), try/catch around each fetch (transient → retry), and on
    total NVIDIA failure surface a clear chip + offer Blender fallback so the demo never dead-ends.
P1. Printable pipeline — must be FASTER and produce ACTUALLY printable output. Blender "snail" = a blobby
    shell floating above a separate base (not a watertight printable solid) — can't demo printing that.
P2. Blender output quality — bpy prompt should make GROUNDED, watertight, single-solid, recognizable models
    (snail came out blobby + floating). A Blender EDIT iteration ("snail WITH shell") returned a broken/empty
    mesh (UI showed a PNG-placeholder = mesh failed to load). Harden the edit path.
P2. Clarify questions must be CONTEXT-AWARE — don't ask Palm/Hand/Display size for a mechanical/Fusion part
    (e.g. "wall mount"); ask actual mm dimensions (W×D×H or a key dimension) instead. Figures keep size buckets.
P3. NVIDIA + Browserbase reference-context — when the user NAMES a real/branded thing (e.g. "Tesla/Optimus
    robot"), use Browserbase to find a reference IMAGE online → Claude vision describes it → pass that image +
    description into TRELLIS so the output actually resembles it (today we only send a text guess).
P3. Prompt UX — show example-prompt SUGGESTIONS; let the user TAB to accept/navigate + submit via keyboard
    (not just click). (Touches src/components — needs the "change the design" allowance.)
P3. Prompt refinement — add the useful context / strip noise per engine. (Open Q from Vraj: "use token company"
    — meaning unclear; possibly token-counting to trim long prompts. Confirm intent before building.)

## HOW TO CHECK THE SITE (dev)
- Start (if not running): `npm run dev` → http://localhost:3000  (next.config rewrite needs a restart to load)
- `/`        = the animated LANDING page (rewrite → /landing.html). CTAs → /app.
- `/app`     = STUDIO behind the Google login gate ("Continue with Google", or "continue without signing
               in →" dev-skip). Blender is the DEFAULT engine. Signed-in users' projects save to InsForge DB.
- `/projects`= gallery of YOUR saved projects (from the DB when signed in); click a card to reopen (/app?project=).
- `/profile` = account (avatar/name/email) + Sign out (→ `/`) + their projects. Reached via the TopBar account pill.
- MODEL SEARCH (reuse-before-regenerate, Browserbase): in the studio empty state click "🔍 Find an existing model"
  (or the "find existing" link under the input) → results overlay. Live Printables results (via Browserbase) +
  a built-in LIBRARY of importable models merged in FIRST. Cards: importable → "Use this" (imports the STL →
  viewport + Print Brain + Download + saved as an `imported` version); login-walled live results → "View on {site} ↗".
  Smart-hint nudge appears for common objects. NEEDS `BROWSERBASE_API_KEY` (+ `BROWSERBASE_PROJECT_ID`) in `.env.local`
  — RESTART `npm run dev` after adding env. Zero-key fallback = the same built-in library (5 verified models import
  for real: Benchy + Prusa parts). Try search "bracket"/"benchy"/"gear" → an importable model appears to "Use this".
- Blender LIVE build: open Blender → N-panel → BlenderMCP → Connect (socket 9876) before prompting; else
  headless fallback (still builds in the web viewport).
- FULL DEMO FLOW: open `/` → "Start designing" → sign in with Google → type a prompt → watch it build →
  "make it taller" → edits into v2 (v1/v2 clickable). Then open `/projects` → your model is saved to your account.

## DONE
- [x] Deps installed + verified — docs/SETUP.md
- [x] Brainstorm + design spec approved — docs/superpowers/specs/2026-06-13-claude-hardware-design.md
- [x] OSS toolbox catalogued — docs/oss-toolbox.md
- [x] Plan 01 written — docs/superpowers/plans/2026-06-13-frontend-shell-mockstream.md
- [x] git repo init + feature branch `feat/frontend-shell`
- [x] Next.js scaffold (TS, Tailwind v4, app router, src) + self-hosted fonts + Hardware Paper globals
- [x] tokens.ts (palette source of truth) + vitest harness
- [x] CORE (TDD, reviewed): AgentEvent contract · mockStream (scripts+player) · viewModel reducer — 17 tests green
- [x] UI ported 1:1: Scaler · TopBar/StageTracker · ConversationPanel · AgentFeed/DesignNotes/PrintCenter · VersionRail/DemoHarness
- [x] r3f Viewport: STL mesh + orbit + move gizmo + forming reveal (clip-plane+scanline) + amber inspect marker
      (forming-clip math fixed: geom centered, clip lerps over true vertical bounds, grid at base)
- [x] phone_stand fixture in public/ + r3f deps; next-env.d.ts untracked
- [x] Task 16: Studio wired into page.tsx (<Scaler><Studio/></Scaler>); build clean, 17 tests green
- [x] Task 17: hero states verified in-browser (Playwright MCP) — boot→forming→inspect→complete→print
      + figure/hybrid. Inspect amber marker confirmed via DOM poll (label live 1385–2513ms). No auto-print
      at rest. Console clean (only THREE.Clock deprecation warning). → PLAN 01 DEMOABLE on mockStream.

- [x] Loaders (per Vraj): ASCII PrinterLoader (DESIGN.md §PrinterLoader, in-viewport corner) +
      RenderLoader (PNG mascot printer-loader.png, bob + green layer-line scan) for boot/long renders.
- [x] PLAN 02 SLICE — REAL generation, TESTABLE: prompt → /api/generate (Node SSE) → staged OpenSCAD
      → STL per stage streamed as AgentEvent `mesh` → viewport builds STEP-BY-STEP. Deterministic
      generator (house/box/cylinder, verified renders) + `claude -p` CLI for arbitrary prompts (no key).
      Same build written to tools/_watch/model.scad → watch live in the native OpenSCAD app.
      Verified via curl: "block house w/ 2 windows + a door" → 5 stages stream + render in ~3s.
- [x] De-noise (per Vraj): removed auto phone-stand demo + demo-harness footer; boot → empty
      "describe anything" state (hint + example chips); empty viewport = bare print bed (no fixture);
      versioning made subtle, "+" removed.
- [x] BROWSER-VERIFIED real flow: click "block house" → builds step-by-step → house in viewport
      (gable roof, door, 2 windows, gizmo). DOM-confirmed: dynamic print stat "43g PLA · 3h 40m ·
      315 layers", no Design Notes, no PRINT CENTER tag, sans = Bricolage Grotesque.
- [x] DESIGN CHANGE (per Vraj): font → Bricolage Grotesque (bolder); removed Design Notes panel +
      Print Center tagline; print stats DYNAMIC (estimateFromStl); flicker fixed (top-view scanline
      z-fight hidden + imperative STL load). New AgentEvents: `mesh`, `estimate`. DESIGN.md updated.
- [x] FULL-PAGE layout (Vraj "whole page not just in middle"): Scaler fills the viewport; html/body
      viewport-locked; verified NO overflow at 1366×768 and 1920×1080 (Playwright). "+ New" chat button
      (TopBar) resets to empty. Empty viewport shows a "Your workspace" hint (not a barren grid).
- [x] ARBITRARY-PROMPT generation FIXED: the Claude CLI now returns staged OpenSCAD via a `@@@STAGE`
      delimiter format (OpenSCAD's [] + newlines were breaking the old JSON parse → "lego tree" fell
      back to a block). Verified: "a simple tree" → 5 real stages. Generic fallback is now multi-stage.
- [x] WINDOW FIT: scale-to-fit stage (logical 1536×864 scaled to fit, centered, 1% margin) — never
      overflows / never big-gaps on any window. Verified fitsInside at 1512×820.
- [x] PERSISTENCE MVP (localStorage adapter, InsForge-ready interface): every generation auto-saves
      as a Project (prompt + latest mesh + estimate + steps). "Projects" gallery page (/projects) with
      cards (layer-line thumb, title, date, stats, delete). Reopen via /?project=<id> → loadProject
      shows the saved mesh. "+ New" + Projects buttons in the TopBar. Save+gallery verified; reopen
      is for Vraj to test (per new rule).
- [x] VOICE (Deepgram track, sponsor #2): src/lib/useSpeechToText.ts — browser Web Speech engine
      behind a hook seam (Deepgram streaming drops in later, same shape). Tap the mic → live transcript
      in the input → final transcript auto-submits as a prompt. Wired in Studio + ConversationPanel.
      tsc + tests green; FOR VRAJ TO TEST in-app (Chrome; needs mic permission).
- [x] BLENDER ENGINE (Phase B brought forward, per Vraj). src/server/blender.ts: Claude CLI writes a
      staged `bpy` script (@@@STAGE format, same as OpenSCAD); each stage clears→builds→exports ASCII STL.
      TWO render paths, runtime-picked: (1) LIVE — direct TCP socket to the running Blender (BlenderMCP
      addon on 127.0.0.1:9876) via execute_code → user WATCHES it build in the GUI window + STL exported
      from that same Blender; (2) HEADLESS — `blender --background --factory-startup --python` fallback
      when the socket's down. Both stream `mesh` AgentEvents → web viewport builds step-by-step too.
      KEY FINDING: blender-mcp is a Claude *Desktop* extension, NOT a Claude *Code* MCP server — so we
      drive the addon's localhost socket DIRECTLY (no Claude Code restart, no MCP tools needed).
      Verified via curl: "a tiny rocket" → 5 live stages (body→nose→fins→porthole→band), STL+estimate OK.
- [x] CHOOSE BLENDER (per Vraj): wired engine to the mode (Parametric→OpenSCAD, Figure/Hybrid→Blender,
      Studio.engineFor). `engine` already flowed prompt→stream→route; now acted on.
- [x] EXPLICIT ENGINE TOGGLE (per Vraj, "change the design"): AgentFeed header now has an always-visible
      **[ OpenSCAD | Blender ]** toggle (was a hidden mode chip only shown after submitting → Vraj
      couldn't find it). Drives the same `mode`; in-convo "RE-ROUTE ENGINE" chip stays in sync. Hid the
      fake `ref_pose.png` chip (photo upload not built → future Novita). DESIGN.md updated.
- [x] FIX: React hydration mismatch on the mic button (useSpeechToText `supported` was computed from
      `window` during render → server=false/client=true). Now starts false, set after mount. tooltip-only,
      no visual change. (src/lib/useSpeechToText.ts)
- [x] FIX BUNDLE (Blender empty-viewport + slow): root causes were (1) the metaball blob fallback
      exported an EMPTY STL (STL export only sees MESH; metaballs are type META) → viewport blank;
      (2) Claude bpy timed out at 180s on "owl" → fell to that broken blob. Fixes: wrapStage now
      CONVERTS meta/curve/text→mesh before export (verified: metaball → 26.7k facets, was 0); route
      verifies the STL exists & is non-empty before sending a `mesh` event (no more pointing at missing
      files); fallbackBpyPlan rebuilt from real uv_sphere MESH (always renders); claudeBpyPlan → 3–4
      stages + 240s timeout + "prefer primitives"; route streams a "Designing…" step IMMEDIATELY (no
      dead air) by moving plan-gen inside the stream; loader also clears on `summary`. Engine choice
      now PERSISTS across refresh (localStorage, hydration-safe). tsc + 17 tests + curl all green.
- [x] REFINE-IN-PLACE (was NEXT #1). Submitting a prompt while a project is open EDITS the current
      version's recipe into a NEW version on the SAME project (keeps its engine). route.ts: `base` in
      the body → Claude MODIFIES it (both engines), final recipe returned in the `summary` event
      (source+engine). Studio appends a ProjectVersion; VersionRail shows v1,v2,… and clicking a version
      loads that mesh + sets it as the refine base. Verified via curl: box → "twice as tall" →
      claude-edit, 4 stages, source changed. tsc + 17 tests green. FOR VRAJ TO TEST in-app.
- [x] LOGO SWAP (Vraj's asset, public/logo.png): replaced the text wordmark with the logo image in the
      TopBar (44px) + the /projects gallery header (58px), linking home. tsc + 17 tests green.
 UPDATED: public/logo.png is now Vraj's chosen clean lockup (also used by AuthGate + landing).
- [x] INSFORGE BACKEND PROVISIONED (per Vraj: "auth + database + storage for a smooth demo"). Project
      `claude-hardware` in the **Pro org** (credit-backed; first create accidentally hit the Free Personal
      org → recreated in Pro — delete the free one from the dashboard). Host f7c2td39.us-west.insforge.app.
      • DB: `projects` table (migrations/20260615020915_create-projects.sql) — id/user_id(DEFAULT auth.uid())
        /title/`data` JSONB/timestamps, RLS owner-only, index, updated_at trigger. Applied + verified.
      • Storage: public `models` bucket. Admin upload → public URL fetches 200 (self-test verified).
      • Auth: Google OAuth (oAuthProviders already had google+github); allowed_redirect_urls set.
      • Env: .env.local repointed to the Pro project (was the free q6s75zsv); INSFORGE_URL/API_KEY server-only.
- [x] INSFORGE LIBS WIRED (backend only — current app untouched, still works). src/lib/insforge.ts (browser
      client + getCurrentUser/signInWithGoogle/signOut, key-gated null when no env). src/lib/projects.ts:
      `AsyncProjectStore` + `insforgeProjects` (DB, per-user RLS, whole Project in `data` JSONB) +
      `localProjectsAsync` + `pickStore(signedIn)`. route.ts: finished STL → `uploadFinalStl` → `models`
      bucket → durable URL on the `summary` event (`meshUrl`); per-stage build STLs stay local for speed.
      tsc clean · 17 tests green · storage upload self-test green.
- [x] BLENDER = DEFAULT + ORCHESTRATION FIX (per Vraj "fix blender, make it default, fix all around it").
      ROOT-CAUSE (systematic-debugging, with curl evidence): the Blender refine BACKEND is correct — measured
      a real refine "twice as tall" go 63.10mm→124.60mm, 3 meshes streamed, claude-edit, live window, +storage
      upload fired. The reducer (mesh→meshUrl) + Viewport (reloads on url) are also clean. So the user-visible
      bugs ("taller not in app", v1/v2 loss, "new chat") were in Studio.tsx's persistence: the re-read-merge
      effect raced and could write sparse/[]-holed version arrays. FIX: Studio mode default = figure (Blender);
      persistence rebuilt on an authoritative `projectRef` (explicit contiguous append, no re-read race) +
      single persist() → versions can't be lost, chat stays continuous, refined mesh sticks. Durable storageUrl
      captured per version (ProjectVersion.storageUrl) for reopen later. tsc + 17 tests green.
- [x] HOMEPAGE WIRED (additive, nothing broke — per Vraj "add homepage.html, lets demo"). frontend/homepage.html
      (Claude Design .dc.html: Newsreader/Inter + terracotta #cc785c, GSAP) → served at /landing.html
      (+ public/support.js + public/assets/). Studio still at `/` (untouched, safe for the demo); NEW `/app`
      route = Studio behind `AuthGate` (Google sign-in; key-gated + a dev-skip so misconfigured OAuth can't
      BLOCK the demo). Landing CTAs (goLogin/doGoogle) → /app. Routes verified 200: / · /app · /landing.html ·
      /assets/*. ASSETS COMPLETE (Vraj dropped them): public/assets/{logo,mark,printer,conveyor,drone}.png all
      serve 200. Also swapped public/logo.png → the chosen clean lockup (app TopBar + /projects + AuthGate).
      Google sign-in CONFIRMED working by Vraj.
- [x] ASSETS COMPLETE: Vraj dropped public/assets/{printer,drone,conveyor,logo}.png (+ mark=logo); all serve 200.
- [x] DB PERSISTENCE WIRED (Vraj signed in with Google ✓). Studio + /projects now use `getActiveStore()` →
      signed-in InsForge user = cloud DB (per-user RLS), else localStorage. Studio persistence is async +
      SERIALIZED (saveChain + JSON snapshot) so rapid per-stage upserts can't double-insert; boot effect async
      (resolve store → reopen ?project from DB). /projects lists+deletes via the store; cards → /app?project=id.
      → a Google user's mushrooms/rockets save to their account + reappear in /projects. tsc + 17 tests green.
      (DB round-trip = Vraj to confirm in-app — needs his live session.)
- [x] `/` = LANDING (per Vraj "landing as default /"). next.config rewrite (beforeFiles) / → /landing.html
      (clean URL); src/app/page.tsx redirect fallback; studio fully at /app; Studio newChat → /app. Verified:
      GET / returns the landing (<x-dc> + hero); /app + /projects + /assets 200. Dev server restarted to load it.
- [x] RECOLOR green → landing terracotta (per Vraj "change all green with the landing Start-designing button
      color"). C.accent #00A44A→#cc785c, accentWeak #1F8F50→#a9583e, chip greens→terracotta tints, button ink
      →white; forming/loader scanlines recolor via the token. tokens.ts + globals.css + StageTracker/TopBar/
      PrintCenter/AgentFeed/ConversationPanel/RenderLoader/Viewport. DESIGN.md + DECISIONS.md updated. tsc + 17
      tests green. FOR VRAJ TO EYEBALL in-app.
- [x] PRINT BRAIN v1 BUILT (spec: docs/superpowers/specs/2026-06-15-print-brain-v1-design.md · plan:
      docs/superpowers/plans/2026-06-15-print-brain-v1.md). src/server/printPlan.ts (PURE: parseStlTriangles,
      boundingBox, analyzeOverhangs, planSplit/DEFAULT_BED 220×220×250, buildPrintPlan); estimateFromStl
      refactored to reuse the parser. New `printplan` AgentEvent → reducer vm.printPlan → route emits it after
      the final mesh (both engines) → persisted on ProjectVersion (restored on reopen/version-switch). NEW
      landing-styled <PrintPlan> panel (LAND/LAND_FONT tokens, Newsreader+Inter) in the right rail: dimensions
      mm · one-piece-vs-split + reason · parts list · supports flag · Download STL. Step 0: Blender roof fix
      (recalc OUTWARD normals in wrapStage → roof was invisible under r3f's single-sided material). tsc + 28
      tests green; curl-verified (60mm box→one_piece+support-free, 300mm box→split 2 parts @x146). FOR VRAJ:
      visual-test the panel in /app + confirm the Blender roof now renders. Seam-plane preview (optional) deferred.

- [x] VRAJ CONFIRMED in-app: Download STL works · dimensions ACCURATE (verified externally by
      uploading the STL to an online measure tool) · 3D view works · iteration/refine works well. Print Brain v1
      = good. Captured for later: full character/customization pipeline + sponsors (past/now/next) in ROADMAP;
      Hunyuan3D eval + Claude-SDK (CLI vs Anthropic/Agent SDK) assessment in DECISIONS. Work committed.
- [x] ACCOUNT: SIGN-OUT + /profile (was NEXT #2). Studio resolves getCurrentUser once → passes `user` to a now-
      slightly-extended TopBar (stays a PURE props-in component) which shows an ACCOUNT PILL (avatar/initial +
      first name → /profile) ONLY when signed in (hidden on the zero-key/dev-skip path, keeps that demo clean).
      NEW /profile route: account card (avatar · name · email) + **Sign out** (signOut() → `/` landing) + their
      projects grid (reopen → /app?project=) + "view all" → /projects. Mirrors the /projects styling (C/FONT
      tokens); guest/local case shows "local workspace" + a Sign-in CTA. insforge.ts already had signOut/
      getCurrentUser. tsc + 28 tests green. FOR VRAJ: eyeball the pill + /profile, confirm Sign out → landing.
- [x] FIX build error blocking /app + /profile (Vraj hit it on login): globals.css had the remote Google-Fonts
      `@import url(Newsreader/Inter)` on line 3, AFTER `@import "tailwindcss"` — the bundler inlines tailwind into
      real rules, pushing the url-import past them → "@import must precede all rules" (500 on every studio route;
      `/` was fine as it's the static landing). FIX = moved the remote @import to the FIRST line. All routes 200.
- [x] MODEL SEARCH = "reuse before regenerate" (Browserbase sponsor #6) — BUILT + LIVE-VERIFIED. Spec:
      docs/superpowers/specs/2026-06-15-model-search-design.md · plan: docs/superpowers/plans/2026-06-15-model-search.md.
      • `src/server/modelSearch/`: provider seam (types/merge-dedupe/index) · zero-key curated `fallback` ·
        `bb.ts` (Browserbase SDK v2.14 `fetchAPI.create` — verified browser+proxies, server-only, key-gated) ·
        `sources/printables.ts` (+ thangs/thingiverse/makerworld scaffolds) · `browserbase.ts` parallel fan-out
        (Promise.allSettled, merged). Printables results live in the page's escaped flight JSON → unescape + regex
        the contiguous id/name/slug (LIVE-VERIFIED: 33 real "hex bolt" results w/ authors+thumbs).
      • BINARY-STL support added to Print Brain (parseStlBinary/parseStlAuto + estimateFromTris/buildPrintPlanFromTris)
        — downloaded repo models are binary; the old parser was ASCII-only. (3 new tests.)
      • `/api/search` (SSE, own SearchEvent channel) + `src/lib/searchStream.ts`. `/api/import` (SSE) downloads the STL
        → REUSES estimate/print-plan/storage → streams the normal mesh/estimate/printplan/summary as `engine:"imported"`.
        uploadFinalStl extracted to `src/server/storage.ts` (shared w/ generate). LIVE-VERIFIED: Benchy 11MB binary →
        225k tris → 60×31×48mm Print Brain + estimate + InsForge storage upload.
      • `/api/classify` (claude -p yes/no + keyword heuristic) drives the proactive search nudge.
      • UI (FOR VRAJ to visual-test): ConversationPanel "🔍 Find an existing model" (empty state + under-input link);
        `ModelSearchPanel` overlay (cards: thumb/title/author/license/source · Design instead);
        Studio runSearch/importModel/hint. tsc + 37 tests green.
 • IMPORT-WORKS FIX: free repos gate STL downloads (Printables = auth-walled, Thingiverse =
        Cloudflare-walled — both confirmed via Browserbase probes), so live results can't all import. FIX = (1) a small
        built-in LIBRARY of REAL, publicly-downloadable models (verified direct GitHub STLs: 3DBenchy + 4 Prusa i3 parts)
        in fallback.ts, MERGED FIRST into live search results so "Use this" always has working options; (2) HONEST cards —
        "Use this" only when a direct stlUrl exists, else "View on {site} ↗" (no silently-failing import). LIVE-VERIFIED:
        search "bracket" → curated importable first + live Printables; import Prusa x-carriage (ASCII STL) → 6520 tris →
        52×90×15mm. Both ASCII + binary imports work. Live Printables results remain VIEW-only (download needs login).

- [x] REAL MESHGEN + CLARIFY-FIRST + MAKE-WITH-AI (spec: docs/superpowers/specs/2026-06-15-meshgen-and-clarify-design.md ·
      plan: docs/superpowers/plans/2026-06-15-meshgen-and-clarify.md). ROOT CAUSE of "every figure = same blob":
      claudeBpyPlan threw → hardcoded fallback creature. FIX: new `src/server/meshgen/` provider seam (Rodin→NIM→
      procedural fan-down, key-gated, runProviders DI-tested). • NVIDIA NIM TRELLIS text/image→3D LIVE-VERIFIED
      (ai.api.nvidia.com/v1/genai/microsoft/trellis → base64 GLB; `NVIDIA_NIM` key): dragon = 16.7k-facet TEXTURED
      mesh (was a snowman). GLB→ascii STL via headless Blender (glb.ts). • TEXTURED GLB PREVIEW in the viewport
      (GLTFLoader; `mesh` event +glbUrl/+textured; persisted on ProjectVersion) — STL stays the print artifact.
      • CLARIFY-FIRST: /api/clarify (classifier+heuristic, pure+tested) → ClarifyCard (scales/feathered · pose ·
      size, every prompt gets size); answers fold into the prompt + size drives meshScale.ts → FIXES the 30cm bug
      (verified 'vase'+300 → 225×225×300mm, Print Brain splits 2 parts). • "✨ Make with AI" regenerates a printable
      version from login-walled search results (test-4 fix; image→3D w/ text fallback). • Hyper3D Rodin live provider
      WIRED via the BlenderMCP socket (create→poll→import→export from the live scene) — protocol verified, but the
      free-trial key returns API_INSUFFICIENT_FUNDS → fans to NIM (works once topped up / FAL_AI). tsc + 46 tests green.
      Saved 2 app-made GLBs (public/assets/showcase/{printer,dragon}.glb) for a future landing showcase. FOR VRAJ:
      eyeball the textured dragon/printer + the clarify card; topup Hyper3D if you want the live-in-Blender build.

- [x] MESHGEN QUALITY PASS (Vraj feedback round). (1) DARK GLB FIXED — TRELLIS metallic PBR → matte at load
      + GLB-only fill lights (dragon now shows color). (2) RODIN gated OFF by default (ENABLE_RODIN) — straight
      to NIM (no API_INSUFFICIENT_FUNDS attempt; dragon ~18s). (3) CLARIFY now PROMPT-SPECIFIC via Claude
      (Kratos → look/weapon/pose, not dragon scales; verified) + heuristic fallback. (4) PROMPT ENRICHMENT
      (enrichPrompt, claude -p) expands the prompt for more TRELLIS detail. (5) NVIDIA + BLENDER — the NIM GLB
      is imported into the user's LIVE Blender (importGlbToLive) so they see/refine it there. tsc + 46 tests green.
      NEXT for detail: Browserbase reference IMAGES → NIM image→3D (needs NVCF upload); Blender auto-cleanup.

- [x] MESHGEN QUALITY + REFERENCE IMAGES (Vraj feedback rounds,). (1) GLB dark-render FIXED (matte
      materials + GLB-only fill lights — dragon shows color). (2) Rodin gated OFF (ENABLE_RODIN; free trial
      API_INSUFFICIENT_FUNDS) → straight to NIM (~18s). (3) CLARIFY now PROMPT-SPECIFIC via Claude (Kratos →
      look/weapon/pose, verified; not dragon scales) + heuristic fallback. (4) ENRICHMENT writes a dense 60–100w
      STRUCTURED descriptor (Claude knows canonical looks — "claude mascot"→chibi Clawd; TRELLIS takes ~90w→200).
      (5) NVIDIA + BLENDER: NIM GLB imported into the user's LIVE Blender (importGlbToLive). (6) BLENDER AUTO-CLEANUP
      in glbToStl (join/weld/normals/decimate>200k). (7) REFERENCE IMAGE UPLOAD: 📎 → /api/upload → Claude VISION
      (describeImage, claude -p reads the local image — verified drone.png → "quadcopter X-frame figurine") → folded
      into the prompt → text→3D; also upgrades make-with-AI. FINDING: NVIDIA HOSTED image→3D 500s (cracked the
      NVCF asset+example_id format, but the endpoint server-errors) → vision+text is the route. (8) Removed Hunyuan
      bloat from docs + nim's dead image-mode. tsc + 46 tests green. ALL COMMITTED to main (feat synced).
      FOR VRAJ: visual-test dragon color, Kratos questions, 📎 upload a reference, model-in-Blender.

- [x] FIX "nothing came on submit" (Vraj): prompt-specific clarify uses claude -p (~16s) and submit showed
      NO feedback. FIX = chat-side **ThinkingRow** loader (Claude-Code style, 24 cycling words + pulse dot) shows
      instantly on submit (+ prompt bubble); clarify only calls Claude for figures/characters (vase/bracket =
      instant heuristic, verified 0.01s vs dragon 16s); guard token drops superseded fetches. NOT a center loader.

- [x] FULL-STATE TEST PASS ("test everything that should work"). Non-visual correctness verified via
      tests/tsc/curl per the workflow rule. GREEN: 47 tests + tsc · all routes 200 (/ landing · /app · /projects ·
      /profile · /landing.html · /assets/*) · parametric loop (OpenSCAD: plan→5 mesh stages→estimate→printplan→summary,
      real 1062-facet STL) · Print Brain output complete · InsForge Storage upload LIVE (durable URL fetches 200, exact
      bytes — cross-device works) · clarify (fast heuristic 0.04s + size q) · classify nudge · MODEL SEARCH (Browserbase
      live Printables + curated library merged) · import (download→Print Brain→storage) · upload (saves ref image) ·
      MESHGEN (NVIDIA NIM TRELLIS, ~39s: textured GLB + STL + estimate + printplan). Tooling all present (openscad/blender/
      claude CLI; NIM+Browserbase+InsForge keys). Blender socket CLOSED → headless path (live GUI build = Vraj-side, start
      addon on 9876). FOUND + FIXED 2 real bugs (below). FOR VRAJ: the visual eyeball items in NEXT #1 still stand.
- [x] FIX #1 — IMPORT/ESTIMATE NaN: ASCII-STL vertex regex `[\d.eE+]` was missing `-`, so a sci-notation coord like
      `-5.05151e-015` (common from CAD exporters incl. Prusa's own parts) captured only `-5.05151e` → `+"…e"`=NaN →
      poisoned volume → grams/minutes serialized as `null` on imports + any such generated STL. FIX = add `-` to the
      class (src/server/printPlan.ts parseStlTriangles) + regression test. Verified: idler import 16g→now grams:4/min:22.
- [x] FIX #2 — UNPRINTABLE 1mm FIGURES on clarify-SKIP: TRELLIS normalises every mesh to ~1 unit; the route only scaled
      `if (sizeMm>0)`, but Studio's clarify **skip** (and an un-picked size) pass no sizeMm → a beginner got a 1mm dragon.
      FIX = meshgen output is now ALWAYS scaled, defaulting to 120mm (clarify "medium/hand-size") when no size given
      (src/app/api/generate/route.ts). Verified live: "chubby sitting dragon" no-size → was 1×0.7×1mm, now 111.7×119.7×120mm.

- [x] SESSION (pm, Vraj live-testing): five fixes, all verified non-visually.
      1. CLARIFY no longer asks redundant Qs (Vraj: "I already said the pose"). claudeQuestions now returns
         NONE for known/specific subjects + never re-asks what's stated; heuristic fallback = SIZE ONLY (dropped
         the blind Scales/Furry/Pose guess). LIVE-VERIFIED: "luffy gear 2 lego figure" → only the size question.
      2. VIEWPORT ZOOM-OUT (Vraj: big mug couldn't be framed). STL path now normalizes on-screen size to ~70u
         like the GLB path (a 254mm mug rendered at 254u, past the camera). OrbitControls min 40→8 / max 400→600
         (zoom IN to inspect detail, OUT to frame big models). Real mm still shown in Print Plan. src/viewport/Viewport.tsx.
      3. OPENSCAD = REAL MECHANICAL via BOSL2 (Vraj: "ambitious OpenSCAD that works" + "skills for openscad").
         Cloned BOSL2 → tools/openscad-libs (gitignored); renderStage sets OPENSCADPATH + 20s→60s; claudePlan told
         to `include <BOSL2/std.scad>` and use spur_gear/threaded_rod/screw/etc. LIVE-VERIFIED: "24-tooth herringbone
         gear w/ hex bore" → real spur_gear(), 23,448 facets (was a crude cylinder). Ambitious tests that DON'T work
         yet: full assemblies (swiss-watch internals → fell to generic block; V8 → deterministic box). claudePlan
         still unreliable for freeform/assemblies — that's the quality ceiling, BOSL2 fixes the gear/thread/part case.
      4. REFINE-A-MESHGEN-MODEL no longer spawns a "new chat / no v2" (Vraj: "asked to change, made a new thing").
         ROOT CAUSE: meshgen has no recipe → isEdit was false → fresh project + vague regen. FIX: any open version
         refines in place (→ v2, same project); no-recipe refines re-send the ACCUMULATED subject + the change
         ("lego mug" + "smaller, name on handle") so it stays the same object. ProjectVersion.prompt added.
         Studio.tsx runGenerate/submitPrompt. NOTE: TRELLIS still can't truly edit a mesh — regen stays on-subject
         but isn't a precise in-place edit (that needs deterministic transforms / Blender-side ops — see NEXT).
      5. "Command failed: openscad" Vraj hit = TRANSIENT (route.ts hot-reload window); re-running renders fine. Not a bug.
      tsc + 47 tests green. FOR VRAJ to eyeball: zoom on a big model · refine a figure → v2 same chat · a BOSL2 gear.

- [x] SESSION cont. (Vraj prioritized: "do whatever's free/opensource to make these better"). Shipped:
      • LAYOUT FILLS THE WINDOW (Vraj: "fill the empty space"). Scaler dropped the fixed 1536×864 scale-to-fit
        card (which letterboxed on non-16:9) → full-bleed flex column, edge-to-edge. src/design/Scaler.tsx. (/app 200.)
      • DETERMINISTIC SIZE EDITS (free, high-value). "make it smaller/bigger/2x/80mm tall" on a no-recipe model
        now SCALES the existing mesh (instant, faithful) instead of regenerating a different blob. New: sizeEdit.ts
        parser (pure, 5 tests) · /api/transform (SSE: scale→estimate→printplan→storage) · playTransformStream ·
        Studio routes pure-size refines to it (mixed edits like "smaller AND add a hat" still regenerate on-subject).
        LIVE-VERIFIED: 46×46×40 → factor 0.5 → 23×23×20mm. Recipe (OpenSCAD) models still edit their script.
      • TRELLIS DETAIL KNOB: ss/slat sampling 25→50 (more figure detail; ~2× slower, free). nim.ts.
      • OPENSCAD POLISH: planOpenscad now DEFERS mechanical subjects (gear/engine/motor/bearing/thread/…) to
        Claude+BOSL2 instead of the primitive generator — fixes "V8 ENGINE → plain box" (stray word "engine BLOCK"
        matched the box rule). Simple shapes (box/house/cylinder) stay deterministic. Verified via unit check.
      • FIXED the sci-notation regex bug in meshScale too (same [\d.eE+] missing `-` → NaN on scaled sci-notation STLs).
      tsc + 52 tests green. FOR VRAJ: full-bleed layout · "make it smaller" on a figure → faithful v2 · figure detail (slower).
      STILL OPEN (Vraj wants, deferred — latency tradeoff): Browserbase WEB-RESEARCH for OBSCURE named subjects
      (Claude already knows famous ones; fetch a web blurb → enrichment). Ready to wire (bbFetch exists); ~8-12s/figure.

- [x] MULTI-ENGINE + AUTO ROUTING + FUSION + TRANSPARENT FAILURES (Vraj: "test all features
      OpenSCAD/Blender/Fusion/NVIDIA separately + as options/combos; if NVIDIA/Blender break show the user;
      integrate skills under the hood; fix ONE good pipeline for complex wow"). Spec:
      docs/superpowers/specs/2026-06-16-multi-engine-routing-and-fusion-design.md. ALL CURL-VERIFIED LIVE.
      • ENGINE PICKER (AgentFeed, authorized design change): [Auto · OpenSCAD · Blender · Fusion · NVIDIA] +
        a "Clean in Blender" toggle. Engine is now its OWN state (engineSel, default Auto) — decoupled from
        `mode` (the conflation + localStorage persistence was the footgun that silently sent "Kratos" to
        OpenSCAD → a block; that's the inconsistency Vraj saw). NVIDIA is now its OWN engine (was hidden
        inside "Blender"); Blender-primary is the real staged-bpy LIVE build.
      • AUTO ROUTING (src/server/engineRoute.ts, pure+11 tests): classifyEngine — character/organic→NVIDIA
        (even with a mechanical word, e.g. "luffy gear 2 pose"; "mushroom house"→NVIDIA), mechanical/part→
        OpenSCAD, "in blender/watch"→Blender, unknown→NVIDIA. resolveEngine: a manual pick always wins.
      • FUSION engine (src/server/fusion.ts, pure helpers+6 tests): backend drives Fusion's HTTP MCP
        (http://127.0.0.1:27182/mcp, initialize→initialized→tools/call) — Claude writes an adsk run() that
        builds in a NEW Fusion doc (watchable) + exports ASCII STL; units cm=mm/10, exported STL is mm.
        Bugs found+fixed live: adsk.cad import (doesn't exist→adsk.fusion), inner `import` poisoning run()'s
        scope (UnboundLocalError), failure JSON uses `error` key. VERIFIED: 40mm cube w/ 12mm hole → 40³mm STL.
        The adsk script is saved as the version `source` → a refine EDITS it (parametric).
      • TRANSPARENT FAILURES (inline tool chips, no silent fallback): NVIDIA NIM ✓/✗reason→procedural;
        Blender live-window / headless / NOT-CONNECTED; Fusion connected / NOT-RUNNING(→OpenSCAD).
      • SELF-INSPECT→retry (src/server/inspect.ts, pure parser+5 tests): NVIDIA result rendered (OpenSCAD)
        → Claude vision likeness score → ONE bounded retry (new seed + stronger prompt) if <0.45, fails open.
        VERIFIED: dragon scored 0.7, chip noted "pose looks standing not sitting". DISABLE_INSPECT=1 to skip.
      • CLEAN-IN-BLENDER combo (blender.cleanStlInBlender): import→weld/normals/decimate→re-export; the
        nvidia+blender / fusion+blender combo. VERIFIED on an OpenSCAD box (repair_mesh chips + cleaned mesh).
      • SKILLS under the hood (src/server/skills.ts, 4 tests): per-engine primers injected into the gen
        prompts — Fusion←cad-modeling (feature order/fillets/parametric), Blender←manifold/printable, OpenSCAD
        ←BOSL2; NVIDIA←enrichment. tsc + 78 tests green (26 new). LIVE: Auto-box·Fusion·NVIDIA-dragon·Blender-rocket.
      FOR VRAJ: visual-test each engine in /app (see the test checklist) — confirm the chips, the live builds
      in Blender/Fusion, the dragon textured + inspect chip, and that Auto picks correctly.

- [x] VISUAL-TEST FIX ROUND (Vraj tested each engine in /app + sent 6 current-project screenshots).
      Root-caused with systematic-debugging + curl/render evidence; installed the OpenSCAD skill per Vraj.
      • OPENSCAD bolt → generic block / NO threads. ROOT: BOSL2 std.scad does NOT include the part libs
        (threading/screws/gears/bearings are separate files) → threaded_rod()/spur_gear()/screw()/nut()/
        ball_bearing() were UNKNOWN modules, dropped SILENTLY (warning, not error) → bolt = bare 48-facet hex
        head; parse/timeout misses then fell to the block. FIX (route.ts): ensureBosl2Parts() re-prepends the
        FULL BOSL2 part set on any BOSL2 stage; prompt says part libs auto-included + correct signatures;
        accept-gate also accepts pure-BOSL2 modules; claudePlan timeout 120→200s; renderStage surfaces
        "Ignoring unknown module" as a warn chip. VERIFIED via route: M8 bolt+nut → real M8 threads, 10,288
        facets (was 48 / block). Installed mitsuhiko/agent-stuff@openscad (skills.sh, 483 installs).
      • FUSION/flat-top FLICKER ("top flickers as always"): forming clip-plane settled exactly AT the top face
        (halfH) → top-face z-fight shimmer on flat parts. FIX: settle the cut at halfH+2 (just above). Viewport.tsx.
      • VERSION v2 "colorless not saved": a Clean-in-Blender cleaned STL (no GLB) inherited the prior version's
        textured GLB → re-pick showed the old colored model, not the cleaned mesh. FIX: store glbUrl mirroring
        the event; inherit base GLB only for a pure size-edit. Studio.tsx.
      • BLENDER mushroom "couldn't render" = TRANSIENT (re-ran clean: 3 meshes, "model ready"); the live-Blender
        COLLISION Vraj flagged (one window driven by >1 thing). No code change. tsc + 78 tests green.
      VRAJ CONFIRMED in-app: OpenSCAD "M10 bolt + hex nut" → real threaded bolt + internally-threaded nut (Image #7).
- [x] ENGINE-MATRIX TEST ROUND (cont., all engines live: Fusion MCP ✓ Blender socket ✓ NVIDIA key ✓).
      • AUTO routing verified: "a cat"→NVIDIA, hook→OpenSCAD, "in blender"→Blender (resolveEngine).
      • NVIDIA RELIABILITY FIX (this was Vraj's "NVIDIA did nothing"): live repro of Auto "a cat" → "nim returned
        no GLB artifact → procedural" (a blob, not a cat). ROOT: TRELLIS intermittently returns 200-with-empty or
        202/async under load; old code threw → procedural. FIX (nim.ts): poll the NVCF 202 status endpoint +
        retry 3× on transient empty + surface a non-success finishReason honestly; abort 180→220s. tsc green.
      • FUSION TIMEOUT FIX: complex bracket adsk call ETIMEDOUT at 120s → "Command failed" (same bomb as OpenSCAD).
        Raised to 200s (fusion.ts). CEILING FOUND: a VERY complex one-shot part (NEMA17 mount w/ ribs+fillets+
        bolt-pattern) still hit 201s (worse under concurrent claude calls) — single-shot adsk has a complexity
        limit; staging it is a future improvement.
      • OPENSCAD COMPLEX CEILING (found): "planetary gear set (sun+3 planets+ring, meshing)" → FALLBACK BLOCK
        (claudePlan threw — likely >200s timeout under the concurrent claude load, or a meshing ASSEMBLY exceeds
        the one-shot). So: SINGLE complex parts shine (M10 bolt+nut ✓ 10k facets), multi-part meshing assemblies
        are the ceiling. RETEST SOLO next session; for a reliable "really complex" demo prefer ONE intricate part
        (a big herringbone gear w/ hub+spokes, a worm, a knurled threaded knob, a threaded jar+lid).
      FOR VRAJ to eyeball next: flat-top flicker gone (coaster/block) · cleaned v2 stays colorless across version
        switches · re-run Auto "a cat"/a figure → now a TEXTURED model (NIM retry) not a blob · a complex Fusion
        part that fits the one-shot (a bracket with bore + bolt holes + fillets, not a rib-monster) · retest the
        planetary gear SOLO (no other generations running) to see if it's the timeout or the model ceiling.

- [~] VISUAL-TEST ROUND 2 (pm, Vraj tested all 5 engines in /app; screenshots #8–15). RESULTS:
      • ✓ OPENSCAD WORKS (#8/#9) — renders correct early in the session.
      • ✗ FUSION stopped working (#10/#11) — had worked earlier this session (M10 bolt #7), now fails.
      • ~ BLENDER ok-ish (#12) but produced the SAME mesh for "snowman" AND "low-poly fox" → SMOKING GUN:
        both fell to the hardcoded fallbackBpyPlan creature (claudeBpyPlan threw). Not a routing bug — a
        claude-plan failure.
      • ~ NVIDIA (#13/#14): corgi builds but "not cute"; Claude-Code-mascot + cowboy-hat REFERENCE PHOTO →
        output TOTALLY UNRELATED even with a clean ref image (vision describeImage / enrich likely failed →
        raw prompt to TRELLIS + the known named-character ceiling).
      • ✗ AUTO routed "wall-mount headphone hook" → OpenSCAD (CORRECT route) but the BUILD then failed (#15).
      LEADING HYPOTHESIS (Vraj's, and the symptoms support it): the Claude Code auth hit a USAGE/RATE LIMIT
      mid-session, so every `claude -p` subprocess started failing — that one path is shared by OpenSCAD-plan,
      Fusion-adsk, Blender-bpy, and NVIDIA enrich+vision. Evidence: (a) Blender's identical snowman/fox = the
      shared hardcoded fallback both times; (b) OpenSCAD worked early (#8) then failed late (#15) = limit hit
      partway; (c) Fusion was fine earlier same session, then died. The engines that DON'T call claude (raw NIM
      art, deterministic OpenSCAD primitives) degraded more gracefully. NO code change this round (Vraj: "just
      get context and let me try again"). NEXT: Vraj RE-TESTS all engines once Claude usage resets / credits
      restored. If symptoms PERSIST after reset → they're real per-engine bugs, re-investigate then (Fusion MCP
      still running? NVIDIA mascot = quality ceiling not credits?). IMPROVEMENT CANDIDATE (deferred, not done):
      when `claude -p` fails, surface an HONEST "Claude unavailable (usage limit?)" chip instead of silently
      dropping to a fallback that looks like a wrong model — would make this exact situation self-explanatory.

- [x] RETEST + FIXES (pm, Vraj retried after usage reset). claude -p HEALTHY again (PONG, rc=0).
      • ✓ BLENDER snowman CONFIRMED (Vraj screenshot): proper 3-stack + carrot nose + coal buttons + top hat,
        "model ready — 3 build steps", 24×24×53mm one-piece. DISTINCT from a fox now → confirms the earlier
        "identical snowman/fox" WAS the usage-limit `claude -p` failure (shared hardcoded fallbackBpyPlan), now
        resolved. (Two transient red render_preview dots mid-build, then green — the known live-window hiccup.)
      • ✓ FUSION "Command failed / no preview / nothing built" ROOT-CAUSED + FIXED (systematic-debugging,
        end-to-end repro). NOT the engine: Fusion app + MCP proven healthy (27182 LISTEN, initialize→200 <1ms);
        the SIMPLE cube built fully in 56s. The failures were the COMPLEX prompts — Claude on the session-default
        (Opus) reasons PAST the 200s `claude -p` limit writing the adsk → ETIMEDOUT → Node "Command failed" → the
        script never reaches Fusion. FIX (fusion.ts + route): pin the adsk writer to `claude --model sonnet -p`
        (env FUSION_CLAUDE_MODEL, ~2× faster) + describeClaudeFailure() → an HONEST chip ("too complex to write
        in one shot — ran past the 200s limit; try fewer features / simpler part / another engine") + route wraps
        the Fusion block (fusion_build error chip + summary clears the loader). tsc + 81 tests green (9 fusion).
        VERIFIED end-to-end: the bracket that hung now writes in 136s (<200s ✓) and REACHES Fusion. It then fails
        HONESTLY at ExtrudeFeatures.add() — a script-correctness bug in Claude's one-shot adsk (profile/geometry),
        the real single-shot-complex-part ceiling, now VISIBLE not masked as a hang.
      RELIABLE FUSION now = simple→moderate parts (cube ✓ 56s; coaster/plates w/ holes). COMPLEX multi-feature
      parts (bracket w/ fillets+bolt-pattern, NEMA17) still hit the adsk-correctness ceiling — honest failure.
      OPTIONS for higher complex-part success (Vraj's call, latency/quality tradeoffs): (a) bounded RETRY that
      feeds the Fusion traceback back to Claude to fix the adsk (constitution's inspect→fix; ~+136s/attempt);
      (b) stronger Fusion adsk primer (defensive profile selection, fillets-last) in skills.ts; (c) STAGE the
      adsk build like OpenSCAD/Blender (the real structural fix). OpenSCAD's claude path shares the same 200s
      ceiling on complex mechanical prompts (left on default model to protect the verified BOSL2 bolt/gear).

- [~] VISUAL-TEST ROUND 3 (pm, Vraj — NVIDIA reference-image + Clean-in-Blender). FINDINGS (the
      FOCUS for next session = make these produce the EXPECTED output):
      • NVIDIA ref-image likeness is WRONG. "character from reference image but in a black hat" (Auto→NVIDIA)
        → a textured chibi COWBOY (inspect likeness 0.85 "unmistakable cowboy"), NOT the Claude Code mascot
        (Clawd). Refine "use the claude code mascot from the reference image" + Clean-in-Blender → an armless
        chubby figure (likeness 0.6 "clear chubby armless" — closer to Clawd's silhouette) but see regression
        below. ★ VRAJ HYPOTHESIS (verify FIRST next session): "NVIDIA is not able to get access to the image."
        VERY LIKELY TRUE BY DESIGN — we do NOT send the image to NVIDIA. The pipeline is: 📎 upload → Claude
        VISION `describeImage` (claude -p reads the local file) → a TEXT description → TRELLIS **text→3D**.
        TRELLIS never sees the pixels (NVIDIA's hosted image→3D 500s — see [refimg]). So the mascot is only as
        good as Claude's text description, and TRELLIS reinvents a generic figure (cowboy) from it. NEXT:
        (1) confirm describeImage actually RAN on the upload + produced a Clawd-specific description (log it /
        surface it in the inspect chip), and that refImageUrl threaded clarify→generate; (2) the REAL fix for
        true likeness = NVIDIA/TRELLIS **image→3D** (hosted endpoint 500s → retry/self-host Run-on-RTX) OR a
        provider that accepts an image (Rodin/Tripo/Meshy image→3D); (3) stopgap = a hardcoded canonical Clawd
        descriptor for "claude/claude code mascot" prompts so text→3D is at least on-brand.
      • CLEAN-IN-BLENDER is a visible DOWNGRADE, not a fix (Vraj: "a fix with blender, still not fixed"). The
        cleaned result came back (a) COLORLESS/gray — the cleaned STL carries no GLB, and the route's cleaned
        `mesh` event drops glbUrl → viewport renders the bare STL (blender.ts cleanStlInBlender exports STL
        only; route finish() cleanInBlender block sends no glbUrl); (b) BLOBBY — decimate ratio 0.5 + weld
        rounds off the already-low-poly TRELLIS mesh; (c) SCALED UP oddly (44×45×60mm raw → 128×96×120mm
        cleaned, 207g/16h42m). NEXT: keep the textured GLB for PREVIEW after cleaning (STL stays the print
        artifact), gentler/area-gated decimation, and preserve the original scale (don't rescale on clean).
      NO code change this round (Vraj said stop + commit). Fusion fix from the prior entry stands (verified).

- [x] SESSION ("test and fix"): the 3 NEXT-FOCUS items + the REAL NVIDIA blocker, all CURL-VERIFIED
      live (Blender 9876 ✓ + Fusion 27182 ✓ + NIM key ✓). systematic-debugging throughout; tsc + 83 tests green.
      • NVIDIA NIM 500 RETRY (the actual "NVIDIA did nothing" cause, found while testing FOCUS #1). ROOT: the hosted
        TRELLIS endpoint intermittently 500s under load (probed raw 3×: 500 / 200 / 500 — ~2-of-3 fail), and
        requestGlb THREW on any !res.ok with NO retry (the retry loop only retried EMPTY artifacts) → instant drop
        to the slow procedural blob. FIX (nim.ts): 5xx/429 = transient → return null so the loop retries (4xx still
        throws — a real request bug); 6 tries + light backoff (a 500 fails in ~1s, retries are cheap) lifts ~1/3 →
        ~90%+. Abort 220→280s. VERIFIED: "claude code mascot" → "NVIDIA NIM ✓ textured GLB" THROUGH the 500s.
      • CLEAN-IN-BLENDER no longer a colorless/blobby downgrade (FOCUS #2). ROOT (systematic-debugging, REPRODUCED):
        NOT a scale bug — a headless import→clean→export round-trip preserves bbox EXACTLY ([0.784,0.881,0.999]
        in == out; the decimate gate 150k never even fires on a 16–50k TRELLIS mesh). The real bug = the cleaned
        `mesh` event carried NO glbUrl → reducer nulls it (viewModel.ts:114) → viewport drops from the textured GLB
        to the bare gray STL = BOTH "colorless" AND "blobby" (same cause). FIX (route.ts finish(): new previewGlbUrl
        param; the NVIDIA finish() passes its GLB) → the cleaned mesh KEEPS the textured GLB for PREVIEW, the cleaned
        STL stays the print artifact. Decimate softened (gate 150k→250k, ratio 0.5→0.6). The earlier "44×45×60→
        128×96×120 scale-up" was default-120mm vs a differently-sized PRIOR version, NOT a clean bug. VERIFIED:
        Clawd+clean, sizeMm 80 → cleaned event glbUrl=model.glb textured:true · dims 84×83×80mm (height EXACT = no
        rescale) · "cleaned · Blender live".
      • NVIDIA REF-IMAGE TRANSPARENCY + CLAWD STOPGAP (FOCUS #1). (a) the NVIDIA path now SURFACES Claude's vision
        description as a chip ("saw in image: …") or an honest "couldn't read the reference image" warn — PROVES
        describeImage ran (was silent → Vraj's "NVIDIA can't see the image"). (b) canonicalDescriptor() (pure, 2
        tests): when the user NAMES the Claude mascot ("clawd" / "claude code mascot" / "claude|anthropic … mascot"),
        enrichPrompt short-circuits to a hand-written on-brand Clawd descriptor (coral teardrop body, dot eyes,
        stubby arms) instead of a generic reinvention. HONEST CEILING STILL STANDS: TRELLIS text→3D BLOBS a Clawd
        (inspect 0.15) — the canonical words fix the PROMPT, true likeness still needs image→3D (hosted 500s) or an
        image-accepting provider (Rodin/Tripo/Meshy). The stopgap makes it on-brand, not photoreal.
      • FUSION TRACEBACK→FIX RETRY (FOCUS #3, the ExtrudeFeatures.add ceiling). fusion.ts: on a runtime SCRIPT
        failure (adsk traceback — NOT an MCP/connection error), feed Fusion's own traceback back to Claude
        (claudeFusionFixScript, sonnet) and retry once (bounded, FUSION_FIX_RETRIES=1); re-appends the export block
        if the fix dropped it. route wires an onStatus chip. VERIFIED LIVE: L-bracket w/ 12mm bore + 4 M4 holes +
        fillet → attempt 1 FAILED → "feeding the traceback back to Claude to fix it (retry 1/1)" → attempt 2 ✓
        exported STL (the FIXED script is saved as the editable `source` → a refine edits the working version).
      • PROJECTS/PROFILE SCROLL FIX (Vraj: "add scroller in projects list, no page scroll"). ROOT: globals.css
        locks html/body `overflow:hidden` (studio viewport-lock) → /projects + /profile (minHeight:100vh) got
        CLIPPED, couldn't scroll past one screen of cards. FIX: those two route pages are now their OWN scroll
        containers (height:100vh + overflowY:auto) — leaves the global studio lock untouched. (src/app/{projects,
        profile}/page.tsx — route pages, not the frozen design dirs.) Routes 200; FOR VRAJ to eyeball the scroll.
      FOR VRAJ to eyeball in /app: NVIDIA figure → "saw in image"/research chip + a TEXTURED (not gray) model even
        after Clean-in-Blender · Clean-in-Blender keeps color + same size · a complex Fusion bracket self-repairing.

- [x] OPENSCAD "having some issue" (Vraj live-test: threaded jar → all stages "Command failed", fell to fallback).
      ROOT (systematic-debugging): OpenSCAD is NOT broken — a deterministic "a box" renders fine, and "a threaded
      jar with a screw-on lid" run ALONE built 5 stages with REAL BOSL2 male+female threads in 163s. The failure
      was claudePlan hitting the 200s `claude -p` limit (the chip ran 00:00→03:20 = a 200s hang) → fallbackPlan
      (generic block), worsened when another generation (the NVIDIA fairy) ran concurrently and starved the shared
      claude calls. The minkowski fallback renders are instant (0.05s), so the render "Command failed" was
      load/timeout, not an openscad bug. FIX: pin the OpenSCAD plan writer to Sonnet (OPENSCAD_CLAUDE_MODEL, default
      sonnet) — same as Fusion. VERIFIED: M10 bolt+nut on Sonnet → real M10×1.5 threaded_rod + threaded_nut + 0.4mm
      print clearance, 6 stages, watertight, in 85s (was ~160s) — faster AND keeps thread quality, well under 200s.
      Reverses the earlier "leave OpenSCAD on default to protect BOSL2 quality" deferral (quality now verified on
      Sonnet). NOTE: concurrent heavy generations still slow each other (shared claude -p) — testing one at a time
      is best; a generate-route serialization/queue is the deeper fix (deferred). tsc + 83 tests green.

- [x] BLENDER COLD-START FALLBACK FIXED + FUSION HONEYCOMB DOCUMENTED (cont., Vraj: "snail with
      spiral shell came out a generic creature — fix why it always happens when starting a new session; and find
      the cause of the Fusion honeycomb fail, document for future"). systematic-debugging, tsc + 83 tests green.
      • BLENDER (the snail): the creature in the screenshot (stacked-sphere body + eyes/ears/feet) is the hardcoded
        fallbackBpyPlan — claudeBpyPlan THREW. ROOT: it was the ONLY plan-writer still on Opus (OpenSCAD/Fusion
        already Sonnet-pinned) → Opus reasons past the 240s claude -p limit on a hard organic prompt → ETIMEDOUT →
        fallback. WHY "only at session start": /api/classify (~8.5s) + /api/clarify fire concurrent claude -p at
        session start, starving the shared CLI → the slow Opus plan tips over 240s; later gens (no competing calls)
        succeed. EVIDENCE: build finished at 04:06 agent-clock = exactly the 240s timeout. FIX: pin to Sonnet
        (BLENDER_CLAUDE_MODEL, blender.ts) — verified Sonnet writes a valid 4-stage snail in 44.6s — + a TRANSPARENT
        write_blender WARN chip on fallback ("couldn't write a custom model (Claude ran past the limit — try again)
        → generic stand-in shape") so a fallback is no longer disguised as success. See [blender-model].
      • FUSION (the honeycomb): NOT broken — clean one-at-a-time repro built it on the RETRY (attempt 1 failed
        02:31 → traceback→fix → attempt 2 exported 04:16, 21g/450 layers). Honeycomb is a single-shot ceiling part
        the ONE bounded retry rescues; Vraj's fail was the same concurrency starve. Levers: FUSION_FIX_RETRIES=2 +
        run one at a time. No Fusion code change. See [fusion-honeycomb].
      • SHARED deeper fix (deferred, both engines + OpenSCAD): SERIALIZE the generate route so classify/clarify/
        generate don't share-starve claude -p — that's the real cure for "first-of-session" flakiness.
      FOR VRAJ: re-run "a snail with a spiral shell" in Blender → should now be a REAL snail (source=claude, not
      the creature); if any plan ever falls back you'll SEE the honest warn chip.

- [x] FUSION DESIGN TYPES → ASSEMBLY + HYBRID (Vraj showed Fusion's "What do you want to design?"
      picker, "add these all"). Scoped to Assembly+Hybrid (dropped Drawing + Electronics — off-mission / not
      scriptable via our MCP); UX = AUTO-DETECT (no picker, no jargon, no frozen-UI touch). Spec:
      docs/superpowers/specs/2026-06-18-fusion-design-types-design.md · DECISIONS [fusion-design-types].
      • Assembly is a BUILD MODE of the LOCKED Fusion engine (not a new engine). src/server/fusion.ts (additive):
        classifyFusionBuild (pure, word-boundary keywords — TDD'd) · claudeFusionAssemblyScript (several named
        components + ~0.3mm print clearances) · EXPORT_TAIL_ASSEMBLY (exports model.stl combined preview +
        part_<i>.stl per component + a PARTS_OK manifest) · extractFusionParts (pure — TDD'd) · generateFusionAssembly
        (copies parts into the job dir, reuses the traceback→fix retry). Hybrid folds in (no 3rd path).
      • Route (src/app/api/generate): Fusion branch auto-routes part-vs-assembly; summary "built as N printable
        parts: …" + carries the part graph; ProjectVersion.parts + summary.parts (src/lib, back-compat).
      • ★ The part graph is the NATIVE input for Print-Readiness v2 Stage C2 (decompose & nest) → ALSO advances #4.
      • tsc + 93 tests (10 new pure) green; existing OpenSCAD stream regression-verified (plan→mesh→estimate→
 printplan→summary). UI WIRED ("change the design"): parts now persist on the version + per-part
        STL downloads show in the Print-Readiness panel. FOR VRAJ: open Fusion (MCP 27182) → in /app try "a small
        hinged box with a snap lid" (Fusion engine or Auto) → watch it build multiple components → "built as N parts".
 • SPEED FIX: the hinged box FAILED at the 200s writer timeout. Root cause (timed standalone,
        NOT concurrency): the brief made Sonnet model a working hinge → ~170 lines, 230.9s. Fixed with a LEAN
        brief (simple parts that fit, no mechanism, ~90-line cap, no heavy primer) → 26.4s. DECISIONS [fusion-design-types].

- [x] PRINT-READINESS v2 — BACKEND BUILT (Vraj picked it over Drawing/Electronics). The big unbuilt
      NEXT-FOCUS #4 ("the ant"). Fully ADDITIVE + TDD'd, NO frozen-UI touch. DECISIONS [print-ready-v2-backend].
      • src/server/printReady/: bed.ts (BAMBU_A1 256³, 0.4 nozzle) · diagnose.ts (REAL: manifold=open-edge count ·
        floaters=union-find shells · overhang fraction; thin=coarse per-shell heuristic) → 4 checks+score+grade ·
        orient.ts (best of 6 axis-aligned poses + WHY) · exportFormats.ts (OBJ + 3MF via a hand-rolled stored zip +
        CRC-32 → NO new dep; system unzip confirms the 3MF is valid) · readiness.ts (composer: diagnose+orient+
        decompose[none/slab/parts]+reported repairs+narrative).
      • printready AgentEvent + reducer + ViewModel.readiness (src/lib). POST /api/prepare SSE (readMesh→diagnose→
        orient→write OBJ/3MF→stream printready+narrative; pure, no subprocess).
      • tsc + 115 tests (22 new) green; curl+unzip verified e2e (box → readiness 90/100 ready · STL/OBJ/3MF · valid 3MF).
 • UI WIRED ("change the design"): a **"Prepare for print"** button + a **Print-Readiness panel**
        (right rail, landing style) — score/grade · 4 checks · orientation+why · decompose note · narrative ·
        STL/OBJ/3MF downloads · assembly per-part downloads; readiness persisted per version. playPrepareStream +
        PrintReadyPanel.tsx + Studio wiring + DESIGN.md. /app + landing serve 200; tsc + 115 tests green. FOR VRAJ:
        generate anything → "Prepare for print" → eyeball the panel + download the 3MF.
      • DEFERRED (still): overhang heat-map viewport overlay; (P3/P4) Blender auto-thicken/repair TRANSFORMS (reported
        only now), real decompose&nest geometry, OrcaSlicer G-code. The Fusion assembly part graph feeds the decompose stage.

- [x] PR #6: NVIDIA OUTPUT QUALITY FIX. Root cause: enrichPrompt was generating 60-100 word descriptors
      that CONFUSED TRELLIS (produces blobs with verbose prompts). Fixes: (1) enrichPrompt now 25-45 words
      (TRELLIS works BETTER with fewer); (2) glbToStl decimation threshold 200k→500k, ratio 0.2→0.5 + light
      smooth pass; (3) self-inspect threshold 0.45→0.55, retries with SHORTER prompts + 3 seeds; (4) NIM
      retries 6→8; (5) Blender fallback if all NVIDIA retries score <0.3. 143/143 tests, build clean.

- [x] PR #7: COMMON SENSE FOR PRINTABLE DESIGN. Root cause: Claude had no knowledge of HOW objects
      actually work physically — keychains without holes, blind holes instead of through-holes, misspelled
      text, paper-thin coins. Fix: COMMON_SENSE_BLOCK injected into BOTH OpenSCAD (route.ts) and Blender
      (blender.ts) generation prompts. Covers: keychains (through-hole mandatory), text/spelling (exact
      copy from prompt), coins (3-4mm thick, raised rim), phone stands (cable slot, angled back), hooks
      (adequate opening), containers (press-fit lip), through-holes (difference not indent), fillets.
      143/143 tests, build clean.

## ★ NEXT SESSION — FOCUS: make the app produce WORKING / EXPECTED output (Vraj's priority, ordered)
1. NVIDIA REFERENCE-IMAGE LIKENESS (Vraj: "nvidia is not able to get access to the image"). Root: we send
   Claude's TEXT description to TRELLIS text→3D, never the pixels (hosted image→3D 500s). (a) prove/log that
   describeImage runs on the upload + writes a Clawd-specific description; (b) get TRUE image→3D working
   (retry/self-host TRELLIS image→3D, or an image-accepting provider — Rodin/Tripo/Meshy); (c) stopgap =
   canonical Clawd descriptor for "claude (code) mascot". See Round-3 finding above.
2. CLEAN-IN-BLENDER must not DOWNGRADE: keep textured GLB for preview, gentler decimation, preserve scale.
3. FUSION complex parts: add a bounded "feed the Fusion traceback back to Claude → fix the adsk" retry
   (the ExtrudeFeatures.add ceiling). Optionally give OpenSCAD's complex path the same sonnet pin.
4. ★ PRINT-READINESS PIPELINE v2 (NEW, Vraj — the "ant": great shape, not printable). Full plan:
   docs/superpowers/specs/2026-06-17-print-readiness-pipeline-v2-design.md (+ ROADMAP "Printability intelligence"
   + DECISIONS [print-v2]). v1 only MEASURES; v2 TRANSFORMS: DIAGNOSE (4 checks w/ regions) → ORIENT (auto flat-
   vs-upright, Tweaker-3 fork) → REPAIR/THICKEN/HOLLOW (thin legs, floaters, fragile joints) → SUPPORTS (tree vs
   none + visualize) → EXPORT (3MF/OBJ/GLB/STEP/G-code for the real Bambu A1, not just STL) → Print-Readiness
   panel + "how I'd print it & why" narrative. ★ Plus DECOMPOSE complex models into PARTS nested on ONE plate
   (the ant → body/head/legs printed together in one job, then assembled). LOCKED (Vraj): OrcaSlicer · auto-apply
   orientation · auto-thicken/repair (don't ask) · NO live overlay → a per-iteration "Prepare for print" button.
   Phased P0(button shell)→P1(formats+Bambu bed+heat-map)→P2(diagnose+auto-orient)→P3(auto-repair + decompose+
   nest+assembly)→P4(OrcaSlicer G-code + real print). Smaller open Qs in the spec (connector style, decompose
   granularity, blob segmentation). NOTE: NVIDIA ref-image likeness = documented ceiling, retrying won't fix it
   (DECISIONS [nvidia-refimg-ceiling]); Fusion confirmed working.
5. Then: the older NEXT backlog below (web-research enrichment, cross-device mesh, Redis/Sentry/Arize, landing showcase).

## IN PROGRESS
- [~] FINAL CONFIRMATIONS (Vraj, in-app): signed in, generate a model → confirm it shows in /projects and
      survives a reload (DB round-trip). [DONE in code: SIGN-OUT in TopBar→/profile→`/`; /profile page.]
      Cross-device reopen needs storageUrl (CORS) — local meshUrl works same-machine.

## BLOCKED
- [ ] (none) — blender-mcp confirmed working as a DIRECT SOCKET (9876), not as Claude Code MCP tools.

## NEXT (ordered) — done: meshgen(NIM) ✓ · clarify(prompt-specific) ✓ · detailed enrichment ✓ · make-with-AI ✓ · GLB textured/bright ✓ · reference-image upload(vision) ✓ · blender auto-cleanup ✓ · nim→live-Blender ✓ · Hunyuan removed ✓
1. (VRAJ) VISUAL-TEST in /app (new session): "a chubby sitting dragon" → bright TEXTURED dragon · "god of war
   kratos" → Kratos-specific clarify questions + model appears in your Blender · 📎 upload a reference photo →
   it builds a model like it · "a vase 30cm" → ~300mm + split. Report what looks off.
2. BROWSERBASE WEB-RESEARCH for OBSCURE named subjects (a specific uni's mascot Claude doesn't know): fetch a web
   page/description → feed into enrichPrompt. (Claude already covers famous subjects; this is for the long tail.)
3. NVIDIA image→3D: revisit if NVIDIA fixes the hosted 500 OR self-host TRELLIS (Run-on-RTX) — then swap vision→text
   for true image→3D. Also Edify-3D 4K finals option.
4. (VRAJ optional) Topup Hyper3D OR addon→FAL_AI, then ENABLE_RODIN=1 for live-build-in-Blender (code ready).
5. Cross-device mesh (storageUrl + InsForge CORS) · signed-in DB round-trip eyeball · model-search "Use this".
6. Then Redis/Sentry/Arize + deeper printability + LANDING SHOWCASE (printer/dragon GLBs assembling). ROADMAP.
2. (VRAJ, optional) Topup the Hyper3D Rodin trial (API_INSUFFICIENT_FUNDS) OR switch the addon to FAL_AI to get the
   LIVE-build-in-Blender path (code is wired + verified; just credit-blocked). Then watch a dragon build in Blender.
3. MESHGEN v1.1: NVIDIA NIM image→3D via NVCF asset upload (hosted inline base64 → 422) so make-with-AI uses the real
   thumbnail; Edify-3D 4K-PBR finals option; mesh repair/decimate before print; GLB in the forming/gizmo path (orbit-only now).
4. MODEL SEARCH v1.1: more live results importable (Browserbase Sessions/auth) + fill thangs/thingiverse/makerworld parsers.
5. Cross-device mesh: prefer storageUrl on reopen + InsForge Storage CORS for the r3f loader.
6. LANDING SHOWCASE (ROADMAP): app-made models (printer/dragon GLBs saved) assembling w/ color — "made by the app".
7. Then Redis/Sentry/Arize + deeper printability intelligence. ROADMAP. (Hunyuan3D dropped — committed to NVIDIA NIM.)

## CUT (decided — do not revisit)
- ~~multi-engine picker UI · Fusion~~ → REVERSED (Vraj installed Fusion + wants all engines
  selectable). Now BUILT: 4-engine picker + Auto + Fusion engine. FreeCAD/Tinkercad still cut.
- direct vertex editing · virtual-only printer · 48h scope
- "Hardware Dark" theme (export shipped light) · Novita as a primary engine (backup only)
- figure/studio-explode in the Plan 01 viewport (that's the SHOULD Blender engine; feed-only for now)
