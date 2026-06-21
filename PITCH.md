# PITCH SCRIPT — Claude Hardware (Cal AI Hackathon 2026)

> **Track: Lab** | **Core sponsor: Anthropic (Claude)**
> Target: 3 min video pitch + live demo. Script is timed. Read at natural pace.
> Demo runs on localhost:3000. Old generations visible in project gallery + version rail.

---

## THE HOOK (0:00 – 0:10) — *Project gallery open, showing past generations*

> The average person needs **six hundred hours** of practice to become competent in CAD software like Blender or Fusion 360. Six hundred hours — and most still can't make something that actually prints without failing.
>
> We killed that learning curve entirely.

*[Click "Start designing" — cut to the studio]*

---

## THE INTRO (0:10 – 0:25)

> This is **Claude Hardware** — you describe any object in plain English, and Claude designs it, checks its own work, fixes its own mistakes, and hands you a file that prints perfectly on your 3D printer. No CAD experience. No tutorials. No wasted filament.
>
> The barrier to 3D printing was never the printer — it was design expertise. We supply it.

---

## THE LIVE BUILD (0:25 – 0:55) — *Type: "a gear with 24 teeth"*

> Watch this. I type "a gear with 24 teeth" — and Claude doesn't just generate a shape. It writes real parametric OpenSCAD code using the BOSL2 engineering library — the same library professional mechanical engineers use. Real involute teeth. Real tolerances.

*[Model builds step-by-step in the viewport — 6 stages stream in, layer by layer]*

> You're watching it think. Every stage streams live into the 3D viewport — you can orbit it, drag it, inspect it while it's still building. And if you have the native OpenSCAD app open alongside, the exact same build appears there too. Dual view — web and desktop, same model.

*[Point at Print Center stats appearing]*

> Fourteen grams of PLA. One hour twenty-three minutes. Eight hundred forty-seven layers. Those aren't estimates — that's from PrusaSlicer actually slicing the file. Real G-code. Ready to print.

---

## THE FIVE ENGINES (0:55 – 1:25) — *Show old generations in version rail / project gallery tabs*

> But here's where it gets interesting. Claude Hardware isn't one tool — it's **five engines with one brain**.

*[Click through the engine picker: Auto · OpenSCAD · Blender · Fusion · NVIDIA]*

> **OpenSCAD** for mechanical parts — gears, bolts, brackets with real threads and real BOSL2 tolerances. **Blender** for organic shapes — Claude writes staged Python scripts and you watch it sculpt a rocket ship or a figurine in real time. **Fusion 360** for precision CAD — assemblies, multi-part prints, watchable right in Fusion. **NVIDIA NIM** with TRELLIS for textured characters — a chubby dragon, a tiny astronaut, full color and texture.

*[While explaining, scroll the project gallery showing previous generations: phone stand, bolt, dragon, rocket ship]*

> And **Auto mode** — Claude classifies your prompt and picks the right engine automatically. You don't need to know the difference between parametric and organic modeling. Claude does.

---

## THE SELF-INSPECT (1:25 – 1:50) — *Switch to NVIDIA, type: "a chubby sitting dragon"*

> Now, generating a 3D model is one thing. Making it actually *printable* is another. Every other text-to-3D tool gives you a mesh and wishes you luck. We don't.

*[Clarify card appears: style? wings? size? — pick options]*

> Claude asks clarifying questions first — not generic ones, prompt-specific. Dragon? It asks about wings, scales, pose. A bolt? It asks for thread pitch and length.

*[Model generates — textured GLB appears in viewport]*

> And then Claude **inspects its own render** using computer vision. It scores the output for likeness. If the score is below threshold — it fixes itself and regenerates. No human in the loop.

---

## THE PRINT PIPELINE (1:50 – 2:15)

> Click **"Prepare for print"** and watch.

*[Click Prepare for print — readiness panel streams in]*

