# DESIGN — "Hardware Paper" · source of truth for the UI.
# READ-ONLY to the agent unless an instruction literally says "change the design".
# Live source: frontend/*.dc.html (Claude Design export) + frontend/support.js.
#   - frontend/Claude Hardware.dc.html       → playable workspace (auto-plays once; replay via demo conductor)
#   - frontend/Hardware States Board.dc.html  → the system/state reference ("Hardware Paper")
# (The LIGHT landing-page system "Trunk Minimal CI" lives at docs/landing-trunk-design.md, used for PROMPT 2 only.)

## What shipped (and what changed from the playbook plan)
The Claude Design export is a WARM LIGHT system — "Hardware Paper" — not the
dark inversion the playbook sketched. The build reproduces THIS. Soul unchanged:
monochrome base, ONE semantic accent (terracotta), flat depth, thin borders, pill controls,
layer-line motif.
- Palette: warm paper light (#E4DED2 canvas), not dark (#08090B).
- Sans typeface: **Bricolage Grotesque** (bold, characterful; base weight 500, tight tracking) —
  changed from Space Grotesk per Vraj ("too normal/AI"). Mono: JetBrains Mono (unchanged).

## Product changes since the export (authorized by Vraj — "change the design")
- No auto-demo: the app boots to an empty "describe anything" state (hint + example chips); the
  user types/picks a prompt and watches the model build step-by-step. No repeating phone-stand loop.
- Right panel = agent activity feed + Print Center only. The **Design Notes** panel was removed.
- Print Center: no "PRINT CENTER" tagline; the stat line (grams/time/layers) is **dynamic** from the
  generated model (not the old static "14g PLA · 1h 23m · 847 layers").
- Versioning: subtle, muted; no "+" — versions appear only as real changes are made. Refine-in-place
  appends versions (v1, v2, …) in the VersionRail; clicking one loads that mesh + sets the refine base.
- Empty viewport shows just the print bed (no fixture mesh).
- ENGINE PICKER (per Vraj, "change the design" → extended to 4 engines + a combo): the Agent
  Activity header has an explicit, always-visible selector **[ Auto · OpenSCAD · Blender · Fusion · NVIDIA ]**
  plus a **"Clean in Blender"** post-step checkbox, in the existing mono-pill style (the header is now a
  two-row stack: AGENT ACTIVITY label, then the wrapping pill row + checkbox). Auto (default) routes per
  prompt; OpenSCAD/Fusion = precise parametric, Blender = live procedural build, NVIDIA = organic/figures
  (textured). The selector drives its OWN `engineSel` state (decoupled from `mode`, which is now only the
  viewport/clarify aesthetic). The figure/hybrid reference-image chip is the 📎 upload (Claude vision).
- GREEN → TERRACOTTA (per Vraj, "change all green with the landing Start-designing button color"): the ONE
  semantic accent is now the landing terracotta **#cc785c** (hover #a9583e). All chips, the forming/loader
  scanlines, print progress, active dots, and the filled CTA recolored; button text on the accent is now
  **white** (#fff, was near-black ink). The Hardware Paper `C` token's `accent`/`accentWeak` now hold the
  terracotta, so anything bound to the token recolors automatically.
- NEW UI = LANDING STYLE (per Vraj): all new surfaces (starting with the **Print Plan** panel) use the
  landing-page system — cream #faf9f5 / surfaces #f5f0e8·#f3efe6 / ink #141413 / terracotta accent /
  **Newsreader** headings + **Inter** body — via `LAND`/`LAND_FONT` tokens (separate from `C`).
- PRINT-READINESS v2 PANEL (per Vraj, "change the design"): a **Print readiness** panel below
  Print Plan in the right rail (landing style, `LAND`/`LAND_FONT`). Until used it shows a **"Prepare for
  print"** button (a deliberate per-version action — NOT live, so it doesn't fight the no-live-overlay rule);
  pressing it runs the diagnose→orient→export pipeline (chips stream into the feed). It then shows a
  **readiness score /100 + grade**, the **4 checks** (watertight · single-body · overhangs · wall thickness,
  colour-dotted ok/warn/fail), the recommended **orientation + why**, the **decompose** note (split/parts),
  a plain **narrative**, and **format downloads (STL · OBJ · 3MF for the Bambu A1)**, plus a **Re-check**.
  Fusion **assembly** builds also list their **printable parts** with per-part STL downloads. Saved per
  version (restored on reopen / version-switch). Internal scroll (capped height) so the rail never overflows.
- ACCOUNT (PROGRESS NEXT #2): the TopBar gains an **account pill** on the far right (avatar/initial +
  first name) — shown only when signed in — that links to a new **/profile** page. /profile = account card
  (avatar · name · email) + **Sign out** (→ `/` landing) + the user's projects grid. Built in Hardware
  Paper (`C`/`FONT`), reusing the /projects card pattern. The TopBar addition is styled like the existing
  Projects pill (no restyle of the bar).
- MODEL SEARCH (Browserbase, sponsor #6 — "reuse before regenerate"): the studio empty state gains a
  **🔍 Find an existing model** button (+ an always-available "find existing →" link under the input).
  Results show in a **ModelSearchPanel overlay** — a backdrop + centered card of result tiles (thumb,
  title, author, **license**, source chip) each with **Use this** (imports the STL into the studio) and a
  source link (↗), plus a **✨ Design my own instead** escape. Built in Hardware Paper (`C`/`FONT`). A subtle
  **smart-hint bar** ("Ready-made versions may already exist — Find them →") appears above the viewport for
  common objects. Imported models carry an attribution line (author · license · source).
 - ALSO: login-walled results now show **✨ Make with AI** (regenerate a printable version) next
    to the source ↗ link, instead of a dead-end "View on {site}".
- MESHGEN TEXTURED PREVIEW (per Vraj "all skin texture"): the **Viewport** now renders a **textured GLB** when a
  meshgen result provides one (GLTFLoader, PBR materials, scale-normalized + sat on the bed) — so you SEE scales /
  skin color. STL stays the print artifact (Print Brain + Download unchanged). Orbit-only for GLB (the forming
  sweep + move-gizmo stay on the STL path for v1). The `mesh` event carries `glbUrl`/`textured`.
- CLARIFY-FIRST card (per Vraj "ask what they want — feathers/scales/reference/size"): before a FRESH figure/part
  generates, a **ClarifyCard** appears in the center column (landing `LAND`/`LAND_FONT` style) — chip questions
  (figures: surface scales/smooth/feathered/furry · pose; every prompt: a size question) with free-text + **Skip**.
  Answers fold into the generation prompt; the size answer scales the model to real-world mm.

## NEVER
shadows · gradients · glassmorphism · decorative glow · uppercase tracking ·
spinners (use the PrinterLoader) · >1 accent-FILLED button per screen ·
the accent used decoratively (the terracotta accent is semantic ONLY).

## Color tokens (from the States Board)
canvas       #E4DED2   app background / viewport backdrop
surface      #FBFAF6   panels, top/footer bars, cards
inset        #F0ECE3   inputs, chips, wells inside surfaces
border       #C9C3B6   default 1px borders on controls
border-sub   #DCD7CC   subtle structural dividers between panels
text         #232019   primary ink
text-2nd     #6E6A60   secondary text
faint        #A6A095   labels, metadata, placeholders
accent       #cc785c   semantic terracotta (landing button) — working / verified / print-ready / the ONE filled CTA
accent-weak  #a9583e   accent text on light (✓ verified rows, "done" glyphs)
warn         #B26B07   amber — manufacturability warnings ONLY
error        #C0271A   destructive / hard failure (rare)

Viewport object tones: objFill #E6E1D6 · objBack #D6CFC2 · layer #B9B2A4
Accent chip:  bg #F6ECE6 · border #E6CFC2 · glow rgba(204,120,92,*) (= #cc785c)
Amber episode: gutter #B26B07 / #B88416 · border #E6D3A8 · bg #FBF1DE · tint rgba(178,107,7,.08)
Conversation bubble (user): #DCD7CC on surface.

## Typography
SANS = Bricolage Grotesque → human intent (prompts, headlines, body, UI labels).
MONO = JetBrains Mono → machine work (agent feed, tokens, dims, status, timers).
Apply the grammar ruthlessly: if a human said it → sans; if the machine did it → mono.
Scale (observed): display 34px/700/-1px · headline ~24px/500/-.5px ·
body 15px/300 · UI label 12–13px/500 · mono 10–14px/400–600.

## The layer line (signature motif — the ONE flourish)
Prints build from stacked horizontal layers, so accumulating 1px horizontal
lines ARE the brand. Use them for: dividers, progress fills, the active-stage
tracker, the forming animation, and print progress (terracotta fill rising from the
base). Everything else stays disciplined.

## PrinterLoader (replaces every spinner)
Mono, terracotta, width-stable, cycled ~180ms. Nozzle ▼ sweeps the gantry; finished
rows join the solid stack so the part visibly "prints" over a long wait. Bind a
blinking-cursor status line to the live agent step. Exact ASCII frames live in
both .dc.html files (the PRINTER array). Small inline variant: ▼▁▂▃▄▅.

## Five hero moments (playable in frontend/Claude Hardware.dc.html)
1. Boot — machine self-test types on; the empty cube draws in layer lines. Skippable.
2. Forming — object materializes bottom-up in layer slices; a terracotta scanline sweeps up; settles with a small scale pop.
3. Inspection — a reticle sweeps; an AMBER marker pins the exact flaw with a hairline leader to the offending feed row. (The soul of the demo.)
4. Studio — the figure explodes along part axes; ghost-terracotta ball-socket connectors slide into the cut faces and glow; snap back; seams pulse terracotta once, then go solid.
5. Send to print — live job: layer-line progress bar, ASCII printer, camera feed; ONE terracotta button.

## Layout
54px top bar (logo · 5-stage tracker: Describe·Design·Validate·Slice·Print · printer status)
over a 46px demo-harness footer. Three panels between:
- LEFT 300px: conversation + mic / ref-image / mode chip (parametric ⚙ / figure ✦ / hybrid ⚙+✦)
- CENTER flex: viewport (canvas/r3f) + 74px version rail
- RIGHT 340px: agent activity feed (header has the [Auto·OpenSCAD·Blender·Fusion·NVIDIA] engine picker + Clean-in-Blender) + print center

## Do / Don't
- Do keep the base monochrome warm-paper; the terracotta accent ONLY semantic, amber ONLY manufacturability.
- Do use the layer line for hierarchy instead of shadows.
- Do keep controls pill-shaped, borders thin, depth flat.
- Don't dark-invert it, reintroduce Inter, or add gradients/shadows/spinners.
- Don't use >1 filled accent button per screen.
- Don't modify frontend/ or this file unless the instruction says "change the design".
