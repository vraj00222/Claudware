# Claude Hardware

**Describe it. We make it printable.**

Claude Hardware is an AI-powered 3D printing design studio. Describe any object in plain language — a phone stand, a dragon figurine, a threaded bolt — and Claude designs it, makes it printable, shows it forming live in a 3D viewport you can orbit and drag, inspects its own render, fixes its own mistakes, and exports a print-ready file for your printer.

The barrier to 3D printing isn't the printer — it's design expertise. We supply it.

> Built with Claude Code during CAL AI HACKATHON 2026. Track: Lab.

---

## What it does

1. **Describe** — type, speak, or pick a prompt ("a gear with 24 teeth", "a chubby sitting dragon")
2. **Clarify** — Claude asks smart, prompt-specific questions (style? size? pose?) before building
3. **Design** — watch the model build step-by-step in a live 3D viewport (and optionally in a real CAD app)
4. **Validate** — automatic printability checks (watertight, wall thickness, overhangs, single body)
5. **Prepare** — auto-orient, export STL/OBJ/3MF/G-code, real slicing with PrusaSlicer
6. **Print** — send to your Bambu A1 (or any printer) with one click

## 5 engines, 1 brain

| Engine | Best for | How it works |
|--------|----------|--------------|
| **OpenSCAD** | Mechanical parts, gears, bolts, brackets | Claude writes parametric SCAD scripts with BOSL2 — real threads, real gears |
| **Blender** | Organic shapes, figurines, artistic models | Claude writes staged `bpy` Python — live build in Blender or headless |
| **Fusion 360** | Precise CAD, assemblies, multi-part prints | Claude writes `adsk` scripts via Fusion's HTTP MCP — watchable in Fusion |
| **NVIDIA NIM** | Textured figurines, characters, creatures | TRELLIS text-to-3D — textured GLB preview + printable STL |
| **Auto** | Everything (default) | Claude classifies your prompt and picks the right engine |

Plus **Clean in Blender** (post-step) and **Model Search** (find existing models before generating).

## Sponsor integrations

| Sponsor | What it powers |
|---------|---------------|
| **Anthropic** (Claude) | The brain — designs, classifies, clarifies, self-inspects, fixes |
| **Deepgram** | Voice input — speak your idea instead of typing |
| **NVIDIA NIM** | TRELLIS text-to-3D for textured organic models |
| **Redis** | Semantic generation cache + vector search + agent memory |
| **Browserbase** | Live web search of free model repos (Printables) — reuse before regenerate |
| **The Token Company** | Prompt compression — cuts Claude token costs via bear-2 |
| **InsForge** | Auth (Google OAuth) + database (per-user projects) + file storage |

Every integration is **key-gated with a working fallback** — the app boots and demos with zero keys.

---

## Quick start

```bash
# Clone
git clone https://github.com/vraj00222/Claudware.git
cd Claudware

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Fill in your API keys (see "Environment variables" below)

# Install system tools (Ubuntu/Debian)
sudo apt-get install -y openscad blender prusa-slicer

# Clone BOSL2 for OpenSCAD mechanical parts
git clone https://github.com/BelfrySCAD/BOSL2.git tools/openscad-libs/BOSL2

# Build + run
npm run build
npm run dev
# → http://localhost:3000
```

### Routes

| Route | What |
|-------|------|
| `/` | Animated landing page |
| `/app` | Studio (behind Google sign-in; "continue without signing in" for dev) |
| `/projects` | Your saved projects gallery |
| `/profile` | Account + sign out |

### Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Required? | What |
|----------|-----------|------|
| `ANTHROPIC_API_KEY` | **Yes** for real generation | Claude API key — the brain |
| `NVIDIA_NIM` | For textured figurines | NVIDIA NIM key (`nvapi-...`) from build.nvidia.com |
| `DEEPGRAM_API_KEY` | For voice input | Deepgram STT key |
| `REDIS_URL` | For semantic cache | `redis://localhost:6379` or Redis Cloud URL |
| `BROWSERBASE_API_KEY` | For live model search | Browserbase API key |
| `BROWSERBASE_PROJECT_ID` | For model search | Browserbase project ID |
| `TTC_API_KEY` | For token savings | The Token Company API key |
| `NEXT_PUBLIC_INSFORGE_URL` | For auth + persistence | InsForge project URL (browser) |
| `NEXT_PUBLIC_INSFORGE_ANON_KEY` | For auth + persistence | InsForge anon key (browser) |
| `INSFORGE_URL` | For server storage | InsForge URL (server-only) |
| `INSFORGE_API_KEY` | For server storage | InsForge admin key (server-only) |