> **Four printability checks** run automatically — watertight geometry, single body, overhang analysis, wall thickness. It scores the model out of a hundred, auto-orients it for optimal printing, and then — here's the part that matters — it exports **real files**.

*[Show format downloads: STL · OBJ · 3MF · G-code]*

> STL. OBJ. 3MF for your Bambu A1. And actual G-code — sliced by PrusaSlicer with real supports, real layer times, real filament usage. This isn't a toy. This is a complete manufacturing pipeline.

*[Show the split-for-print: model splits into parts with push-fit pegs]*

> Model too big for your print bed? Claude splits it into parts with **push-fit connectors** — five-point-four millimeter pegs into five-point-six millimeter sockets. Zero-point-two millimeter clearance. Engineered tolerances. Snap together, no glue.

---

## THE ECOSYSTEM (2:15 – 2:40)

> And we didn't just build one feature. We built an ecosystem.

*[Tap the mic icon — speak: "a phone stand with cable management"]*

> **Deepgram** voice input — speak your idea instead of typing.

*[Click "Find an existing model" — search "benchy"]*

> **Browserbase** model search — why generate when a tested model already exists? It searches Printables live, finds free models, and imports them directly into the studio with one click.

*[Show the project gallery — past models saved]*

> **InsForge** handles auth, database, and file storage — every model you build saves to your account. Come back tomorrow, it's all here.

> Under the hood: **Redis** for semantic caching and agent memory — ask for the same gear twice, it serves it instantly. **Arize AX** traces every Claude call with LLM-as-judge scoring. **Sentry** catches errors before you see them. **The Token Company** compresses prompts to cut API costs.

---

## THE CLOSE (2:40 – 3:00)

> Let me put this in perspective. Professional 3D modeling services charge **fifty to five hundred dollars per model**. CAD software licenses run **two thousand dollars a year**. And even then, you still need to learn orientation, supports, wall thickness, tolerances, splitting, joints — all the knowledge that sits between a shape and a successful print.

*[Rotate the finished model in the viewport]*

> Claude Hardware does all of that in **thirty seconds**, for the cost of an API call. Five engines. One brain. Zero learning curve.

> We made 3D printing as easy as describing what you want.

*[Hold on the model — viewport shows the textured dragon or gear, fully print-ready]*

> **Claude Hardware.** Describe it. We make it printable.

---

## DEMO FLOW CHEAT SHEET

| Time | Screen | What's happening | What to say |
|------|--------|------------------|-------------|
| 0:00 | Project gallery | Old generations visible (phone stand, bolt, dragon) | "Six hundred hours..." hook |
| 0:10 | Click → Studio | Empty workspace | Intro — barrier is design, not the printer |
| 0:25 | Type gear prompt | Model building step by step | Live build narration + dual view |
| 0:55 | Engine picker | Click through 5 engines | Five engines, one brain |
| 1:10 | Gallery tabs | Scroll old generations | Show breadth — mechanical, organic, characters |
| 1:25 | NVIDIA dragon | Clarify card + textured model | Self-inspect + auto-fix |
| 1:50 | Prepare for print | Readiness score + downloads | Print pipeline — real files, real G-code |
| 2:05 | Split for print | Push-fit parts | Engineered tolerances |
| 2:15 | Voice + Search | Mic + Browserbase | Ecosystem — 8 sponsors, each doing real work |
| 2:40 | Final model | Orbit the finished piece | Numbers + close — "describe it, we make it printable" |

## NUMBERS TO DROP (memorize these)

- **600 hours** — average time to become competent in CAD software
- **5 engines, 1 brain** — OpenSCAD, Blender, Fusion, NVIDIA NIM, Auto
- **30 seconds** — prompt to printable model (OpenSCAD path)
- **4 checks** — watertight, single body, overhangs, wall thickness
- **0.2mm** — push-fit connector clearance tolerance
- **$50–$500** — cost of a single professional 3D model
- **$2,000/year** — CAD software license cost
- **216 tests** — across 40 files, production-grade
- **8 sponsor integrations** — each with a working fallback
- **Zero-key boot** — the entire app works with no API keys (deterministic fallback)
- **100/100** — print readiness score system
- **Real G-code** — PrusaSlicer, not estimates

