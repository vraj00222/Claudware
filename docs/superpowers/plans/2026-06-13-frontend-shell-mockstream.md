# Frontend Shell on mockStream — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Claude Hardware studio UI as a Next.js app that auto-plays the demo end-to-end — driven by `mockStream` `AgentEvent`s through a pure reducer, rendered by pixel-faithful pure components, with a real STL forming live in an r3f viewport (orbit + move gizmo + forming/inspect hero animations).

**Architecture:** `mockStream` emits the DEMO.md sequence as `AgentEvent`s on a timer → a pure `reduce(vm, e)` folds them into a `ViewModel` (phase, feed rows, stages, marker, print) → pure presentational components render the ViewModel → an r3f `Viewport` animates a real mesh from `phase`/`marker` props. The UI never knows whether it consumes `mockStream` or the future real `agentStream` — both speak `AgentEvent`. This is the "demoable ~h2" milestone (PROGRESS NEXT #2–4); the real OpenSCAD/agent backend (NEXT #5–6) swaps in behind the same `AgentEvent` interface in a later plan.

**Tech Stack:** Next.js (App Router) + TypeScript + Tailwind v4 · three / @react-three/fiber / @react-three/drei / three-stdlib · @fontsource (self-hosted Space Grotesk + JetBrains Mono) · vitest + @testing-library/react (jsdom) · Playwright MCP (already installed) for hero-state verification.

---

## Scope & boundaries

**In scope (this plan):** the full parametric/functional hero path — boot → empty → forming → inspecting → fix → complete (slice) → printing — driven by `mockStream`, on the real `phone_stand.stl` fixture, reproducing `frontend/Claude Hardware.dc.html` 1:1 in layout, tokens, and the forming/inspect/print hero moments.

**Deferred to later plans (do NOT build here):**
- Real OpenSCAD/agent backend + `agentStream` (Plan 02 — parametric engine + agent loop).
- The **figure/organic** generation and the **studio explode** of a multi-part figure (SHOULD-phase, Blender engine). In this plan the `figure`/`studio` conductor buttons switch the **feed** to the figure script and show the studio badge, but the viewport stays on the parametric mesh. Full figure mesh + exploded connectors land with the organic engine.
- Layer-line **texture** on the 3D mesh surface (polish). This plan ships the forming **reveal + green scanline** hero motion; the per-layer surface striping is a later polish pass.

**Frozen / read-only (do NOT modify):** `frontend/**`, `DESIGN.md`, `ARCHITECTURE.md`, `DECISIONS.md`, the `docs/` specs. `frontend/Claude Hardware.dc.html` is the visual source of truth — port FROM it, never edit it.

**Translation rules when porting `.dc.html` markup to TSX** (used throughout Phase C):
- `<sc-for list="{{ xs }}" as="x">…{{ x.y }}…</sc-for>` → `{xs.map((x, i) => (…{x.y}…))}` with `key={i}`.
- `<sc-if value="{{ cond }}">…</sc-if>` → `{cond && (<>…</>)}`.
- `style="a:b;c:d;"` → `style={{ a: "b", c: "d" }}` (camelCase keys). Keep the **exact** hex/px values; pull colors from `C` in `src/design/tokens.ts`.
- `onClick="{{ fn }}"` → `onClick={fn}`; `ref="{{ r }}"` → `ref={r}`.
- Inline-style port is intentional — it is the most faithful, lowest-risk way to match the export. Tailwind handles only the base reset and font wiring.

---

## File structure

Created by this plan (all under repo root `/Users/vrajpatel/Developer/hard`):

```
package.json, tsconfig.json, next.config.ts, next-env.d.ts,     # scaffold (Task 1)
postcss.config.mjs, eslint.config.mjs, vitest.config.ts
public/fixtures/phone_stand.stl                                  # fixture mesh (Task 12)
src/app/layout.tsx          # fonts + html shell                 (Task 2)
src/app/globals.css         # reset, @font-face via fontsource, keyframes, @theme tokens (Task 2)
src/app/page.tsx            # mounts <Scaler><Studio/></Scaler>  (Task 7, 16)
src/design/tokens.ts        # C palette + FONT (single source of truth)  (Task 3)
src/design/Scaler.tsx       # 1440x884 fit-to-window wrapper      (Task 7)
src/test/setup.ts           # jest-dom matchers                   (Task 3)
src/lib/agentEvent.ts       # the AgentEvent union (UI<->backend contract)  (Task 4)
src/lib/mockStream.ts       # SCRIPTs + playScript timer          (Task 5)
src/lib/viewModel.ts        # Phase, ViewModel, reduce(), deriveStages()    (Task 6)
src/lib/__tests__/mockStream.test.ts                              (Task 5)
src/lib/__tests__/viewModel.test.ts                              (Task 6)
src/components/TopBar.tsx          # logo + StageTracker + printer status  (Task 8)
src/components/StageTracker.tsx    # 5-stage tracker             (Task 8)
src/components/ConversationPanel.tsx  # left 300px               (Task 9)
src/components/AgentFeed.tsx       # right: activity feed         (Task 10)
src/components/DesignNotes.tsx     # right: design notes          (Task 10)
src/components/PrintCenter.tsx     # right: print center          (Task 10)
src/components/VersionRail.tsx     # center: 74px version rail    (Task 11)
src/components/DemoHarness.tsx     # footer conductor             (Task 11)
src/components/Studio.tsx          # container: stream->reducer->panels  (Task 16)
src/viewport/Viewport.tsx          # r3f canvas + mesh + controls + anims  (Task 13-15)
```

Responsibility split: `src/lib/*` is pure & framework-free (TDD'd). `src/components/*` are pure presentational (props in, JSX out — never import from `src/lib` reducers except types). `src/viewport/*` owns all continuous animation (useFrame). `Studio.tsx` is the only stateful wiring point. This matches ARCHITECTURE.md "UI components are pure; UI never imports backend."

---

## Task 0: Initialize git repository

**Files:** none created; initializes VCS so the plan's commits work.

- [ ] **Step 1: Check whether a repo already exists**

Run: `git -C /Users/vrajpatel/Developer/hard rev-parse --is-inside-work-tree 2>/dev/null || echo "NO REPO"`
Expected: prints `NO REPO` (this directory is not yet a git repo).

- [ ] **Step 2: Initialize and make the baseline commit**

```bash
cd /Users/vrajpatel/Developer/hard
git init
git add -A
git commit -m "chore: baseline — docs, design export, fixtures before app scaffold"
```

Expected: a first commit containing the existing docs/`frontend/`/`tools/` (note `.gitignore` already excludes `node_modules`, `.next`, `*.stl`, `tools/_scratch/`, `.env`).

---

## Task 1: Scaffold the Next.js app into the existing repo

`create-next-app` refuses to run in a directory containing files it doesn't recognize (we have `CLAUDE.md`, `frontend/`, `tools/`, etc.), so scaffold into a temp dir and move the generated files to root.

**Files:** Create `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `src/app/{layout.tsx,page.tsx,globals.css}`, `public/*`.

- [ ] **Step 1: Generate into a temp directory (non-interactive)**

```bash
cd /Users/vrajpatel/Developer/hard
npx create-next-app@latest .scaffold \
  --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --turbopack --use-npm --yes
```

Expected: completes and prints "Success! Created .scaffold". (Tailwind v4 + Turbopack are the current defaults.)

- [ ] **Step 2: Move the generated app to repo root, keeping our docs/config**

```bash
cd /Users/vrajpatel/Developer/hard
mv .scaffold/package.json .scaffold/package-lock.json .scaffold/tsconfig.json \
   .scaffold/next.config.ts .scaffold/next-env.d.ts \
   .scaffold/postcss.config.mjs .scaffold/eslint.config.mjs .
mv .scaffold/src .
mv .scaffold/public .
rm -rf .scaffold
```

Expected: `src/app/page.tsx` and `package.json` now exist at root; `.scaffold` is gone. (We intentionally do NOT move `.scaffold/.gitignore` or its `README.md` — our `.gitignore` already covers `node_modules/`, `.next/`.)

- [ ] **Step 3: Verify the dev server boots**

```bash
cd /Users/vrajpatel/Developer/hard
npm run build
```

Expected: build succeeds (compiles the default starter page). This confirms the scaffold landed correctly. (We use `build` rather than starting a long-running `dev` here so the step terminates.)

- [ ] **Step 4: Commit**

```bash
cd /Users/vrajpatel/Developer/hard
git add -A
git commit -m "chore: scaffold Next.js (TS, Tailwind v4, app router, src dir)"
```

---

## Task 2: Self-host fonts + global stylesheet (reset, keyframes, tokens)

The demo must run offline (no Google Fonts CDN). Use `@fontsource` packages, which bundle the `.woff2` and register the exact family names `Space Grotesk` / `JetBrains Mono`. Port the keyframes verbatim from `frontend/Claude Hardware.dc.html` lines 17–26.

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css` (replace its contents)
- Modify: `package.json` (adds fontsource deps via install)

- [ ] **Step 1: Install the self-hosted fonts**

```bash
cd /Users/vrajpatel/Developer/hard
npm i @fontsource/space-grotesk @fontsource/jetbrains-mono
```

Expected: both packages install (they ship `.woff2` + per-weight CSS).

- [ ] **Step 2: Replace `src/app/globals.css`**

```css
@import "tailwindcss";

/* Self-hosted fonts (offline-safe; registers families "Space Grotesk" / "JetBrains Mono") */
@import "@fontsource/space-grotesk/300.css";
@import "@fontsource/space-grotesk/400.css";
@import "@fontsource/space-grotesk/500.css";
@import "@fontsource/space-grotesk/600.css";
@import "@fontsource/space-grotesk/700.css";
@import "@fontsource/jetbrains-mono/400.css";
@import "@fontsource/jetbrains-mono/500.css";
@import "@fontsource/jetbrains-mono/600.css";

/* Hardware Paper tokens (mirror of src/design/tokens.ts) */
@theme {
  --color-canvas: #E4DED2;
  --color-surface: #FBFAF6;
  --color-inset: #F0ECE3;
  --color-border: #C9C3B6;
  --color-border-sub: #DCD7CC;
  --color-ink: #232019;
  --color-ink-2: #6E6A60;
  --color-faint: #A6A095;
  --color-accent: #00A44A;
  --color-accent-weak: #1F8F50;
  --color-warn: #B26B07;
  --color-error: #C0271A;
  --font-sans: "Space Grotesk", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}

* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0; background: #E4DED2;
  font-family: "Space Grotesk", system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Hero animation keyframes — ported verbatim from frontend/Claude Hardware.dc.html */
@keyframes hwblink { 0%,48%{opacity:1} 49%,100%{opacity:0} }
@keyframes hwsettle { 0%{transform:scale(.975)} 55%{transform:scale(1.012)} 100%{transform:scale(1)} }
@keyframes hwfeedin { from{opacity:0;transform:translateY(3px)} to{opacity:1;transform:none} }
@keyframes hwlayerfill { from{background-position:0 0} to{background-position:0 -6px} }
@keyframes hwripple { 0%{transform:scale(1);opacity:.5} 100%{transform:scale(1.9);opacity:0} }
@keyframes hwwave { 0%,100%{transform:scaleY(.3)} 50%{transform:scaleY(1)} }
@keyframes hwpulsedot { 0%,100%{opacity:1} 50%{opacity:.35} }

::-webkit-scrollbar { width: 7px; height: 7px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #C9C3B6; border-radius: 4px; }
```

- [ ] **Step 3: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claude Hardware",
  description: "Describe anything — get a print-ready file for your printer.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 4: Verify it still builds**

Run: `npm run build`
Expected: build succeeds with the new globals + fonts imported.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: self-hosted fonts + Hardware Paper globals (tokens, keyframes, reset)"
```

---

## Task 3: Design tokens module + vitest harness

**Files:**
- Create: `src/design/tokens.ts`
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Modify: `package.json` (test scripts + dev deps)

- [ ] **Step 1: Create `src/design/tokens.ts`** (single source of truth; matches DESIGN.md color tokens)

```ts
/** Hardware Paper palette — the warm LIGHT system. Source of truth for inline styles, canvas, and r3f. */
export const C = {
  canvas: "#E4DED2",
  surface: "#FBFAF6",
  inset: "#F0ECE3",
  border: "#C9C3B6",
  borderSub: "#DCD7CC",
  text: "#232019",
  text2: "#6E6A60",
  faint: "#A6A095",
  accent: "#00A44A",
  accentWeak: "#1F8F50",
  warn: "#B26B07",
  warn2: "#B88416",
  error: "#C0271A",
  // viewport object tones
  objFill: "#E6E1D6",
  objBack: "#D6CFC2",
  layer: "#B9B2A4",
  viewportBg: "#ECE7DC",
  // green chip
  chipBg: "#E6F1EA",
  chipBorder: "#BBDFC8",
  // amber episode
  amberGutterA: "#B26B07",
  amberGutterB: "#B88416",
  amberBg: "rgba(178,107,7,0.08)",
  // misc
  userBubble: "#DCD7CC",
  printBtnInk: "#06120B",
} as const;

export const FONT = {
  sans: "'Space Grotesk', system-ui, sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;
```

- [ ] **Step 2: Install test deps**

```bash
cd /Users/vrajpatel/Developer/hard
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/node
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

- [ ] **Step 4: Create `src/test/setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 5: Add test scripts to `package.json`**

In the `"scripts"` object, add:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 6: Sanity-check the runner with a trivial token test**

Create `src/design/__tests__/tokens.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { C } from "@/design/tokens";

describe("tokens", () => {
  it("exposes the semantic green accent", () => {
    expect(C.accent).toBe("#00A44A");
  });
});
```

Run: `npm test`
Expected: 1 test passes. (Confirms vitest + `@` alias + jsdom wiring all work.)

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "test: vitest harness + design tokens module"
```

---

## Task 4: The `AgentEvent` contract

The single interface UI and backend share (verbatim from ARCHITECTURE.md). This is the seam the real backend swaps in behind.

**Files:**
- Create: `src/lib/agentEvent.ts`
- Test: `src/lib/__tests__/agentEvent.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/agentEvent.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isToolEvent, type AgentEvent } from "@/lib/agentEvent";

describe("agentEvent", () => {
  it("narrows tool events", () => {
    const e: AgentEvent = { t: "00:03", kind: "tool", name: "write_openscad", status: "done", detail: "42 lines" };
    expect(isToolEvent(e)).toBe(true);
    if (isToolEvent(e)) expect(e.name).toBe("write_openscad");
  });
  it("rejects non-tool events", () => {
    const e: AgentEvent = { t: "00:01", kind: "plan", text: "do the thing" };
    expect(isToolEvent(e)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- agentEvent`
Expected: FAIL — cannot resolve `@/lib/agentEvent`.

- [ ] **Step 3: Create `src/lib/agentEvent.ts`**

```ts
export type ToolName =
  | "write_openscad" | "write_blender" | "generate_mesh" | "repair_mesh" | "add_joints"
  | "render_preview" | "inspect_render" | "validate" | "slice" | "export" | "send_to_printer";

export type ToolStatus = "running" | "done" | "warn" | "error";

export type AgentEvent =
  | { t: string; kind: "plan" | "fix"; text: string }
  | { t: string; kind: "tool"; name: ToolName; status: ToolStatus; detail: string }
  | { t: string; kind: "inspect"; ok: boolean; marker?: { x: number; y: number; z: number; note: string } }
  | { t: string; kind: "print"; printer: string; layer: number; totalLayers: number; etaMin: number }
  | { t: string; kind: "summary"; text: string };

export type ToolEvent = Extract<AgentEvent, { kind: "tool" }>;
export type InspectEvent = Extract<AgentEvent, { kind: "inspect" }>;
export type PrintEvent = Extract<AgentEvent, { kind: "print" }>;

export const isToolEvent = (e: AgentEvent): e is ToolEvent => e.kind === "tool";
export const isInspectEvent = (e: AgentEvent): e is InspectEvent => e.kind === "inspect";
export const isPrintEvent = (e: AgentEvent): e is PrintEvent => e.kind === "print";
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- agentEvent`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: AgentEvent contract (UI<->backend seam)"
```

---

## Task 5: `mockStream` — scripts + timed player

Encodes the DEMO.md sequence as `AgentEvent`s. `playScript` emits them on a timer via a callback and returns a cancel handle.

**Files:**
- Create: `src/lib/mockStream.ts`
- Test: `src/lib/__tests__/mockStream.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/mockStream.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PARAMETRIC_SCRIPT, FIGURE_SCRIPT, playScript } from "@/lib/mockStream";

describe("mockStream scripts", () => {
  it("parametric script is the inspect→fix→clean→validate→slice beat in order", () => {
    const kinds = PARAMETRIC_SCRIPT.map((s) => s.event.kind);
    // first event plans, last visible feed event is slice (a tool)
    expect(kinds[0]).toBe("plan");
    const names = PARAMETRIC_SCRIPT.filter((s) => s.event.kind === "tool").map(
      (s) => (s.event as any).name,
    );
    expect(names).toEqual([
      "write_openscad", "render_preview", "inspect_render", "render_preview", "validate", "slice",
    ]);
    // it carries an inspect(false) and an inspect(true)
    const inspects = PARAMETRIC_SCRIPT.filter((s) => s.event.kind === "inspect").map(
      (s) => (s.event as any).ok,
    );
    expect(inspects).toEqual([false, true]);
  });

  it("figure script begins with a plan and generates a mesh", () => {
    expect(FIGURE_SCRIPT[0].event.kind).toBe("plan");
    const names = FIGURE_SCRIPT.filter((s) => s.event.kind === "tool").map((s) => (s.event as any).name);
    expect(names).toContain("generate_mesh");
    expect(names).toContain("add_joints");
  });
});

describe("playScript", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("emits events in order honoring cumulative delays", () => {
    const seen: string[] = [];
    const script = [
      { delayMs: 100, event: { t: "00:01", kind: "plan", text: "a" } as const },
      { delayMs: 200, event: { t: "00:02", kind: "fix", text: "b" } as const },
    ];
    playScript(script, (e) => seen.push((e as any).text));
    expect(seen).toEqual([]);
    vi.advanceTimersByTime(100);
    expect(seen).toEqual(["a"]);
    vi.advanceTimersByTime(200);
    expect(seen).toEqual(["a", "b"]);
  });

  it("cancel() stops further emissions", () => {
    const seen: string[] = [];
    const script = [
      { delayMs: 100, event: { t: "00:01", kind: "plan", text: "a" } as const },
      { delayMs: 100, event: { t: "00:02", kind: "fix", text: "b" } as const },
    ];
    const p = playScript(script, (e) => seen.push((e as any).text));
    vi.advanceTimersByTime(100);
    p.cancel();
    vi.advanceTimersByTime(1000);
    expect(seen).toEqual(["a"]);
  });

  it("fromIndex skips earlier steps", () => {
    const seen: string[] = [];
    const script = [
      { delayMs: 50, event: { t: "00:01", kind: "plan", text: "a" } as const },
      { delayMs: 50, event: { t: "00:02", kind: "fix", text: "b" } as const },
    ];
    playScript(script, (e) => seen.push((e as any).text), 1);
    vi.advanceTimersByTime(50);
    expect(seen).toEqual(["b"]);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- mockStream`
Expected: FAIL — cannot resolve `@/lib/mockStream`.

- [ ] **Step 3: Create `src/lib/mockStream.ts`**

```ts
import type { AgentEvent } from "./agentEvent";

export interface ScriptStep {
  /** ms to wait AFTER the previous step before emitting this one */
  delayMs: number;
  event: AgentEvent;
}

/**
 * Beat 1 — parametric phone stand. Mirrors frontend feedData('parametric')
 * plus the inspect events that drive the amber marker. Timestamps match the export.
 */
export const PARAMETRIC_SCRIPT: ScriptStep[] = [
  { delayMs: 600, event: { t: "00:01", kind: "plan", text: "base plate → 15° riser → cable slot" } },
  { delayMs: 1300, event: { t: "00:03", kind: "tool", name: "write_openscad", status: "done", detail: "phone_stand.scad · 42 lines" } },
  { delayMs: 1400, event: { t: "00:06", kind: "tool", name: "render_preview", status: "done", detail: "4 angles · 1.2s" } },
  { delayMs: 1200, event: { t: "00:08", kind: "tool", name: "inspect_render", status: "warn", detail: "cable slot intersects riser wall" } },
  { delayMs: 150, event: { t: "00:08", kind: "inspect", ok: false, marker: { x: -46, y: 118, z: 0, note: "wall 0.9mm" } } },
  { delayMs: 1200, event: { t: "00:09", kind: "fix", text: "shifting slot 4mm left, re-rendering" } },
  { delayMs: 1200, event: { t: "00:11", kind: "tool", name: "render_preview", status: "done", detail: "clean" } },
  { delayMs: 150, event: { t: "00:11", kind: "inspect", ok: true } },
  { delayMs: 900, event: { t: "00:13", kind: "tool", name: "validate", status: "done", detail: "printable · no supports needed" } },
  { delayMs: 700, event: { t: "00:14", kind: "tool", name: "slice", status: "running", detail: "847 layers · 0.2mm" } },
];

/**
 * Beat 2 — figure (feed only in this plan; viewport stays parametric).
 * Mirrors frontend feedData('figure').
 */
export const FIGURE_SCRIPT: ScriptStep[] = [
  { delayMs: 600, event: { t: "00:01", kind: "plan", text: "figure from reference · est. 38mm tall" } },
  { delayMs: 900, event: { t: "00:04", kind: "tool", name: "generate_mesh", status: "running", detail: "image → mesh" } },
  { delayMs: 2400, event: { t: "00:52", kind: "tool", name: "generate_mesh", status: "done", detail: "142k tris · watertight" } },
  { delayMs: 900, event: { t: "00:55", kind: "tool", name: "repair_mesh", status: "done", detail: "decimated 80k · manifold ok" } },
  { delayMs: 900, event: { t: "00:58", kind: "tool", name: "add_joints", status: "running", detail: "shoulders · ball sockets Ø6mm" } },
  { delayMs: 1200, event: { t: "01:03", kind: "tool", name: "inspect_render", status: "warn", detail: "left socket wall 0.9mm — too thin" } },
  { delayMs: 150, event: { t: "01:03", kind: "inspect", ok: false, marker: { x: -30, y: -44, z: 0, note: "wall 0.9mm" } } },
  { delayMs: 900, event: { t: "01:04", kind: "fix", text: "socket offset +0.4mm, re-cutting" } },
  { delayMs: 1100, event: { t: "01:07", kind: "tool", name: "validate", status: "done", detail: "printable · supports: arms only" } },
  { delayMs: 150, event: { t: "01:07", kind: "inspect", ok: true } },
];

export interface Player {
  cancel(): void;
}

/**
 * Emit each step's event after its cumulative delay. `onEvent` receives the event
 * and its index in the script. Returns a handle whose cancel() stops pending timers.
 */
export function playScript(
  steps: ScriptStep[],
  onEvent: (event: AgentEvent, index: number) => void,
  fromIndex = 0,
): Player {
  const timers: ReturnType<typeof setTimeout>[] = [];
  let cancelled = false;
  let acc = 0;
  for (let i = fromIndex; i < steps.length; i++) {
    acc += steps[i].delayMs;
    const idx = i;
    timers.push(
      setTimeout(() => {
        if (!cancelled) onEvent(steps[idx].event, idx);
      }, acc),
    );
  }
  return {
    cancel() {
      cancelled = true;
      timers.forEach(clearTimeout);
    },
  };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- mockStream`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: mockStream scripts (parametric + figure) and timed player"
```

---

## Task 6: `viewModel` reducer (events → renderable state)

Pure fold from `AgentEvent`s to a `ViewModel`. Derives phase, feed rows (with the amber inspect→fix→clean episode band), stage tracker, marker, and print state.

**Files:**
- Create: `src/lib/viewModel.ts`
- Test: `src/lib/__tests__/viewModel.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/viewModel.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { initialViewModel, reduce, reduceAll, deriveStages } from "@/lib/viewModel";
import { PARAMETRIC_SCRIPT } from "@/lib/mockStream";

const events = PARAMETRIC_SCRIPT.map((s) => s.event);

describe("viewModel reduce", () => {
  it("starts at boot with no rows", () => {
    expect(initialViewModel.phase).toBe("boot");
    expect(initialViewModel.rows).toHaveLength(0);
  });

  it("plan moves to forming and adds a plan row", () => {
    const vm = reduce(initialViewModel, events[0]);
    expect(vm.phase).toBe("forming");
    expect(vm.rows[0]).toMatchObject({ kind: "plan", label: "plan", glyph: "◆" });
  });

  it("inspect(false) enters inspecting and sets the marker", () => {
    const vm = reduceAll(initialViewModel, events.slice(0, 5));
    expect(vm.phase).toBe("inspecting");
    expect(vm.marker).toMatchObject({ note: "wall 0.9mm" });
  });

  it("inspect(true) clears marker and returns to complete", () => {
    const vm = reduceAll(initialViewModel, events.slice(0, 8));
    expect(vm.phase).toBe("complete");
    expect(vm.marker).toBeNull();
  });

  it("renders the amber episode band: inspect=a, fix=b, clean render=c", () => {
    const vm = reduceAll(initialViewModel, events);
    // feed rows are: plan, write_openscad, render_preview, inspect_render(warn),
    //                fix, render_preview(clean), validate, slice
    expect(vm.rows[3]).toMatchObject({ kind: "warn", episode: "a" });
    expect(vm.rows[4]).toMatchObject({ kind: "fix", episode: "b" });
    expect(vm.rows[5]).toMatchObject({ kind: "ok", episode: "c" });
    // inspect events do NOT add feed rows
    expect(vm.rows).toHaveLength(8);
  });

  it("slice(running) rests at complete with the Slice stage active", () => {
    const vm = reduceAll(initialViewModel, events);
    expect(vm.phase).toBe("complete");
    expect(deriveStages(vm.phase)).toEqual(["done", "done", "done", "active", "pend"]);
  });

  it("print events drive printing phase + print state", () => {
    let vm = reduceAll(initialViewModel, events);
    vm = reduce(vm, { t: "00:20", kind: "print", printer: "BAMBU-A1", layer: 96, totalLayers: 847, etaMin: 70 });
    expect(vm.phase).toBe("printing");
    expect(vm.print).toMatchObject({ layer: 96, totalLayers: 847 });
    expect(deriveStages(vm.phase)).toEqual(["done", "done", "done", "done", "active"]);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `npm test -- viewModel`
Expected: FAIL — cannot resolve `@/lib/viewModel`.

- [ ] **Step 3: Create `src/lib/viewModel.ts`**

```ts
import type { AgentEvent } from "./agentEvent";

export type Phase = "boot" | "empty" | "forming" | "inspecting" | "complete" | "studio" | "printing";
export type Mode = "parametric" | "figure" | "hybrid";
export type FeedKind = "plan" | "ok" | "active" | "warn" | "fix";
export type StageStatus = "done" | "active" | "pend";

export interface FeedRow {
  t: string;
  glyph: string;
  label: string;
  detail: string;
  kind: FeedKind;
  episode?: "a" | "b" | "c";
}

export interface Marker { x: number; y: number; z: number; note: string }
export interface PrintState { printer: string; layer: number; totalLayers: number; etaMin: number }

export interface ViewModel {
  phase: Phase;
  mode: Mode;
  rows: FeedRow[];
  marker: Marker | null;
  print: PrintState | null;
  /** internal cursor for the inspect→fix→clean amber band */
  _ep: "idle" | "warned" | "fixing";
}

export const initialViewModel: ViewModel = {
  phase: "boot",
  mode: "parametric",
  rows: [],
  marker: null,
  print: null,
  _ep: "idle",
};

const glyphFor = (kind: FeedKind): string =>
  kind === "plan" || kind === "fix" ? "◆" : kind === "ok" ? "✓" : kind === "active" ? "●" : "⚠";

const toolKind = (status: string): FeedKind =>
  status === "done" ? "ok" : status === "running" ? "active" : "warn";

/** 5-stage tracker derived purely from phase (matches frontend stageStatus()). */
export function deriveStages(phase: Phase): StageStatus[] {
  switch (phase) {
    case "boot":
    case "empty": return ["active", "pend", "pend", "pend", "pend"];
    case "forming":
    case "inspecting":
    case "studio": return ["done", "active", "pend", "pend", "pend"];
    case "printing": return ["done", "done", "done", "done", "active"];
    case "complete": return ["done", "done", "done", "active", "pend"];
  }
}

function pushRow(vm: ViewModel, row: Omit<FeedRow, "glyph">): ViewModel {
  let episode: FeedRow["episode"];
  let ep = vm._ep;
  if (row.kind === "warn" && ep === "idle") { episode = "a"; ep = "warned"; }
  else if (row.kind === "fix" && ep === "warned") { episode = "b"; ep = "fixing"; }
  else if (row.kind === "ok" && ep === "fixing") { episode = "c"; ep = "idle"; }
  const full: FeedRow = { ...row, glyph: glyphFor(row.kind), episode };
  return { ...vm, rows: [...vm.rows, full], _ep: ep };
}

export function reduce(vm: ViewModel, e: AgentEvent): ViewModel {
  switch (e.kind) {
    case "plan":
      return { ...pushRow(vm, { t: e.t, label: "plan", detail: e.text, kind: "plan" }), phase: "forming" };
    case "fix":
      return { ...pushRow(vm, { t: e.t, label: "fix", detail: e.text, kind: "fix" }), phase: "forming", marker: null };
    case "summary":
      return pushRow(vm, { t: e.t, label: "summary", detail: e.text, kind: "ok" });
    case "tool": {
      const kind = toolKind(e.status);
      let next = pushRow(vm, { t: e.t, label: e.name, detail: e.detail, kind });
      if (e.name === "add_joints") next = { ...next, phase: "studio" };
      else if (e.name === "validate" && e.status === "done") next = { ...next, phase: "complete" };
      else if (e.name === "slice") next = { ...next, phase: "complete" };
      else if (next.phase !== "inspecting") next = { ...next, phase: "forming" };
      return next;
    }
    case "inspect":
      return e.ok
        ? { ...vm, phase: "complete", marker: null }
        : { ...vm, phase: "inspecting", marker: e.marker ?? null };
    case "print":
      return { ...vm, phase: "printing", print: { printer: e.printer, layer: e.layer, totalLayers: e.totalLayers, etaMin: e.etaMin } };
  }
}

export function reduceAll(vm: ViewModel, events: AgentEvent[]): ViewModel {
  return events.reduce(reduce, vm);
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm test -- viewModel`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: viewModel reducer (phase, feed, amber episode band, stages, print)"
```

---

## Task 7: Scaler + page skeleton

Reproduce the export's 1440×884 fit-to-window scaler (`fit()` in the export).

**Files:**
- Create: `src/design/Scaler.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/design/Scaler.tsx`**

```tsx
"use client";
import { useEffect, useRef } from "react";

/** Centers a fixed 1440x884 stage and scales it to fit the window (never upscaling). */
export function Scaler({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const fit = () => {
      const el = ref.current;
      if (!el) return;
      const s = Math.min(window.innerWidth / 1440, window.innerHeight / 884, 1);
      el.style.transform = `scale(${s})`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#E4DED2" }}>
      <div
        ref={ref}
        data-screen-label="Claude Hardware Studio"
        style={{
          width: 1440, height: 884, flex: "none", transformOrigin: "center center",
          background: "#FBFAF6", border: "1px solid #DCD7CC", borderRadius: 14, overflow: "hidden",
          display: "flex", flexDirection: "column", position: "relative",
          fontFamily: "'Space Grotesk', system-ui, sans-serif", color: "#232019",
        }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/page.tsx` with a temporary skeleton**

```tsx
import { Scaler } from "@/design/Scaler";

export default function Page() {
  return (
    <Scaler>
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", color: "#A6A095" }}>
        studio mounts here
      </div>
    </Scaler>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Scaler stage + page skeleton"
```

---

## Task 8: TopBar + StageTracker

Port `frontend/Claude Hardware.dc.html` lines 33–56 (top bar) and the `stages` render values (lines 538–544).

**Files:**
- Create: `src/components/StageTracker.tsx`
- Create: `src/components/TopBar.tsx`

- [ ] **Step 1: Create `src/components/StageTracker.tsx`**

```tsx
import type { StageStatus } from "@/lib/viewModel";

const NAMES = ["Describe", "Design", "Validate", "Slice", "Print"] as const;
const BOX = "width:18px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;flex:none;";

function boxStyle(s: StageStatus): React.CSSProperties {
  if (s === "done") return cssObj(BOX + "background:#E6F1EA;border:1px solid #BBDFC8;color:#00A44A;");
  if (s === "active")
    return cssObj(BOX + "border:1px solid #BBDFC8;color:#00A44A;background-image:repeating-linear-gradient(0deg,rgba(0,164,74,.85) 0 1px,transparent 1px 3px);background-size:100% 6px;animation:hwlayerfill .9s linear infinite;");
  return cssObj(BOX + "border:1px solid #C9C3B6;color:#A6A095;");
}

function labelStyle(s: StageStatus): React.CSSProperties {
  return { fontSize: 12, fontWeight: 500, color: s === "pend" ? "#A6A095" : "#232019" };
}

/** parse a "a:b;c:d;" inline-style string into a React style object */
function cssObj(s: string): React.CSSProperties {
  const o: Record<string, string> = {};
  s.split(";").filter(Boolean).forEach((d) => {
    const idx = d.indexOf(":");
    const k = d.slice(0, idx).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[k] = d.slice(idx + 1).trim();
  });
  return o as React.CSSProperties;
}

export function StageTracker({ stages }: { stages: StageStatus[] }) {
  return (
    <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
      {NAMES.map((name, i) => (
        <div key={name} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={boxStyle(stages[i])}>{stages[i] === "done" ? "✓" : ""}</div>
            <span style={labelStyle(stages[i])}>{name}</span>
          </div>
          {i < 4 && <div style={{ width: 26, height: 1, background: "#C9C3B6", margin: "0 12px" }} />}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/TopBar.tsx`**

```tsx
import type { StageStatus } from "@/lib/viewModel";
import { StageTracker } from "./StageTracker";

export function TopBar({ stages, printerStatus }: { stages: StageStatus[]; printerStatus: string }) {
  return (
    <div style={{ height: 54, flex: "none", display: "flex", alignItems: "center", gap: 20, padding: "0 18px", borderBottom: "1px solid #DCD7CC", background: "#FBFAF6", zIndex: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "none" }}>
        <div style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", color: "#00A44A", fontSize: 17, lineHeight: 1 }}>⬡</div>
        <span style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: ".05em", color: "#232019" }}>CLAUDE HARDWARE</span>
      </div>
      <StageTracker stages={stages} />
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6E6A60" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00A44A", animation: "hwpulsedot 2.4s ease-in-out infinite" }} />
        <span>{printerStatus}</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Smoke-test the StageTracker**

Create `src/components/__tests__/StageTracker.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageTracker } from "@/components/StageTracker";

describe("StageTracker", () => {
  it("renders all five stages and a check on done stages", () => {
    render(<StageTracker stages={["done", "active", "pend", "pend", "pend"]} />);
    ["Describe", "Design", "Validate", "Slice", "Print"].forEach((n) => expect(screen.getByText(n)).toBeInTheDocument());
    expect(screen.getByText("✓")).toBeInTheDocument(); // the single 'done' stage
  });
});
```

Run: `npm test -- StageTracker`
Expected: PASS (1 test).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: TopBar + 5-stage tracker"
```

---

## Task 9: ConversationPanel (left, 300px)

Port lines 61–109 + the mode-chip render values (lines 566–569, 600–603). Stateless: all toggles are props/callbacks.

**Files:**
- Create: `src/components/ConversationPanel.tsx`

- [ ] **Step 1: Create `src/components/ConversationPanel.tsx`**

```tsx
import type { Mode } from "@/lib/viewModel";

const MODE_META: Record<Mode, [string, string]> = {
  parametric: ["⚙", "parametric"],
  figure: ["✦", "figure"],
  hybrid: ["⚙+✦", "hybrid"],
};

export interface ConversationPanelProps {
  mode: Mode;
  showConvo: boolean;
  micActive: boolean;
  showModePopover: boolean;
  showRefImage: boolean;
  onToggleMic: () => void;
  onToggleMode: () => void;
  onPickMode: (m: Mode) => void;
  onRemoveRef: () => void;
}

export function ConversationPanel(p: ConversationPanelProps) {
  const [icon, label] = MODE_META[p.mode];
  return (
    <div style={{ width: 300, flex: "none", borderRight: "1px solid #DCD7CC", background: "#FBFAF6", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "14px 16px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".14em", color: "#A6A095", flex: "none" }}>CONVERSATION</div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 12px", display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
        {p.showConvo && (
          <>
            <div style={{ alignSelf: "flex-end", maxWidth: 240, background: "#DCD7CC", border: "1px solid #C9C3B6", borderRadius: "14px 14px 4px 14px", padding: "10px 13px", fontSize: 14, lineHeight: "20px", color: "#232019" }}>
              A phone stand with a 15° viewing angle and a cable slot
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 9, alignSelf: "flex-start", maxWidth: 248 }}>
              <div style={{ fontSize: 14, lineHeight: "20px", color: "#6E6A60" }}>Designing now — I&apos;ll flag anything that affects printability.</div>
              <div style={{ position: "relative", alignSelf: "flex-start" }}>
                <div onClick={p.onToggleMode} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#F0ECE3", border: "1px solid #C9C3B6", borderRadius: 9999, padding: "5px 11px 5px 9px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#232019", userSelect: "none" }}>
                  <span style={{ color: "#1F8F50" }}>{icon}</span><span>{label}</span>
                  <span style={{ color: "#A6A095", fontSize: 9 }}>▾</span>
                </div>
                {p.showModePopover && (
                  <div style={{ position: "absolute", top: 34, left: 0, width: 188, background: "#F0ECE3", border: "1px solid #C9C3B6", borderRadius: 10, padding: 5, zIndex: 20, display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: ".12em", color: "#A6A095", padding: "5px 8px 3px" }}>RE-ROUTE ENGINE</div>
                    {(Object.keys(MODE_META) as Mode[]).map((m) => (
                      <div key={m} onClick={() => p.onPickMode(m)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 8px", borderRadius: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, cursor: "pointer", color: "#232019", background: p.mode === m ? "#DCD7CC" : "transparent" }}>
                        <span style={{ width: 16, display: "inline-block", color: "#1F8F50" }}>{MODE_META[m][0]}</span>
                        <span style={{ flex: 1 }}>{MODE_META[m][1]}</span>
                        <span style={{ color: "#00A44A" }}>{p.mode === m ? "✓" : ""}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ flex: "none", borderTop: "1px solid #DCD7CC", padding: "12px 14px 14px" }}>
        {p.showRefImage && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "5px 7px", border: "1px solid #00A44A", borderRadius: 8, background: "#E7F0E9" }}>
            <div style={{ width: 30, height: 30, borderRadius: 5, background: "repeating-linear-gradient(135deg,#DCD7CC 0 5px,#E2DCD0 5px 10px)", flex: "none" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#6E6A60" }}>ref_pose.png</span>
            <span onClick={p.onRemoveRef} style={{ color: "#A6A095", cursor: "pointer", fontSize: 13, padding: "0 2px" }}>✕</span>
          </div>
        )}
        {p.micActive && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 22, marginBottom: 9, padding: "0 4px" }}>
            {Array.from({ length: 22 }, (_, i) => (
              <div key={i} style={{ width: 3, flex: 1, maxWidth: 4, borderRadius: 2, background: "#00A44A", transformOrigin: "bottom", animation: `hwwave ${0.5 + (i % 5) * 0.12}s ease-in-out infinite`, animationDelay: `${i * 0.03}s`, height: "100%" }} />
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "#F0ECE3", border: "1px solid #C9C3B6", borderRadius: 9999, padding: "6px 7px 6px 6px" }}>
          <div onClick={p.onToggleMic} style={{ width: 30, height: 30, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, cursor: "pointer", ...(p.micActive ? { background: "#00A44A", color: "#06120B" } : { background: "#DCD7CC", color: "#6E6A60" }) }}>●</div>
          <span style={{ flex: 1, fontSize: 13, color: "#A6A095", fontWeight: 300 }}>{p.micActive ? "listening…" : "Refine it — e.g. 'make it 20% taller'"}</span>
          <span style={{ color: "#A6A095", fontSize: 14, cursor: "pointer", paddingRight: 4 }}>📎</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: ConversationPanel (convo, mode chip+popover, mic, ref image)"
```

---

## Task 10: Right panel — AgentFeed + DesignNotes + PrintCenter

Port lines 181–240 + render values (rows 547–555, notes 558–563, print 595–616).

**Files:**
- Create: `src/components/AgentFeed.tsx`
- Create: `src/components/DesignNotes.tsx`
- Create: `src/components/PrintCenter.tsx`

- [ ] **Step 1: Create `src/components/AgentFeed.tsx`**

```tsx
import { useEffect, useRef } from "react";
import type { FeedRow } from "@/lib/viewModel";
import { C } from "@/design/tokens";

const MINI_BARS = ["▼▁▂▃", "▁▼▂▃", "▁▂▼▃", "▁▂▃▼"];

function gutterAndBg(ep?: FeedRow["episode"]): [string, string] {
  if (ep === "a") return [C.amberGutterA, C.amberBg];
  if (ep === "b") return [C.amberGutterB, "transparent"];
  if (ep === "c") return [C.accentWeak, "transparent"];
  return ["transparent", "transparent"];
}

function glyphColor(kind: FeedRow["kind"]): string {
  if (kind === "ok") return C.accentWeak;
  if (kind === "active") return C.accent;
  if (kind === "warn") return C.warn;
  return C.text2;
}

export function AgentFeed({ rows, feedMode, miniFrame }: { rows: FeedRow[]; feedMode: string; miniFrame: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, borderBottom: "1px solid #DCD7CC" }}>
      <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px 9px" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".14em", color: "#A6A095" }}>AGENT ACTIVITY</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#1F8F50", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#00A44A", animation: "hwpulsedot 1.6s ease-in-out infinite" }} />{feedMode}
        </span>
      </div>
      <div ref={ref} style={{ flex: 1, overflowY: "auto", padding: "0 14px 12px" }}>
        {rows.map((row, i) => {
          const [gutter, bg] = gutterAndBg(row.episode);
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 9, borderLeft: `2px solid ${gutter}`, borderBottom: "1px solid #E7E2D7", background: bg, animation: "hwfeedin .25s ease-out" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#A6A095", width: 34, flex: "none" }}>{row.t}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, width: 14, flex: "none", textAlign: "center", color: glyphColor(row.kind) }}>{row.glyph}</span>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: "#232019" }}>{row.label}</span>
                  {row.kind === "active" && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#00A44A", letterSpacing: 1 }}>{MINI_BARS[miniFrame]}</span>}
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: "15px", color: row.kind === "warn" ? C.warn : C.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 228 }}>{row.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/DesignNotes.tsx`** (the 4 static notes from the export; the ⚠ note carries the Apply-fix action)

```tsx
import { C } from "@/design/tokens";

interface Note { ok: boolean; text: string; action: boolean }

const NOTES: Note[] = [
  { ok: true, text: "0.3mm tolerance on cable slot — printed holes shrink", action: false },
  { ok: true, text: "Base edges chamfered — bed adhesion, no supports", action: false },
  { ok: false, text: "Riser wall 1.2mm — recommend 1.6mm", action: true },
  { ok: true, text: "Max overhang 45° — safe unsupported", action: false },
];

export function DesignNotes({ onApplyFix }: { onApplyFix: () => void }) {
  return (
    <div style={{ flex: "none", padding: "13px 16px", borderBottom: "1px solid #DCD7CC" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".14em", color: "#A6A095", marginBottom: 11 }}>DESIGN NOTES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {NOTES.map((n, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, flex: "none", width: 14, color: n.ok ? C.accentWeak : C.warn }}>{n.ok ? "✓" : "⚠"}</span>
            <span style={{ flex: 1, fontSize: 13, lineHeight: "18px", color: "#6E6A60" }}>{n.text}</span>
            {n.action && <span onClick={onApplyFix} style={{ flex: "none", fontSize: 11.5, fontWeight: 500, color: "#232019", border: "1px solid #C9C3B6", borderRadius: 7, padding: "3px 9px", cursor: "pointer" }}>Apply fix</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/PrintCenter.tsx`**

```tsx
import type { PrintState } from "@/lib/viewModel";

export interface PrintCenterProps {
  print: PrintState | null;
  rippleKey: number;
  onSend: () => void;
}

export function PrintCenter({ print, rippleKey, onSend }: PrintCenterProps) {
  const printing = print !== null;
  const pct = printing ? Math.round((print!.layer / print!.totalLayers) * 100) : 0;
  return (
    <div style={{ flex: "none", padding: "14px 16px 16px" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".14em", color: "#A6A095", marginBottom: 11 }}>PRINT CENTER</div>
      {printing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}>
            <span style={{ color: "#232019" }}>{print!.printer} · bed 60°C</span>
            <span style={{ color: "#1F8F50" }}>{`${Math.floor(print!.etaMin / 60)}h ${print!.etaMin % 60}m`}</span>
          </div>
          <div style={{ height: 6, background: "#F0ECE3", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, backgroundImage: "repeating-linear-gradient(90deg,#00A44A 0 2px,#E6F1EA 2px 4px)", transition: "width .25s" }} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6E6A60" }}>
            {`layer ${print!.layer}/${print!.totalLayers} · 0.2mm`}<span style={{ animation: "hwblink 1s steps(1) infinite" }}>▍</span>
          </div>
          <div style={{ marginTop: 3, aspectRatio: "16/9", border: "1px solid #DCD7CC", borderRadius: 8, background: "#E4DED2", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#A6A095", letterSpacing: ".1em" }}>◉ printer cam</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#6E6A60" }}>14g PLA · 1h 23m · 847 layers</div>
          <div onClick={onSend} style={{ position: "relative", background: "#00A44A", borderRadius: 9999, height: 42, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 600, color: "#06120B", cursor: "pointer", overflow: "hidden" }}>
            <span style={{ position: "relative", zIndex: 2 }}>Send to printer</span>
            <span key={rippleKey} style={{ position: "absolute", left: "50%", top: "50%", width: 80, height: 80, margin: "-40px 0 0 -40px", borderRadius: "50%", background: "rgba(255,255,255,.5)", ...(rippleKey > 0 ? { animation: "hwripple .6s ease-out" } : { opacity: 0 }) }} />
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Smoke-test the feed renders the amber band detail**

Create `src/components/__tests__/AgentFeed.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentFeed } from "@/components/AgentFeed";
import { reduceAll, initialViewModel } from "@/lib/viewModel";
import { PARAMETRIC_SCRIPT } from "@/lib/mockStream";

describe("AgentFeed", () => {
  it("renders ported feed rows from a reduced parametric run", () => {
    const vm = reduceAll(initialViewModel, PARAMETRIC_SCRIPT.map((s) => s.event));
    render(<AgentFeed rows={vm.rows} feedMode="parametric" miniFrame={0} />);
    expect(screen.getByText("write_openscad")).toBeInTheDocument();
    expect(screen.getByText("cable slot intersects riser wall")).toBeInTheDocument();
  });
});
```

Run: `npm test -- AgentFeed`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: right panel — AgentFeed, DesignNotes, PrintCenter"
```

---

## Task 11: VersionRail + DemoHarness footer

Port lines 165–175 (version rail) and 244–254 + conductor values (591–592).

**Files:**
- Create: `src/components/VersionRail.tsx`
- Create: `src/components/DemoHarness.tsx`

- [ ] **Step 1: Create `src/components/VersionRail.tsx`**

```tsx
export function VersionRail({ current, onPick }: { current: number; onPick: (i: number) => void }) {
  return (
    <div style={{ flex: "none", height: 74, borderTop: "1px solid #DCD7CC", background: "#FBFAF6", display: "flex", alignItems: "center", gap: 12, padding: "0 18px" }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "#A6A095", marginRight: 2 }}>VERSIONS</span>
      {[0, 1, 2].map((i) => {
        const cur = current === i;
        return (
          <div key={i} onClick={() => onPick(i)} style={{ position: "relative", width: 46, height: 46, borderRadius: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "#F0ECE3", border: `1px solid ${cur ? "#00A44A" : "#C9C3B6"}` }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: cur ? "#232019" : "#6E6A60" }}>{`v${i + 1}`}</span>
            {i === 1 && <span style={{ position: "absolute", top: 5, right: 5, width: 5, height: 5, borderRadius: "50%", background: "#B26B07" }} />}
          </div>
        );
      })}
      <div style={{ width: 46, height: 46, border: "1px dashed #C9C3B6", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#A6A095", fontSize: 18, cursor: "pointer" }}>+</div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/DemoHarness.tsx`** (the conductor; `beats` come from Studio)

```tsx
export interface Beat { label: string; go: () => void }

export function DemoHarness({ beats }: { beats: Beat[] }) {
  return (
    <div style={{ flex: "none", height: 46, display: "flex", alignItems: "center", gap: 12, padding: "0 18px", borderTop: "1px solid #DCD7CC", background: "#FBFAF6", zIndex: 6 }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: ".18em", color: "#A6A095", flex: "none" }}>DEMO&nbsp;HARNESS</span>
      <div style={{ width: 1, height: 15, background: "#DCD7CC", flex: "none" }} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 1, overflowX: "auto", minWidth: 0 }}>
        {beats.map((b, i) => (
          <div key={i} onClick={b.go} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6E6A60", padding: "5px 9px", borderRadius: 9999, cursor: "pointer", whiteSpace: "nowrap" }}>{b.label}</div>
        ))}
      </div>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: ".06em", color: "#A6A095", flex: "none" }}>auto-plays once · replay any moment</span>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: VersionRail + DemoHarness conductor footer"
```

---

## Task 12: Fixture mesh + r3f dependencies

**Files:**
- Create: `public/fixtures/phone_stand.stl` (copied from `tools/_scratch`)
- Modify: `.gitignore` (exception so the served fixture is tracked)
- Modify: `package.json` (three deps)

- [ ] **Step 1: Copy the fixture into `public/` and track it**

```bash
cd /Users/vrajpatel/Developer/hard
mkdir -p public/fixtures
cp tools/_scratch/phone_stand.stl public/fixtures/phone_stand.stl
```

Then append to `.gitignore` (the existing `*.stl` rule otherwise ignores it):

```
# served demo fixtures (tracked despite *.stl rule above)
!public/fixtures/*.stl
```

Verify: `git check-ignore -v public/fixtures/phone_stand.stl || echo "TRACKED OK"`
Expected: prints `TRACKED OK` (the negation wins).

- [ ] **Step 2: Install three + r3f**

```bash
npm i three @react-three/fiber @react-three/drei three-stdlib
npm i -D @types/three
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "chore: phone_stand fixture in public + r3f deps"
```

---

## Task 13: r3f Viewport — mesh + orbit + scene

Replaces the export's 2D canvas. Loads the STL, frames it, lights it with the object tones, draws a subtle ground grid, and supports OrbitControls. (Forming/marker/gizmo added in Tasks 14–15.)

**Files:**
- Create: `src/viewport/Viewport.tsx`

- [ ] **Step 1: Create `src/viewport/Viewport.tsx`**

```tsx
"use client";
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls, Center, Grid } from "@react-three/drei";
import { STLLoader } from "three-stdlib";
import * as THREE from "three";
import { C } from "@/design/tokens";
import type { Phase, Marker } from "@/lib/viewModel";

export interface ViewportProps {
  phase: Phase;
  marker: Marker | null;
  /** "translate" | "rotate" | "scale" | null (null = no gizmo) */
  gizmo: "translate" | "rotate" | "scale" | null;
}

function StandMesh() {
  const geom = useLoader(STLLoader, "/fixtures/phone_stand.stl");
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: C.objFill, roughness: 0.85, metalness: 0.0, flatShading: false }),
    [],
  );
  // STL from OpenSCAD is Z-up; rotate to Y-up for the viewport
  return (
    <Center>
      <mesh geometry={geom as THREE.BufferGeometry} material={material} rotation={[-Math.PI / 2, 0, 0]} />
    </Center>
  );
}

export function Viewport(_props: ViewportProps) {
  const groupRef = useRef<THREE.Group>(null);
  return (
    <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden", background: C.viewportBg }}>
      <Canvas
        camera={{ position: [80, 70, 120], fov: 35 }}
        gl={{ alpha: true, antialias: true }}
        style={{ position: "absolute", inset: 0 }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[40, 80, 60]} intensity={0.9} />
        <directionalLight position={[-50, 30, -40]} intensity={0.25} />
        <Suspense fallback={null}>
          <group ref={groupRef}>
            <StandMesh />
          </group>
        </Suspense>
        <Grid
          args={[400, 400]}
          cellSize={10}
          cellColor={C.layer}
          sectionColor={C.border}
          fadeDistance={400}
          fadeStrength={1.5}
          infiniteGrid
          position={[0, -0.01, 0]}
        />
        <OrbitControls enablePan makeDefault minDistance={40} maxDistance={400} />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Wire the viewport temporarily into the page to verify it renders**

Replace `src/app/page.tsx` body with a viewport-only check (will be replaced in Task 16):

```tsx
import { Scaler } from "@/design/Scaler";
import { Viewport } from "@/viewport/Viewport";

export default function Page() {
  return (
    <Scaler>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#ECE7DC" }}>
        <Viewport phase="complete" marker={null} gizmo={null} />
      </div>
    </Scaler>
  );
}
```

- [ ] **Step 3: Verify it builds and runs**

Run: `npm run build`
Expected: build succeeds (r3f Canvas is a client component; build must not error on SSR — `"use client"` at top of Viewport handles this).

Then run the dev server in the background and load the page:

```bash
npm run dev
```

Use the Playwright MCP to navigate to `http://localhost:3000` and take a screenshot.
Expected: a warm-paper viewport showing the phone-stand mesh, orbitable; a faint ground grid. Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: r3f Viewport — STL mesh, orbit, scene, grid"
```

---

## Task 14: Forming animation (layer-line reveal + green scanline)

Hero moment #2. When `phase === "forming"`, reveal the mesh bottom-up with a clipping plane while a green scanline rides the cut height; settle to fully revealed on `complete`.

**Files:**
- Modify: `src/viewport/Viewport.tsx`

- [ ] **Step 1: Replace `StandMesh` and add the scanline in `src/viewport/Viewport.tsx`**

Replace the `StandMesh` function and add a `Scanline` component + a forming hook. The full updated file:

```tsx
"use client";
import { Suspense, useMemo, useRef, useState, useLayoutEffect } from "react";
import { Canvas, useLoader, useFrame } from "@react-three/fiber";
import { OrbitControls, Center, Grid } from "@react-three/drei";
import { STLLoader } from "three-stdlib";
import * as THREE from "three";
import { C } from "@/design/tokens";
import type { Phase, Marker } from "@/lib/viewModel";

export interface ViewportProps {
  phase: Phase;
  marker: Marker | null;
  gizmo: "translate" | "rotate" | "scale" | null;
}

/** Smoothly approach a target each frame (frame-rate independent). */
function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function FormingStand({ phase }: { phase: Phase }) {
  const geom = useLoader(STLLoader, "/fixtures/phone_stand.stl") as THREE.BufferGeometry;

  // mesh bounds (Y-up after rotation) for clip height + scanline placement
  const { minY, maxY } = useMemo(() => {
    geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    // after rotation [-PI/2,0,0], world Y spans original Z
    return { minY: bb.min.z, maxY: bb.max.z };
  }, [geom]);

  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), maxY), [maxY]);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: C.objFill, roughness: 0.85, metalness: 0.0,
        clippingPlanes: [clipPlane], clipShadows: false,
      }),
    [clipPlane],
  );

  const scanRef = useRef<THREE.Mesh>(null);
  const progress = useRef(phase === "forming" ? 0 : 1);

  useFrame((state, dt) => {
    const target = phase === "forming" ? 1 : 1; // forming animates 0->1; non-forming holds at 1
    if (phase === "forming") {
      progress.current = Math.min(1, progress.current + dt / 2.2); // ~2.2s sweep
    } else {
      progress.current = damp(progress.current, target, 6, dt);
    }
    const h = THREE.MathUtils.lerp(minY, maxY, progress.current);
    // clip plane keeps everything BELOW current height visible
    clipPlane.constant = h;
    if (scanRef.current) {
      scanRef.current.position.y = h;
      const mat = scanRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = progress.current < 0.999 && phase === "forming" ? 0.9 : 0;
    }
  });

  // reset progress when (re)entering forming
  useLayoutEffect(() => {
    if (phase === "forming") progress.current = 0;
  }, [phase]);

  return (
    <Center>
      <group>
        <mesh geometry={geom} material={material} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh ref={scanRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, minY, 0]}>
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial color={C.accent} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    </Center>
  );
}

export function Viewport({ phase }: ViewportProps) {
  return (
    <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden", background: C.viewportBg }}>
      <Canvas
        camera={{ position: [80, 70, 120], fov: 35 }}
        gl={{ alpha: true, antialias: true, localClippingEnabled: true }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
        style={{ position: "absolute", inset: 0 }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[40, 80, 60]} intensity={0.9} />
        <directionalLight position={[-50, 30, -40]} intensity={0.25} />
        <Suspense fallback={null}>
          <FormingStand phase={phase} />
        </Suspense>
        <Grid args={[400, 400]} cellSize={10} cellColor={C.layer} sectionColor={C.border} fadeDistance={400} fadeStrength={1.5} infiniteGrid position={[0, -0.01, 0]} />
        <OrbitControls enablePan makeDefault minDistance={40} maxDistance={400} />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Verify the forming animation in the browser**

Run `npm run dev`, then with Playwright MCP load `http://localhost:3000` (page currently passes `phase="complete"`). Temporarily verify forming by editing the page's `phase` prop to `"forming"` and screenshotting mid-sweep.
Expected: the mesh reveals bottom-up with a green scanline crossing it, then holds fully formed. Revert the page prop edit afterward. Stop dev server.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: forming animation — clip-plane reveal + green scanline"
```

---

## Task 15: Move gizmo + inspect marker

Spec §8 requires moving the object in free space. Add `TransformControls` (toggled by `gizmo` prop, auto-disabling orbit while dragging) and an amber inspect marker (drei `Html`) pinned when `phase === "inspecting"`.

**Files:**
- Modify: `src/viewport/Viewport.tsx`

- [ ] **Step 1: Add imports and the marker/gizmo to `src/viewport/Viewport.tsx`**

Update the imports line to include `TransformControls` and `Html`:

```tsx
import { OrbitControls, Center, Grid, TransformControls, Html } from "@react-three/drei";
```

Wrap the forming stand in `TransformControls` when `gizmo` is set, and render the marker. Replace the `<Suspense>` block and add a marker overlay inside `FormingStand`'s returned group. The marker is positioned using the inspect marker coords (the export uses 2D coords `x:-46,y:118`; map them into mesh-local space by treating them as millimetres around the mesh center). Add this inside `FormingStand`, after the scanline mesh, before closing the group:

```tsx
        {/* inspect marker (amber ring + label) */}
        {/* markerProp is passed down from Viewport */}
```

For clarity, change `FormingStand` to accept `marker` and render it, and have `Viewport` pass `marker` plus wrap with the gizmo. Full updated file:

```tsx
"use client";
import { Suspense, useMemo, useRef, useLayoutEffect } from "react";
import { Canvas, useLoader, useFrame } from "@react-three/fiber";
import { OrbitControls, Center, Grid, TransformControls, Html } from "@react-three/drei";
import { STLLoader } from "three-stdlib";
import * as THREE from "three";
import { C } from "@/design/tokens";
import type { Phase, Marker } from "@/lib/viewModel";

export interface ViewportProps {
  phase: Phase;
  marker: Marker | null;
  gizmo: "translate" | "rotate" | "scale" | null;
}

function damp(current: number, target: number, lambda: number, dt: number) {
  return THREE.MathUtils.damp(current, target, lambda, dt);
}

function FormingStand({ phase, marker }: { phase: Phase; marker: Marker | null }) {
  const geom = useLoader(STLLoader, "/fixtures/phone_stand.stl") as THREE.BufferGeometry;
  const { minY, maxY } = useMemo(() => {
    geom.computeBoundingBox();
    const bb = geom.boundingBox!;
    return { minY: bb.min.z, maxY: bb.max.z };
  }, [geom]);

  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), maxY), [maxY]);
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: C.objFill, roughness: 0.85, metalness: 0.0, clippingPlanes: [clipPlane] }),
    [clipPlane],
  );
  const scanRef = useRef<THREE.Mesh>(null);
  const progress = useRef(phase === "forming" ? 0 : 1);

  useFrame((_s, dt) => {
    if (phase === "forming") progress.current = Math.min(1, progress.current + dt / 2.2);
    else progress.current = damp(progress.current, 1, 6, dt);
    const h = THREE.MathUtils.lerp(minY, maxY, progress.current);
    clipPlane.constant = h;
    if (scanRef.current) {
      scanRef.current.position.y = h;
      (scanRef.current.material as THREE.MeshBasicMaterial).opacity = phase === "forming" && progress.current < 0.999 ? 0.9 : 0;
    }
  });
  useLayoutEffect(() => { if (phase === "forming") progress.current = 0; }, [phase]);

  const showMarker = phase === "inspecting" && marker;

  return (
    <Center>
      <group>
        <mesh geometry={geom} material={material} rotation={[-Math.PI / 2, 0, 0]} />
        <mesh ref={scanRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, minY, 0]}>
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial color={C.accent} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        {showMarker && (
          <group position={[marker!.x * 0.1, marker!.y * 0.1, marker!.z * 0.1]}>
            <mesh>
              <ringGeometry args={[2.4, 3.0, 32]} />
              <meshBasicMaterial color={C.warn} transparent opacity={0.95} depthTest={false} />
            </mesh>
            <Html distanceFactor={120} style={{ pointerEvents: "none" }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.warn, whiteSpace: "nowrap", transform: "translate(10px,-50%)" }}>{marker!.note}</div>
            </Html>
          </group>
        )}
      </group>
    </Center>
  );
}

export function Viewport({ phase, marker, gizmo }: ViewportProps) {
  const targetRef = useRef<THREE.Group>(null);
  return (
    <div style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden", background: C.viewportBg }}>
      <Canvas
        camera={{ position: [80, 70, 120], fov: 35 }}
        gl={{ alpha: true, antialias: true }}
        onCreated={({ gl }) => { gl.localClippingEnabled = true; }}
        style={{ position: "absolute", inset: 0 }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[40, 80, 60]} intensity={0.9} />
        <directionalLight position={[-50, 30, -40]} intensity={0.25} />
        <Suspense fallback={null}>
          {gizmo ? (
            <TransformControls mode={gizmo}>
              <group ref={targetRef}>
                <FormingStand phase={phase} marker={marker} />
              </group>
            </TransformControls>
          ) : (
            <FormingStand phase={phase} marker={marker} />
          )}
        </Suspense>
        <Grid args={[400, 400]} cellSize={10} cellColor={C.layer} sectionColor={C.border} fadeDistance={400} fadeStrength={1.5} infiniteGrid position={[0, -0.01, 0]} />
        <OrbitControls enablePan makeDefault minDistance={40} maxDistance={400} />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 2: Verify marker + gizmo in the browser**

Run `npm run dev`. With Playwright MCP, load the page with `phase="inspecting"` and a marker (temporarily edit the page props) → expect an amber ring + `wall 0.9mm` label on the mesh. Then set `gizmo="translate"` → expect a move gizmo; dragging it moves the object while orbit is suppressed during drag. Revert the page edits; stop dev server.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: viewport move gizmo (TransformControls) + amber inspect marker"
```

---

## Task 16: Studio container — wire mockStream → reducer → UI

The single stateful component. Holds the ViewModel, runs the boot sequence then `playScript`, exposes the conductor beats (seek by resetting + instant-applying earlier events), and assembles all panels in the 3-panel layout.

**Files:**
- Create: `src/components/Studio.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create `src/components/Studio.tsx`**

```tsx
"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/agentEvent";
import { initialViewModel, reduce, reduceAll, deriveStages, type ViewModel, type Mode } from "@/lib/viewModel";
import { PARAMETRIC_SCRIPT, FIGURE_SCRIPT, playScript, type Player, type ScriptStep } from "@/lib/mockStream";
import { TopBar } from "./TopBar";
import { ConversationPanel } from "./ConversationPanel";
import { AgentFeed } from "./AgentFeed";
import { DesignNotes } from "./DesignNotes";
import { PrintCenter } from "./PrintCenter";
import { VersionRail } from "./VersionRail";
import { DemoHarness, type Beat } from "./DemoHarness";
import { Viewport } from "@/viewport/Viewport";

type Action =
  | { type: "event"; event: AgentEvent }
  | { type: "reset"; vm: ViewModel };

function reducer(vm: ViewModel, a: Action): ViewModel {
  return a.type === "event" ? reduce(vm, a.event) : a.vm;
}

const baseVM = (mode: Mode, phase: ViewModel["phase"]): ViewModel => ({ ...initialViewModel, mode, phase });

export function Studio() {
  const [vm, dispatch] = useReducer(reducer, { ...initialViewModel, phase: "boot" });
  const [mode, setMode] = useState<Mode>("parametric");
  const [micActive, setMicActive] = useState(false);
  const [modePopover, setModePopover] = useState(false);
  const [curVersion, setCurVersion] = useState(2);
  const [rippleKey, setRippleKey] = useState(0);
  const [miniFrame, setMiniFrame] = useState(0);
  const [booting, setBooting] = useState(true);

  const playerRef = useRef<Player | null>(null);
  const printTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    playerRef.current?.cancel();
    playerRef.current = null;
    if (printTimer.current) { clearInterval(printTimer.current); printTimer.current = null; }
  }, []);

  // mini-loader frame ticker (matches export's 180ms cadence)
  useEffect(() => {
    const id = setInterval(() => setMiniFrame((f) => (f + 1) % 4), 180);
    return () => clearInterval(id);
  }, []);

  const run = useCallback((script: ScriptStep[], m: Mode, fromIndex = 0) => {
    stop();
    setMode(m);
    dispatch({ type: "reset", vm: baseVM(m, fromIndex === 0 ? "empty" : reduceAll(baseVM(m, "empty"), script.slice(0, fromIndex).map((s) => s.event)).phase) });
    if (fromIndex > 0) {
      // instant-apply earlier events so we "seek" into the timeline
      dispatch({ type: "reset", vm: reduceAll(baseVM(m, "empty"), script.slice(0, fromIndex).map((s) => s.event)) });
    }
    playerRef.current = playScript(script, (event) => dispatch({ type: "event", event }), fromIndex);
  }, [stop]);

  // boot → auto-play parametric (mirrors export runDemo)
  useEffect(() => {
    const t = setTimeout(() => { setBooting(false); run(PARAMETRIC_SCRIPT, "parametric", 0); }, 2000);
    return () => { clearTimeout(t); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendPrint = useCallback(() => {
    setRippleKey((k) => k + 1);
    stop();
    let layer = 12;
    dispatch({ type: "event", event: { t: "00:20", kind: "print", printer: "BAMBU-A1", layer, totalLayers: 847, etaMin: 81 } });
    printTimer.current = setInterval(() => {
      layer = Math.min(847, layer + 7);
      const eta = Math.max(0, Math.round((847 - layer) / 847 * 83));
      dispatch({ type: "event", event: { t: "00:20", kind: "print", printer: "BAMBU-A1", layer, totalLayers: 847, etaMin: eta } });
      if (layer >= 847 && printTimer.current) { clearInterval(printTimer.current); printTimer.current = null; }
    }, 260);
  }, [stop]);

  // conductor beats (indices into PARAMETRIC_SCRIPT)
  const beats: Beat[] = [
    { label: "▸ replay", go: () => { setBooting(true); setTimeout(() => { setBooting(false); run(PARAMETRIC_SCRIPT, "parametric", 0); }, 1200); } },
    { label: "empty", go: () => { stop(); dispatch({ type: "reset", vm: baseVM("parametric", "empty") }); } },
    { label: "forming", go: () => run(PARAMETRIC_SCRIPT, "parametric", 0) },
    { label: "inspect", go: () => run(PARAMETRIC_SCRIPT, "parametric", 3) },
    { label: "print", go: () => { dispatch({ type: "reset", vm: reduceAll(baseVM("parametric", "empty"), PARAMETRIC_SCRIPT.map((s) => s.event)) }); sendPrint(); } },
    { label: "figure", go: () => run(FIGURE_SCRIPT, "hybrid", 0) },
    { label: "mic", go: () => setMicActive((v) => !v) },
    { label: "mode", go: () => setModePopover((v) => !v) },
  ];

  const stages = deriveStages(vm.phase);
  const showConvo = vm.phase !== "boot" && vm.phase !== "empty";
  const showRefImage = mode === "figure" || mode === "hybrid";
  const feedMode = mode === "parametric" ? "parametric" : "figure · hybrid";

  return (
    <>
      <TopBar stages={stages} printerStatus="BAMBU-A1 online" />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <ConversationPanel
          mode={mode}
          showConvo={showConvo}
          micActive={micActive}
          showModePopover={modePopover}
          showRefImage={showRefImage}
          onToggleMic={() => setMicActive((v) => !v)}
          onToggleMode={() => setModePopover((v) => !v)}
          onPickMode={(m) => { setMode(m); setModePopover(false); }}
          onRemoveRef={() => {}}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#ECE7DC" }}>
          {booting ? (
            <BootOverlay onSkip={() => { setBooting(false); run(PARAMETRIC_SCRIPT, "parametric", 0); }} />
          ) : (
            <Viewport phase={vm.phase} marker={vm.marker} gizmo={vm.phase === "complete" ? "translate" : null} />
          )}
          <VersionRail current={curVersion} onPick={setCurVersion} />
        </div>
        <div style={{ width: 340, flex: "none", borderLeft: "1px solid #DCD7CC", background: "#FBFAF6", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <AgentFeed rows={vm.rows} feedMode={feedMode} miniFrame={miniFrame} />
          <DesignNotes onApplyFix={() => {}} />
          <PrintCenter print={vm.print} rippleKey={rippleKey} onSend={sendPrint} />
        </div>
      </div>
      <DemoHarness beats={beats} />
    </>
  );
}

function BootOverlay({ onSkip }: { onSkip: () => void }) {
  const lines = ["engines: openscad ✓ · mesh ✓ · blender ✓", "printer: BAMBU-A1 online · bed 23°C", "ready"];
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const ids = lines.map((_, i) => setTimeout(() => setShown(i + 1), 450 + i * 420));
    return () => ids.forEach(clearTimeout);
  }, []);
  return (
    <div onClick={onSkip} style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden", background: "#ECE7DC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 13, cursor: "pointer" }}>
      {lines.map((t, i) => (
        <div key={i} style={{ color: i === 2 ? "#1F8F50" : "#6E6A60", opacity: shown > i ? 1 : 0, transition: "opacity .2s", minHeight: 18 }}>
          {shown > i ? t : ""}
          {i === 2 && shown > i && <span style={{ color: "#00A44A", animation: "hwblink 1s steps(1) infinite" }}>▍</span>}
        </div>
      ))}
    </div>
  );
}
```

Note: the `useCallback` import is `useCallback` (not `useCallback` from a custom path) — it comes from `react`. Correct the import line to:

```tsx
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
```

- [ ] **Step 2: Replace `src/app/page.tsx` with the final wiring**

```tsx
import { Scaler } from "@/design/Scaler";
import { Studio } from "@/components/Studio";

export default function Page() {
  return (
    <Scaler>
      <Studio />
    </Scaler>
  );
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: Studio container wires mockStream -> reducer -> panels + conductor"
```

---

## Task 17: Hero-state verification + PROGRESS update

Verify the five hero moments against the export and record progress.

**Files:**
- Modify: `PROGRESS.md`

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all suites pass (tokens, agentEvent, mockStream, viewModel, StageTracker, AgentFeed).

- [ ] **Step 2: Verify the 5 hero states with Playwright MCP**

Run `npm run dev`. With the Playwright MCP, navigate to `http://localhost:3000` and verify each, taking a screenshot of each for the record:

1. **Boot** — on load: the three boot lines type on over the viewport; clicking skips to forming. Stage tracker shows `Describe` active.
2. **Forming** — after boot: conversation bubble appears; feed streams `plan → write_openscad → render_preview`; the mesh reveals bottom-up with the green scanline; `Design` stage active.
3. **Inspection** — feed shows the amber `inspect_render` row (left amber gutter + tint); an amber ring + `wall 0.9mm` label pins on the mesh.
4. **Complete (slice)** — after fix: feed shows `fix` (amber gutter) → clean `render_preview` (green gutter) → `validate` → `slice`; `Slice` stage active; dimension/print-ready resting state.
5. **Print** — click **Send to printer** (one green button): ripple fires, Print Center switches to the rising layer-line progress bar + `layer N/847` + printer-cam placeholder; `Print` stage active.

Also click conductor `figure` → feed switches to the figure script (`generate_mesh → repair_mesh → add_joints → inspect → validate`), mode chip shows `⚙+✦ hybrid`, ref-image shows. (Viewport stays parametric — expected per scope.)

Expected: every state matches `frontend/Claude Hardware.dc.html` in layout, color, and typography. Stop the dev server.

- [ ] **Step 3: Update `PROGRESS.md`**

Move NEXT items 1–4 to DONE and reset NEXT to start at the parametric engine. Replace the `## DONE`, `## IN PROGRESS`, and `## NEXT` sections with:

```markdown
## DONE
- [x] All dependencies installed + verified — docs/SETUP.md
- [x] Brainstorm + design spec approved (docs/superpowers/specs/2026-06-13-...md)
- [x] OSS toolbox catalogued (docs/oss-toolbox.md)
- [x] Implementation plan: frontend shell on mockStream (docs/superpowers/plans/2026-06-13-frontend-shell-mockstream.md)
- [x] Next.js scaffolded (TS, Tailwind v4, app router) + self-hosted fonts + tokens
- [x] AgentEvent contract + mockStream + viewModel reducer (TDD)
- [x] Pure UI components ported 1:1 from the design export
- [x] r3f viewport: STL mesh + orbit + move gizmo + forming/inspect hero animations
- [x] Studio wired on mockStream — demo auto-plays; conductor seeks any beat (DEMOABLE)

## IN PROGRESS
- [ ] (none)

## NEXT (ordered)
1. Plan 02: parametric engine + real agent loop (write_openscad → render → inspect → fix → validate → export 3MF → slice), swapped behind agentStream
2. Wire agentStream alongside mockStream; UI consumes either identically
3. THEN SHOULD: Blender organic engine, remaining checks, joints/studio viewport, Deepgram, Redis, InsForge
```

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: verify hero states; PROGRESS — frontend shell demoable"
```

---

## Self-review

**Spec coverage (design spec §§ + PROGRESS NEXT #2–4):**
- §5/§8 viewport orbit + free-space move → Task 13 (orbit) + Task 15 (TransformControls). ✓
- §7 AgentEvent contract + mock/real interchangeable → Tasks 4–6, 16 (UI consumes `AgentEvent`; `agentStream` swaps in Plan 02). ✓
- §6 recipe/editable model → deferred to Plan 02 (backend); not part of the shell. ✓ (explicit boundary)
- §9 issue detection (4 checks) → the *visualization* (amber marker + design notes) is in Tasks 10/15; the *engine* checks are Plan 02. ✓ (boundary stated)
- DESIGN.md "Hardware Paper" tokens, 5 hero moments, layer-line motif, PrinterLoader, no shadows/spinners → Tasks 2,3,8–16. The mini-loader (`▼▁▂▃`) is in AgentFeed; forming scanline + print progress are layer-line fills. ✓
- DEMO.md do-not-break (mic→generate→inspect/fix→forming; send-to-printer→printing; fixtures fallback) → Tasks 16/17. (Image-drop→studio explode is SHOULD; feed-only here, boundary stated.) ✓
- NEXT #2 scaffold + tokens + fonts → Tasks 1–3. NEXT #3 AgentEvent + mockStream + demoable → Tasks 4–6,16. NEXT #4 r3f viewport (load mesh + OrbitControls + TransformControls + forming) → Tasks 13–15. ✓

**Placeholder scan:** every code step contains complete, runnable code; commands have expected output; UI-visual steps state expected observations (acceptable for a UI plan). No "TODO/similar to/add error handling" left. The one inline correction note in Task 16 Step 1 (`useCallback` import) is explicit, not a placeholder.

**Type consistency:** `ViewModel`/`Phase`/`Mode`/`FeedRow`/`StageStatus`/`PrintState`/`Marker` defined in Task 6 are imported consistently in Tasks 8–16. `AgentEvent`/`ToolName` from Task 4 used by Tasks 5,6,16. `ScriptStep`/`Player`/`playScript` from Task 5 used by Task 16. `Beat` from Task 11 used by Task 16. `deriveStages(phase)` signature stable across Tasks 6,8,16. `Viewport` props `{phase, marker, gizmo}` stable across Tasks 13–16.

**One gap fixed during review:** `deriveStages` is called with `vm.phase` in tests and Studio (takes a `Phase`, not the whole vm) — confirmed signature is `deriveStages(phase: Phase)` and all call sites pass `vm.phase`/`phase`. Consistent.