> **Zero-key boot**: the app works with NO keys — deterministic generation, localStorage persistence, Web Speech voice, in-memory cache. Real keys unlock real generation.

### Optional: live CAD sync

- **OpenSCAD**: open `tools/_watch/model.scad` with Design → Automatic Reload — watch the same build in the native app
- **Blender**: N-panel → BlenderMCP → Connect (socket 9876) — watch Claude build in your Blender window
- **Fusion 360**: HTTP MCP on `127.0.0.1:27182` — watch parts build in Fusion

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (Next.js + Tailwind + react-three-fiber)      │
│  "Hardware Paper" design system — warm light, terracotta│
│  Pure components: AgentEvent in → JSX out                │
└───────────────────────┬─────────────────────────────────┘
                        │ SSE (AgentEvents)
┌───────────────────────▼─────────────────────────────────┐
│  /api/generate — the orchestrator                        │
│  classify → clarify → resolve engine → generate → finish│
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ │
│  │ OpenSCAD │ │ Blender  │ │ Fusion   │ │ NVIDIA NIM │ │
│  │ (BOSL2)  │ │ (bpy)    │ │ (adsk)   │ │ (TRELLIS)  │ │
│  └──────────┘ └──────────┘ └──────────┘ └────────────┘ │
│  + validate + estimate + printplan + storage upload      │
└───────────────────────┬─────────────────────────────────┘
                        │
┌───────────────────────▼─────────────────────────────────┐
│  Integrations (all key-gated, all have fallbacks)       │
│  Voice→Deepgram(Web Speech) · Cache→Redis(in-mem)       │
│  Auth→InsForge(zero-key) · Search→Browserbase(curated)  │
│  Compress→TTC(passthrough) · Telemetry→Sentry(no-op)    │
└─────────────────────────────────────────────────────────┘
```

### Key files

| Path | What |
|------|------|
| `src/app/api/generate/route.ts` | The main generation endpoint — SSE orchestrator |
| `src/server/openscad.ts` | OpenSCAD engine (Claude → SCAD + BOSL2 → render → STL) |
| `src/server/blender.ts` | Blender engine (Claude → bpy → live/headless → STL) |
| `src/server/fusion.ts` | Fusion engine (Claude → adsk → HTTP MCP → STL) |
| `src/server/meshgen/nim.ts` | NVIDIA NIM TRELLIS (text → textured GLB + STL) |
| `src/server/engineRoute.ts` | Auto-routing classifier (prompt → best engine) |
| `src/server/printPlan.ts` | Print Brain — dims, supports, split decision |
| `src/server/printReady/` | Print Readiness v2 — diagnose, orient, export 3MF/OBJ/G-code |
| `src/server/claude.ts` | Shared Claude API client (claudeText + claudeVision) |
| `src/server/genCache.ts` | Redis semantic cache + vector search |
| `src/server/agentMemory.ts` | Redis agent memory (cross-session learning) |
| `src/lib/agentStream.ts` | Client-side SSE consumer → AgentEvents |
| `src/components/` | Pure UI components (frozen design) |
| `src/viewport/` | react-three-fiber 3D viewport |
| `frontend/` | Claude Design export — the design contract (read-only) |

---

## The generation pipeline

```
User prompt
    │
    ▼
┌─ Classify (Claude Haiku) ──────────────────────────┐
│  Is this mechanical? organic? a character?          │
│  → route to the right engine                        │
└──────────────────────┬─────────────────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Clarify (prompt-specific)          │
    │  Dragon → style? wings? size?       │
    │  Bracket → dimensions? mounting?    │
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Generate (engine-specific)         │
    │  Claude writes the recipe           │
    │  (SCAD / bpy / adsk / NIM call)    │
    │  Streams mesh stages → viewport     │
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Finish                             │
    │  Validate · Estimate · Print Plan   │
    │  Storage upload · Summary           │
    │  Optional: Clean in Blender         │
    └──────────────────┬──────────────────┘
                       │
    ┌──────────────────▼──────────────────┐
    │  Prepare for print (on demand)      │
    │  4 checks · Auto-orient · G-code    │
    │  STL / OBJ / 3MF / G-code export   │
    └─────────────────────────────────────┘