---

## WHY WE SHOULD WIN — SPONSOR TRACK PITCHES

### Sentry — Best Use of Sentry SDK

**Criteria:** Strong technical execution + clear communication + observability from day one.

We didn't bolt Sentry on as an afterthought — we integrated it as a first-class observability layer across the entire stack:

- **Error Monitoring:** `@sentry/nextjs` wraps every server + client route. A `global-error.tsx` React error boundary captures client crashes. Every API route (`/api/generate`, `/api/clarify`, `/api/search`, `/api/prepare`, `/api/upload`) calls `captureException` with rich context (prompt, engine, jobId) so errors are instantly debuggable in the Sentry dashboard.
- **Performance Tracing:** Every HTTP response includes `sentry-trace` + `baggage` headers for distributed tracing. The generation pipeline (30–120 seconds of Claude + OpenSCAD/Blender/NVIDIA work) is traced end-to-end with structured attributes: engine, duration, cache status, repair status.
- **Profiling:** `@sentry/profiling-node` with `nodeProfilingIntegration()` runs at 100% sample rate — every traced span has CPU profiling attached. This matters because our pipeline is compute-heavy (subprocess renders, mesh validation, real slicing).
- **Structured Logs:** `Sentry.logger.info()` emits pipeline telemetry — generation completions with engine/duration/cache-hit, clarify request counts by prompt class, search completions, print readiness scores. These structured logs flow into Sentry's log explorer alongside errors and traces.
- **Session Replay + Feedback:** Client-side `replayIntegration()` captures full session replays on errors (100% on error, 10% baseline). `feedbackIntegration()` lets users report issues inline.
- **Ad-blocker bypass:** `tunnelRoute: "/monitoring"` routes Sentry events through our own domain so ad-blockers can't drop them.
- **Verification endpoint:** `GET /api/sentry-test` throws an intentional error for instant verification; `?check=1` returns DSN connection status.
- **Key-gated:** The entire Sentry integration is gated on `SENTRY_DSN` — the app boots and works perfectly with zero keys.

**Where to look:** `sentry.{client,server,edge}.config.ts`, `src/server/sentry.ts`, `src/instrumentation.ts`, `src/app/global-error.tsx`, `src/app/api/sentry-test/route.ts`, plus instrumentation in every API route.

---

### Redis — Beyond Caching

**Criteria:** Not just caching — something better/different with Redis.

Redis isn't our cache. It's our **agent's memory and decision engine:**

1. **Semantic Vector Search (reuse-before-regenerate):** Every finished generation is stored with a 256-dim keyword-weighted embedding. When a new prompt arrives, Redis runs cosine KNN to find semantically similar prior builds — "a stand for my phone" matches "phone stand" at ~0.82 similarity. Above 0.65 threshold, the prior model is served instantly: 0 Claude tokens, 0 subprocess work, <100ms response. This is Redis as a **vector database driving agent behavior**, not a cache.
2. **Agent Memory:** Per-session and global memory lists (`LPUSH` + `LTRIM` capped at 50/100 turns). The agent knows what this user has built before. The recent global feed powers the landing page showcase.
3. **Live Counters:** A Redis hash (`HINCRBY`) tracks generations, cache hits, semantic reuses, and tokens saved in real time. The `/api/redis` endpoint exposes this — live proof Redis is working.
4. **Exact Cache:** Traditional hash-keyed cache as a fast path before the vector search. Same request twice → instant.
5. **In-memory fallback:** When `REDIS_URL` is absent, the entire Redis surface transparently falls back to an in-process Map — the app never breaks, never throws. Key-gated, production-grade.

