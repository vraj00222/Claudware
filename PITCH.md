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

## TIPS FOR DELIVERY

1. **First 10 seconds decide everything.** Hit the "600 hours" stat hard. Let it land. Pause after "We killed that learning curve entirely."
2. **Show, don't tell.** The model building step-by-step IS the wow moment. Let the viewport do the talking for 3–4 seconds while it builds.
3. **Old generations in the background.** While the new prompt generates, have the project gallery or version rail visible showing breadth — mechanical parts, figurines, organic shapes. Proves this isn't a one-trick demo.
4. **The self-inspect moment is your differentiator.** Every other tool generates and hopes. Claude checks its own work. Say it clearly: "No human in the loop."
5. **End on the tagline.** "Describe it. We make it printable." Full stop. Don't add anything after it.
6. **Practice the engine switch.** The picker click should feel effortless — rehearse the mouse path.
7. **Don't rush the print pipeline.** The readiness score, the 4 checks, the real G-code — that's what separates this from a toy. Give it 20 seconds.