```

## Testing

```bash
npm test          # 216 tests across 40 files
npm run build     # Production build (13 routes)
npm run lint      # ESLint
```

### Engine test prompts (what we verified)

| Engine | Prompt | Result |
|--------|--------|--------|
| OpenSCAD | "a simple phone stand" | 6 stages, watertight, cable slot, gussets |
| OpenSCAD | "M10 hex bolt with threads" | Real BOSL2 threaded_rod, 3 stages, 17mm AF |
| Blender | "a tiny rocket ship" | 3 stages, nose cone + fins + nozzles, 68mm |
| NVIDIA | "a chubby sitting dragon" | Textured GLB + STL, 120mm, print plan |
| Auto | "a cute anime cat figurine" | Correctly routes → NVIDIA |
| Search | "benchy" | Curated 3DBenchy + live Printables results |
| Prepare | Any STL | Score/100, 4 checks, orient, STL/OBJ/3MF/G-code |

---

## Design system — "Hardware Paper"

A warm, light system with one semantic accent (terracotta `#cc785c`).

- **Sans**: Bricolage Grotesque (bold, characterful)
- **Mono**: JetBrains Mono (machine output)
- **Rule**: if a human said it → sans; if the machine did it → mono
- **Motif**: layer lines (the brand — 3D prints build from stacked horizontal layers)
- **Never**: shadows, gradients, glassmorphism, spinners (use the PrinterLoader)

See [DESIGN.md](DESIGN.md) for the full design spec.

---

## Project structure

```
Claudware/
├── src/
│   ├── app/           # Next.js app router (pages + API routes)
│   │   ├── api/       # generate, clarify, classify, search, import,
│   │   │              # prepare, transform, split, upload, print, redis
│   │   ├── app/       # Studio page
│   │   ├── projects/  # Projects gallery
│   │   └── profile/   # User profile
│   ├── components/    # Pure UI components (frozen design)
│   ├── design/        # Design tokens + Scaler
│   ├── lib/           # Client-side logic (streams, projects, hooks)
│   ├── server/        # Server-side engines + integrations
│   │   ├── meshgen/   # NVIDIA NIM + provider seam
│   │   ├── modelSearch/ # Browserbase + curated fallback
│   │   └── printReady/  # Print readiness pipeline v2
│   └── viewport/      # react-three-fiber 3D viewport
├── frontend/          # Claude Design export (read-only design contract)
├── public/            # Static assets (logo, fonts, generated models)
├── tools/             # Python scripts, BOSL2 libs, OpenSCAD watch
├── migrations/        # InsForge database migrations
├── docs/              # Specs, plans, setup, roadmap
└── demo-fixtures/     # Cached demo runs
```

## Documentation

| Doc | What |
|-----|------|
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture, AgentEvent contract, engine patterns |
| [DESIGN.md](DESIGN.md) | UI design system — "Hardware Paper" |
| [DEMO.md](DEMO.md) | Demo script + do-not-break paths |
| [PROGRESS.md](PROGRESS.md) | Build log — what's done, what's next |
| [DECISIONS.md](DECISIONS.md) | Technical decisions (append-only) |
| [CLAUDE.md](CLAUDE.md) | Agent constitution — rules, phase map, engines |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Future capabilities |
| [docs/SETUP.md](docs/SETUP.md) | Dev environment setup |

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 + TypeScript + Tailwind v4 |
| 3D viewport | react-three-fiber + drei (OrbitControls + TransformControls) |
| AI brain | Anthropic Claude (Sonnet/Haiku via Messages API) |
| Parametric CAD | OpenSCAD + BOSL2 library |
| Organic modeling | Blender (bpy, headless or live via BlenderMCP socket) |
| Precision CAD | Fusion 360 (adsk scripts via HTTP MCP) |
| Text-to-3D | NVIDIA NIM TRELLIS |
| Voice | Deepgram STT (Web Speech fallback) |
| Caching | Redis (semantic vector search + agent memory) |
| Token savings | The Token Company (bear-2 compression) |
| Auth + DB + Storage | InsForge (Google OAuth, Postgres, S3-compatible) |
| Web search | Browserbase (Fetch API for model repos) |
| Slicing | PrusaSlicer (console mode → real G-code) |
| Testing | Vitest (216 tests, 40 files) |

---

## License

MIT

---

*Built with [Claude Code](https://claude.ai/code) by [Vraj Patel](https://github.com/vraj00222)*