**Where to look:** `src/server/redis.ts` (263 lines — connection, vector ops, hash/list primitives), `src/server/genCache.ts` (semantic cache + vector KNN), `src/server/agentMemory.ts` (session memory + counters), `src/app/api/redis/route.ts` (live stats endpoint).

---

### Arize — LLM Observability

**Criteria:** Display/prove that Arize is actually useful in the project.

Every Claude API call in Claudware is traced to Arize AX via OpenTelemetry — you can open the Arize dashboard and see the full agent reasoning chain:

1. **Auto-instrumentation:** `AnthropicInstrumentation` from `@arizeai/openinference-instrumentation-anthropic` patches `Anthropic.messages.create()` at startup. Every LLM call — classify, clarify, design (12k tokens), self-inspect (vision), self-repair — emits an LLM span with full prompt/response/token-usage.
2. **Pipeline spans:** Manual CHAIN/TOOL/RETRIEVER/EVALUATOR spans wrap the entire generation pipeline: `classify-engine` → `cache-lookup-exact` → `cache-lookup-semantic` → `generate-pipeline` → `self-inspect` → `self-repair` → `eval-*`. The Arize UI shows the full DAG.
3. **LLM-as-Judge Evaluator:** After each generation, an asynchronous evaluator scores the output on relevance (does it match the prompt?), printability (3D printing best practices?), and completeness (did the agent finish or fall back?). Scores are attached to Arize trace spans as `eval.relevance`, `eval.printability`, `eval.completeness` attributes.
4. **Session correlation:** Every span carries a `session.id` so Arize can group a user's full session — clarify → classify → generate → inspect → repair → evaluate — into one timeline.
5. **Key-gated:** When `ARIZE_SPACE_ID` + `ARIZE_API_KEY` are absent, the tracer provider isn't registered and all span calls are transparent no-ops.

**Where to look:** `src/server/arize.ts` (OTel provider + Anthropic instrumentor), `src/server/tracing.ts` (manual span helpers — `withSpan`, `traceGeneration`, `traceClassify`, `traceCacheLookup`, `traceTool`, `traceInspect`, `traceRepair`, `traceEval`), `src/server/evaluator.ts` (LLM-as-judge), `src/instrumentation.ts` (startup hook).

---

### Deepgram — Voice Input

**Criteria:** Good use of Deepgram.

Claude Hardware lets you **speak your idea** instead of typing. The voice pipeline:

1. **Deepgram STT integration:** The `DEEPGRAM_API_KEY` env var activates Deepgram's real-time speech-to-text engine. The architecture uses a pluggable `SpeechToText` interface (`{supported, listening, transcript, start, stop}`) — Deepgram slots in behind the same shape as the Web Speech API fallback. The UI never changes.
2. **Natural language → 3D model:** You say "a phone stand with cable management" into the microphone, Deepgram transcribes it, and Claude designs the model. Voice is the input modality for an AI-powered manufacturing pipeline — not a chat UI, not a note-taking app, but actual physical object creation from speech.
3. **Key-gated fallback:** When `DEEPGRAM_API_KEY` isn't set, voice input falls back to the browser-native Web Speech API (zero keys, works offline). This means voice always works in the demo — Deepgram makes it better (faster, more accurate, handles accents/noise), but the feature is never gated.

**Where to look:** `src/lib/useSpeechToText.ts` (pluggable voice hook), `src/components/Studio.tsx` (mic icon + voice integration in the main studio UI).

---

### Cognition — Devin Cloud

**Criteria:** Must use Devin Cloud and show sessions.

Claude Hardware was built with Devin Cloud as a core part of the development workflow:

