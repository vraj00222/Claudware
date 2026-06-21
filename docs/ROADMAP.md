# ROADMAP

Living list of capabilities — ordered by phase. Items move to PROGRESS when picked up.

## Working today (verified)

### 5 generation engines
- [x] **OpenSCAD** — parametric parts with BOSL2 (gears, threads, bearings, brackets)
- [x] **Blender** — organic models via bpy (live Blender window or headless fallback)
- [x] **Fusion 360** — precision CAD via HTTP MCP (assemblies, multi-part, traceback-fix retry)
- [x] **NVIDIA NIM** — TRELLIS text-to-3D (textured GLB + printable STL)
- [x] **Auto routing** — Claude classifies the prompt and picks the best engine

### Design intelligence
- [x] **Clarify-first** — prompt-specific questions before generating (style, pose, size)
- [x] **Prompt enrichment** — Claude expands prompts for better TRELLIS detail
- [x] **Self-inspect** — Claude vision checks its own output, retries if score < threshold
- [x] **Common sense** — keychains get holes, coins get thickness, text gets spelled right
- [x] **Skills primers** — per-engine expertise injected into Claude prompts (BOSL2, bpy, adsk)

### Print pipeline
- [x] **Print Brain v1** — dimensions, one-piece-vs-split, supports, download STL
- [x] **Print Readiness v2** — 4 checks (watertight, single body, overhangs, walls), score/100
- [x] **Auto-orient** — best of 6 axis-aligned poses, recommended with reason
- [x] **Export formats** — STL + OBJ + 3MF (hand-rolled, no dep) + G-code (real PrusaSlicer)
- [x] **Split for print** — push-fit pegs/sockets, 2/3/4 parts, exploded preview
- [x] **Supports visualization** — semi-transparent pillars toggle in viewport
- [x] **Real slicing** — PrusaSlicer console mode → actual G-code, real time/grams

### Integrations (all key-gated, all have fallbacks)
- [x] **Voice** — Deepgram STT (Web Speech fallback)
- [x] **Model search** — Browserbase live Printables search + curated library
- [x] **Auth + DB + Storage** — InsForge (Google OAuth, per-user projects, model storage)
- [x] **Caching** — Redis semantic cache + vector search + agent memory
- [x] **Token savings** — The Token Company bear-2 compression
- [x] **Clean in Blender** — post-step import→weld/normals/decimate→cleaner STL

### UX
- [x] **Refine in place** — "make it taller" → v2 on the same project
- [x] **Version rail** — v1, v2, … clickable, loads mesh + sets refine base
- [x] **Size edits** — "make it smaller" scales the existing mesh faithfully
- [x] **Reference image upload** — Claude vision describes it → feeds into generation
- [x] **Projects gallery** — /projects with cards, reopen, delete
- [x] **Profile + sign out** — /profile, TopBar account pill
- [x] **Animated landing** — Newsreader/Inter, GSAP animations, 3D printer illustration
- [x] **Transparent failures** — honest chips when an engine/provider fails (never silent)

## Near-term improvements

### Higher-quality output
- [ ] NVIDIA image-to-3D (true likeness from reference photos — hosted endpoint currently 500s)
- [ ] Browserbase web research for obscure named subjects (uni mascots, specific characters)
- [ ] Blender auto-thicken/repair transforms (thin legs, fragile joints)
- [ ] OpenSCAD multi-part assemblies (planetary gears, mechanisms)

### Print readiness
- [ ] Overhang heat-map viewport overlay
- [ ] Real decompose & nest geometry (ant → body/head/legs on one plate)
- [ ] OrcaSlicer / Bambu Studio integration for advanced G-code
- [ ] Material/printer presets (PLA/PETG, Bambu/Ender)

### UX polish
- [ ] Landing showcase — app-made models assembling with color
- [ ] Guided first-run onboarding
- [ ] Cost/time estimate up front
- [ ] Shareable project links
- [ ] Full voice loop (speak → hear back)

### Infrastructure
- [ ] Sentry error/perf telemetry
- [ ] Arize Phoenix agent traces
- [ ] Generate route serialization (prevent concurrent Claude starving)
- [ ] Cross-device mesh reopen (InsForge Storage CORS)

## Sponsors — integration status

| Sponsor | Status | What it powers |
|---------|--------|---------------|
| **Anthropic** | LIVE | The brain — designs, classifies, clarifies, self-inspects, fixes |
| **NVIDIA** | LIVE | NIM TRELLIS text-to-3D — textured organic models |
| **Deepgram** | LIVE | Voice input — speak your idea |
| **Redis** | LIVE | Semantic generation cache + vector search + agent memory |
| **Browserbase** | LIVE | Live model search (Printables) — reuse before regenerate |
| **The Token Company** | LIVE | Prompt compression — ~1.2x token savings |
| **InsForge** | LIVE | Auth (Google OAuth) + database + file storage |
| Sentry | NEXT | Error/perf telemetry (key-gated, no-op fallback ready) |
| Arize Phoenix | NEXT | Agent generation traces (OSS, offline-ok) |

## Architecture quick-ref

```
User prompt → Classify → Clarify → Engine → Generate → Validate → Estimate → PrintPlan → Storage → Summary
                                      ↓
                            ┌─────────┼─────────┐─────────┐
                          OpenSCAD  Blender   Fusion    NVIDIA
                          (BOSL2)   (bpy)     (adsk)    (TRELLIS)
```

See [ARCHITECTURE.md](../ARCHITECTURE.md) for the full contract and engine patterns.