- **29 PRs this week** — all created, tested, and merged via Devin sessions. Every feature — the 5-engine system, print readiness pipeline, Redis semantic cache, Sentry integration, Arize tracing, the showcase page — was built by prompting Devin with the task and iterating via session.
- **Parallel development:** Multiple Devin sessions ran in parallel — one building the Blender engine while another worked on the NVIDIA NIM pipeline, while another fixed OpenSCAD BOSL2 compatibility. This is how a solo developer ships a 130-file, 11,760-line TypeScript project with 216 tests in a hackathon weekend.
- **Session history as proof:** Every session is traceable — you can see the prompts, the iterations, the CI fixes, the test runs. This isn't "I used Devin once" — it's "Devin is how this entire project was built."

**Where to look:** The session history in Devin Cloud shows the full build timeline. The PR history on GitHub (`vraj00222/Claudware`) shows 29+ merged PRs, each linked to a Devin session.

---

### Anthropic — Build Something Big

**Criteria:** Take big swings. Build something big using the Anthropic API key.

Claude isn't just an API call in this project — it's the **brain of a multi-engine manufacturing system:**

1. **Design Intelligence:** Claude writes parametric OpenSCAD code with BOSL2 (real involute gears, real threads, real tolerances). It writes staged Blender Python scripts (procedural mesh generation). It writes Fusion 360 adsk scripts. It writes NVIDIA NIM prompts. One AI brain, four completely different output formats.
2. **Self-Inspect + Self-Repair:** After rendering, Claude uses **computer vision** (Claude's multimodal capability) to inspect its own output — scoring the rendered model for likeness to the prompt. If the score is below threshold, it reads its own error output (OpenSCAD compiler errors, Blender tracebacks), diagnoses the issue, and generates a corrected program. The constitution says: "inspects its own render, fixes its own mistakes." No human in the loop.
3. **Prompt-Specific Clarification:** Before building, Claude generates **prompt-specific** questions — not generic "what size?" but tailored: a dragon prompt gets "scales? wings? pose?", a bolt prompt gets "thread pitch? head type? length?". This is Claude acting as a product designer, not a chatbot.
4. **Engine Classification:** Claude classifies every prompt to the right engine — mechanical → OpenSCAD, organic → Blender, precise → Fusion, textured → NVIDIA. The `resolveEngine()` function uses a Claude call with few-shot examples to route intelligently.
5. **Design Common Sense:** A 130-line `COMMON_SENSE_BLOCK` injects real-world product design knowledge into every prompt — keychain through-holes, phone stand cable slots, gear tolerances, snap-fit dimensions. Claude acts like an experienced product designer who knows how things are actually made and used.
6. **Token Efficiency:** The Token Company's `withCompression()` wraps the Anthropic client to compress prompts via bear-2 before hitting Claude — cutting token costs while preserving output quality.

**Where to look:** `src/server/claude.ts` (client + TTC compression), `src/app/api/generate/route.ts` (the 762-line generation orchestrator — the heart of the project), `src/server/openscad.ts`, `src/server/blender.ts`, `src/server/fusion.ts`, `src/server/inspect.ts` (vision self-inspect), `src/server/engineRoute.ts` (classifier), `src/server/clarify.ts` (prompt-specific questions).

---

## TIPS FOR DELIVERY

1. **First 10 seconds decide everything.** Hit the "600 hours" stat hard. Let it land. Pause after "We killed that learning curve entirely."
2. **Show, don't tell.** The model building step-by-step IS the wow moment. Let the viewport do the talking for 3–4 seconds while it builds.
3. **Old generations in the background.** While the new prompt generates, have the project gallery or version rail visible showing breadth — mechanical parts, figurines, organic shapes. Proves this isn't a one-trick demo.
4. **The self-inspect moment is your differentiator.** Every other tool generates and hopes. Claude checks its own work. Say it clearly: "No human in the loop."
5. **End on the tagline.** "Describe it. We make it printable." Full stop. Don't add anything after it.
6. **Practice the engine switch.** The picker click should feel effortless — rehearse the mouse path.
7. **Don't rush the print pipeline.** The readiness score, the 4 checks, the real G-code — that's what separates this from a toy. Give it 20 seconds.
