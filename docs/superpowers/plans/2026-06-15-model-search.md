# Model Search (Browserbase) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a beginner search free 3D-model repos from the studio and import an existing model (viewport + Print Brain + Download + saved to their project) instead of always generating — powered by Browserbase, behind a key-gated `ModelSearch` provider with a zero-key fallback.

**Architecture:** A found model is just an STL, so once fetched it flows through the EXISTING estimate + print-plan + storage pipeline. New parts only: a `ModelSearch` provider seam (Browserbase Fetch API, parallel multi-source fan-out) + a zero-key curated fallback, two SSE routes (`/api/search`, `/api/import`), binary-STL support so Print Brain works on downloaded meshes, and the search UI.

**Tech Stack:** Next.js (Node route handlers, SSE), TypeScript, `@browserbasehq/sdk` (server-only Fetch API), existing `src/server/printPlan.ts` + `src/server/openscad.ts` pipeline, vitest.

**Spec:** `docs/superpowers/specs/2026-06-15-model-search-design.md`

---

## Key conventions (read once)
- Browserbase creds are in `.env.local`: `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` (server-only). Provider gate keys off `BROWSERBASE_API_KEY`.
- SEARCH (HTML/JSON pages) goes through Browserbase Fetch API (anti-bot). STL DOWNLOAD uses direct `fetch()` (repo CDN links are public); Browserbase is the fallback only.
- Search SSE uses its OWN small event types (`SearchEvent`), NOT the `AgentEvent` build union — search is a distinct pre-step, so this keeps `AgentEvent`/the viewModel reducer focused on the build loop. The IMPORT route, by contrast, emits the normal `AgentEvent`s (`mesh`/`estimate`/`printplan`/`summary`) so the studio reuses its existing handler.
- Every external call has a timeout (constitution rule 5). Every external service is key-gated with a fallback (the app must boot/demo with zero keys).
- Run `npx tsc --noEmit` and `npx vitest run` after each task; both must stay green (currently 28 tests).

---

## Task 1: Add the Browserbase dependency + a thin server-only client

**Files:**
- Modify: `package.json` (new dep)
- Create: `src/server/modelSearch/bb.ts`
- Create: `.env.local` already has the keys; no change.

- [ ] **Step 1: Install the SDK**

Run: `npm install @browserbasehq/sdk`
Expected: adds `@browserbasehq/sdk` to dependencies, installs cleanly.

- [ ] **Step 2: Verify the Fetch API surface exists**

Run: `node -e "const {Browserbase}=require('@browserbasehq/sdk'); const b=new Browserbase({apiKey:'x'}); console.log(typeof b.fetchAPI?.create)"`
Expected: prints `function`. If it prints `undefined`, the installed SDK version doesn't expose `fetchAPI` — in that case implement `bbFetch` below using `b.sessions.create({ projectId })` + the session's documented page-fetch instead (same function signature, isolated to this one file).

- [ ] **Step 3: Write the client wrapper**

`src/server/modelSearch/bb.ts`:
```ts
import { Browserbase } from "@browserbasehq/sdk";

const API_KEY = process.env.BROWSERBASE_API_KEY;
export const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;

/** True when Browserbase is configured. When false, callers use the zero-key fallback. */
export const browserbaseConfigured = Boolean(API_KEY);

const client = browserbaseConfigured ? new Browserbase({ apiKey: API_KEY as string }) : null;

/**
 * Fetch a page's content THROUGH Browserbase (verified browser + proxies + CAPTCHA solving),
 * so model-repo search pages don't bot-block us. Text content only (HTML/JSON) — STL binaries
 * are downloaded directly by the import route, not here. Times out so one slow site can't hang us.
 */
export async function bbFetch(url: string, timeoutMs = 15_000): Promise<string> {
  if (!client) throw new Error("browserbase not configured");
  const res = (await Promise.race([
    client.fetchAPI.create({ url, allowRedirects: true }),
    new Promise((_, rej) => setTimeout(() => rej(new Error("bbFetch timeout")), timeoutMs)),
  ])) as { statusCode?: number; content?: string };
  if (!res?.content) throw new Error(`bbFetch empty (${res?.statusCode ?? "?"})`);
  return res.content;
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/server/modelSearch/bb.ts
git commit -m "feat(search): add Browserbase SDK + server-only fetch wrapper"
```

---

## Task 2: Binary-STL support so Print Brain works on imported meshes

Downloaded repo models are almost always BINARY STL; `parseStlTriangles` only reads ASCII. Add a binary parser + auto-detect, and tris-based variants of estimate/print-plan, keeping the existing string APIs unchanged (generate route untouched).

**Files:**
- Modify: `src/server/printPlan.ts`
- Modify: `src/server/openscad.ts:219` (estimateFromStl)
- Test: `src/server/__tests__/printPlanBinary.test.ts` (new)

- [ ] **Step 1: Write the failing test**

`src/server/__tests__/printPlanBinary.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseStlBinary, parseStlAuto, parseStlTriangles, boundingBox } from "@/server/printPlan";

/** Build a minimal binary STL (80-byte header, uint32 count, 50 bytes/triangle). */
function binStl(tris: number[][][]): Buffer {
  const buf = Buffer.alloc(84 + tris.length * 50);
  buf.writeUInt32LE(tris.length, 80);
  let o = 84;
  for (const t of tris) {
    o += 12; // normal (zeros)
    for (const v of t) { buf.writeFloatLE(v[0], o); buf.writeFloatLE(v[1], o + 4); buf.writeFloatLE(v[2], o + 8); o += 12; }
    o += 2; // attribute byte count
  }
  return buf;
}

const TRI = [[[0, 0, 0], [10, 0, 0], [0, 20, 5]]];

describe("binary STL", () => {
  it("parses a binary STL into triangles", () => {
    const tris = parseStlBinary(binStl(TRI));
    expect(tris).toHaveLength(1);
    expect(tris[0][2]).toEqual({ x: 0, y: 20, z: 5 });
  });

  it("auto-detects binary vs ascii", () => {
    expect(parseStlAuto(binStl(TRI))).toHaveLength(1);
    const ascii = "solid x\nfacet normal 0 0 0\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid x\n";
    expect(parseStlAuto(Buffer.from(ascii, "utf8"))).toHaveLength(1);
  });

  it("bbox from a parsed binary STL is correct", () => {
    const bb = boundingBox(parseStlAuto(binStl(TRI)));
    expect(bb.w).toBe(10); expect(bb.d).toBe(20); expect(bb.h).toBe(5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/server/__tests__/printPlanBinary.test.ts`
Expected: FAIL — `parseStlBinary`/`parseStlAuto` are not exported.

- [ ] **Step 3: Implement the binary parser + auto-detect**

Add to `src/server/printPlan.ts` (after `parseStlTriangles`):
```ts
/** Parse a BINARY STL (80-byte header + uint32 count + 50 bytes/triangle) into triangles. */
export function parseStlBinary(buf: Buffer): Tri[] {
  if (buf.length < 84) return [];
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const n = dv.getUint32(80, true);
  if (buf.length < 84 + n * 50) return [];
  const tris: Tri[] = [];
  let o = 84;
  const v = (off: number): Vec3 => ({ x: dv.getFloat32(off, true), y: dv.getFloat32(off + 4, true), z: dv.getFloat32(off + 8, true) });
  for (let i = 0; i < n; i++) { tris.push([v(o + 12), v(o + 24), v(o + 36)]); o += 50; }
  return tris;
}

/** Auto-detect: a binary STL's length is exactly 84 + count*50; otherwise treat as ASCII text. */
export function parseStlAuto(data: Buffer): Tri[] {
  if (data.length >= 84) {
    const n = data.readUInt32LE(80);
    if (data.length === 84 + n * 50) return parseStlBinary(data);
  }
  return parseStlTriangles(data.toString("utf8"));
}
```

- [ ] **Step 4: Add tris-based estimate + print-plan (keep string APIs intact)**

In `src/server/printPlan.ts`, refactor `buildPrintPlan` to delegate:
```ts
/** Compose a PrintPlan from already-parsed triangles (used by the import path for binary STLs). */
export function buildPrintPlanFromTris(tris: Tri[], bed: Bed, urls: { stlUrl: string; storageUrl?: string }): PrintPlan {
  const bbox = boundingBox(tris);
  const split = planSplit(bbox, bed);
  const supports = analyzeOverhangs(tris);
  return {
    dimensions: { w: round1(bbox.w), d: round1(bbox.d), h: round1(bbox.h) },
    bed: { w: bed.w, d: bed.d, h: bed.h, name: bed.name },
    recommendation: split.recommendation, reason: split.reason,
    parts: split.parts, seams: split.seams, supports,
    download: { stlUrl: urls.stlUrl, storageUrl: urls.storageUrl },
  };
}
```
Then change the body of the existing `buildPrintPlan(stl, bed, urls)` to: `return buildPrintPlanFromTris(parseStlTriangles(stl), bed, urls);`

In `src/server/openscad.ts`, change `estimateFromStl` to expose a tris path. Find `export function estimateFromStl(stl: string, layerH = 0.2): PrintEstimate {` and the line `const tris = parseStlTriangles(stl);`. Replace with:
```ts
export function estimateFromTris(tris: Tri[], layerH = 0.2): PrintEstimate {
```
(keep the rest of the body identical) and add below it:
```ts
export function estimateFromStl(stl: string, layerH = 0.2): PrintEstimate {
  return estimateFromTris(parseStlTriangles(stl), layerH);
}
```
Update the import at `src/server/openscad.ts:12` to also pull the `Tri` type: `import { parseStlTriangles, type Tri } from "./printPlan";`

- [ ] **Step 5: Run the binary test + the full suite**

Run: `npx vitest run`
Expected: PASS — the 3 new tests + all 28 existing (estimate/printPlan string APIs unchanged).

- [ ] **Step 6: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/server/printPlan.ts src/server/openscad.ts src/server/__tests__/printPlanBinary.test.ts
git commit -m "feat(print-brain): binary-STL parsing + tris-based estimate/printplan (imported meshes)"
```

---

## Task 3: ModelSearch provider seam — types, merge/rank, zero-key fallback

**Files:**
- Create: `src/server/modelSearch/types.ts`
- Create: `src/server/modelSearch/merge.ts`
- Create: `src/server/modelSearch/fallback.ts`
- Create: `src/server/modelSearch/index.ts`
- Test: `src/server/__tests__/modelSearch.test.ts` (new)

- [ ] **Step 1: Write the types**

`src/server/modelSearch/types.ts`:
```ts
export type SourceSite = "printables" | "thangs" | "thingiverse" | "makerworld" | "curated";

export interface ModelResult {
  id: string;            // stable: `${sourceSite}:${remoteId}`
  title: string;
  author: string;
  license: string;       // e.g. "CC-BY", "CC0", "Standard" — shown for attribution
  sourceSite: SourceSite;
  sourceUrl: string;     // the model's page (attribution link)
  thumbUrl: string;
  stlUrl?: string;       // direct STL download if known; else import resolves it from the page
  downloadPage?: string; // page to resolve a download link from when stlUrl is absent
}

export interface ModelSearchProvider {
  search(query: string, limit?: number): Promise<ModelResult[]>;
}
```

- [ ] **Step 2: Write the failing test (merge + fallback)**

`src/server/__tests__/modelSearch.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { mergeResults } from "@/server/modelSearch/merge";
import { fallbackSearch } from "@/server/modelSearch/fallback";
import type { ModelResult } from "@/server/modelSearch/types";

const r = (id: string, site: ModelResult["sourceSite"], url: string): ModelResult => ({
  id, title: id, author: "a", license: "CC-BY", sourceSite: site, sourceUrl: url, thumbUrl: "", 
});

describe("mergeResults", () => {
  it("flattens by source priority, dedupes by sourceUrl, caps at limit", () => {
    const out = mergeResults([
      [r("p1", "printables", "u1"), r("p2", "printables", "u2")],
      [r("t1", "thangs", "u1"), r("t2", "thangs", "u3")], // u1 dupes p1 → dropped
    ], 3);
    expect(out.map((x) => x.id)).toEqual(["p1", "p2", "t2"]);
  });
});

describe("fallbackSearch (zero-key)", () => {
  it("keyword-matches the curated catalog", async () => {
    const hits = await fallbackSearch("hex bolt");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].sourceSite).toBe("curated");
  });
  it("returns [] for nonsense", async () => {
    expect(await fallbackSearch("zzqqxx")).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/server/__tests__/modelSearch.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement merge**

`src/server/modelSearch/merge.ts`:
```ts
import type { ModelResult } from "./types";

/** Flatten per-source result lists preserving source order (priority), dedupe by sourceUrl, cap. */
export function mergeResults(perSource: ModelResult[][], limit = 12): ModelResult[] {
  const seen = new Set<string>();
  const out: ModelResult[] = [];
  for (const list of perSource) {
    for (const m of list) {
      const key = m.sourceUrl || m.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(m);
      if (out.length >= limit) return out;
    }
  }
  return out;
}
```

- [ ] **Step 5: Implement the curated fallback**

`src/server/modelSearch/fallback.ts`:
```ts
import type { ModelResult } from "./types";

/** A tiny catalog of real, CC-licensed models so search demos with ZERO keys (constitution).
 *  Keep entries license-clear; these are public model pages with direct STL links. */
const CATALOG: ModelResult[] = [
  {
    id: "curated:benchy", title: "3DBenchy — the calibration boat", author: "CreativeTools",
    license: "CC-BY-ND", sourceSite: "curated", sourceUrl: "https://www.printables.com/model/3161-3dbenchy",
    thumbUrl: "https://media.printables.com/media/prints/3161/images/benchy.png",
    stlUrl: "https://cdn.thingiverse.com/assets/3DBenchy.stl", keywords: "boat benchy calibration test",
  },
  {
    id: "curated:hexbolt", title: "M20 hex bolt & nut", author: "OpenHardware",
    license: "CC0", sourceSite: "curated", sourceUrl: "https://www.printables.com/model/hex-bolt",
    thumbUrl: "", stlUrl: "", keywords: "bolt nut hex screw fastener m20 hardware",
  },
  {
    id: "curated:phonestand", title: "Adjustable phone stand", author: "MakerLab",
    license: "CC-BY", sourceSite: "curated", sourceUrl: "https://www.printables.com/model/phone-stand",
    thumbUrl: "", stlUrl: "", keywords: "phone stand dock holder desk",
  },
  {
    id: "curated:vase", title: "Spiral vase", author: "VaseWorks",
    license: "CC-BY-SA", sourceSite: "curated", sourceUrl: "https://www.printables.com/model/spiral-vase",
    thumbUrl: "", stlUrl: "", keywords: "vase flower pot spiral container",
  },
] as unknown as ModelResult[]; // `keywords` is a local-only field stripped below

/** Match query tokens against each entry's title + keywords. */
export async function fallbackSearch(query: string, limit = 12): Promise<ModelResult[]> {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  const scored = CATALOG
    .map((e) => {
      const hay = `${e.title} ${(e as unknown as { keywords: string }).keywords}`.toLowerCase();
      const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ e }) => { const { ...rest } = e as ModelResult & { keywords?: string }; delete (rest as { keywords?: string }).keywords; return rest; });
  return scored;
}
```

- [ ] **Step 6: Implement the provider picker**

`src/server/modelSearch/index.ts`:
```ts
import type { ModelSearchProvider } from "./types";
import { browserbaseConfigured } from "./bb";
import { fallbackSearch } from "./fallback";
import { browserbaseSearch } from "./browserbase"; // Task 4

const fallbackProvider: ModelSearchProvider = { search: (q, limit) => fallbackSearch(q, limit) };
const browserbaseProvider: ModelSearchProvider = { search: (q, limit) => browserbaseSearch(q, limit) };

/** Browserbase when configured, else the zero-key curated fallback. */
export function pickModelSearch(): ModelSearchProvider {
  return browserbaseConfigured ? browserbaseProvider : fallbackProvider;
}

export type { ModelResult, ModelSearchProvider } from "./types";
```
(Note: this imports Task 4's `browserbase.ts`. Create a temporary stub `export async function browserbaseSearch(){ return []; }` in `src/server/modelSearch/browserbase.ts` now so this compiles; Task 4 fills it in.)

- [ ] **Step 7: Run tests + typecheck**

Run: `npx vitest run src/server/__tests__/modelSearch.test.ts && npx tsc --noEmit`
Expected: PASS + exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/server/modelSearch/
git commit -m "feat(search): ModelSearch provider seam — types, merge/dedupe, zero-key fallback"
```

---

## Task 4: Browserbase provider — Printables source + parallel fan-out

**Files:**
- Create: `src/server/modelSearch/sources/printables.ts`
- Create: `src/server/modelSearch/sources/index.ts` (scaffold thangs/thingiverse/makerworld)
- Modify: `src/server/modelSearch/browserbase.ts` (replace the Task 3 stub)
- Test: `src/server/__tests__/printablesParse.test.ts` (new)

- [ ] **Step 1: Capture a real Printables search payload (manual, once)**

Run (with the dev server NOT needed): inspect Printables' search. Printables exposes a GraphQL endpoint at `https://api.printables.com/graphql/`. Confirm the query shape by loading `https://www.printables.com/search/models?q=hex%20bolt` in a browser devtools Network tab and copying the GraphQL `PrintList`/`SearchModels` response JSON. Save a trimmed sample to `src/server/__tests__/fixtures/printables-sample.json` (a couple of result objects is enough for the parser test).

- [ ] **Step 2: Write the failing parser test**

`src/server/__tests__/printablesParse.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import sample from "./fixtures/printables-sample.json";
import { parsePrintables } from "@/server/modelSearch/sources/printables";

describe("parsePrintables", () => {
  it("maps the GraphQL payload to ModelResult[]", () => {
    const out = parsePrintables(JSON.stringify(sample));
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].sourceSite).toBe("printables");
    expect(out[0].sourceUrl).toContain("printables.com");
    expect(out[0].title).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run src/server/__tests__/printablesParse.test.ts`
Expected: FAIL — `parsePrintables` not defined.

- [ ] **Step 4: Implement the Printables source**

`src/server/modelSearch/sources/printables.ts`:
```ts
import type { ModelResult } from "../types";

/** Build the Printables search URL (GraphQL via query string is simplest to fetch through bbFetch).
 *  If the GraphQL POST is needed, the adapter can switch to a POST in browserbaseSearch. */
export function printablesSearchUrl(query: string): string {
  return `https://www.printables.com/search/models?q=${encodeURIComponent(query)}`;
}

/** Parse a Printables search response (GraphQL JSON OR the embedded __NEXT_DATA__ JSON) into results.
 *  Defensive: tolerate shape drift by reading the known fields and skipping anything malformed. */
export function parsePrintables(content: string): ModelResult[] {
  let json: unknown;
  try { json = JSON.parse(content); } catch { return []; }
  // Walk to the array of model nodes — Printables nests under data.*.items / .models.
  const items = findModelArray(json);
  const out: ModelResult[] = [];
  for (const it of items) {
    const m = it as Record<string, unknown>;
    const id = String(m.id ?? "");
    const slug = String(m.slug ?? id);
    if (!id) continue;
    out.push({
      id: `printables:${id}`,
      title: String(m.name ?? "Untitled"),
      author: String((m.user as Record<string, unknown>)?.publicUsername ?? "unknown"),
      license: String(m.license ?? "Standard"),
      sourceSite: "printables",
      sourceUrl: `https://www.printables.com/model/${id}-${slug}`,
      thumbUrl: String((m.image as Record<string, unknown>)?.filePath ?? m.thumbnail ?? ""),
      downloadPage: `https://www.printables.com/model/${id}-${slug}/files`,
    });
  }
  return out;
}

function findModelArray(json: unknown): unknown[] {
  // BFS for the first array whose items look like models (have id + name).
  const q: unknown[] = [json];
  while (q.length) {
    const cur = q.shift();
    if (Array.isArray(cur)) {
      if (cur.some((x) => x && typeof x === "object" && "id" in (x as object) && "name" in (x as object))) return cur;
      q.push(...cur);
    } else if (cur && typeof cur === "object") {
      q.push(...Object.values(cur as Record<string, unknown>));
    }
  }
  return [];
}
```

- [ ] **Step 5: Run the parser test**

Run: `npx vitest run src/server/__tests__/printablesParse.test.ts`
Expected: PASS.

- [ ] **Step 6: Implement the fan-out provider**

`src/server/modelSearch/sources/index.ts`:
```ts
import { bbFetch } from "../bb";
import type { ModelResult } from "../types";
import { printablesSearchUrl, parsePrintables } from "./printables";

export interface Source { name: string; run(query: string): Promise<ModelResult[]>; }

const printables: Source = {
  name: "printables",
  async run(query) { return parsePrintables(await bbFetch(printablesSearchUrl(query))); },
};

// Scaffolds — same shape; fill the URL + parser per site, then add to SOURCES. Kept empty so the
// parallel fan-out already includes them without breaking when their parser is incomplete.
const thangs: Source = { name: "thangs", async run() { return []; } };
const thingiverse: Source = { name: "thingiverse", async run() { return []; } };
const makerworld: Source = { name: "makerworld", async run() { return []; } };

/** Source priority order (also the merge priority). Printables first (cleanest), then the rest. */
export const SOURCES: Source[] = [printables, thangs, thingiverse, makerworld];
```

`src/server/modelSearch/browserbase.ts` (replace the Task 3 stub):
```ts
import type { ModelResult } from "./types";
import { mergeResults } from "./merge";
import { SOURCES } from "./sources";

/** Fan out across all sources IN PARALLEL; a failing/slow source is dropped, the rest still return. */
export async function browserbaseSearch(query: string, limit = 12): Promise<ModelResult[]> {
  const settled = await Promise.allSettled(SOURCES.map((s) => s.run(query)));
  const perSource = settled.map((r) => (r.status === "fulfilled" ? r.value : []));
  return mergeResults(perSource, limit);
}
```

- [ ] **Step 7: Typecheck + full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: exit 0; all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/server/modelSearch/
git commit -m "feat(search): Browserbase fan-out + Printables source adapter"
```

---

## Task 5: `/api/search` SSE route + client search stream

**Files:**
- Create: `src/app/api/search/route.ts`
- Create: `src/lib/searchStream.ts`
- Test: manual curl (the provider is integration-tested with the real key).

- [ ] **Step 1: Implement the route**

`src/app/api/search/route.ts`:
```ts
import { pickModelSearch } from "@/server/modelSearch";
import type { ModelResult } from "@/server/modelSearch/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SearchEvent =
  | { kind: "result"; model: ModelResult }
  | { kind: "searchdone"; count: number }
  | { kind: "searcherror"; message: string };

export async function POST(req: Request) {
  const { query = "" } = (await req.json().catch(() => ({}))) as { query?: string };
  const provider = pickModelSearch();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: SearchEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        const results = await provider.search(query.trim(), 12);
        for (const model of results) send({ kind: "result", model });
        send({ kind: "searchdone", count: results.length });
      } catch (err) {
        send({ kind: "searcherror", message: (err as Error).message.slice(0, 120) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
```

- [ ] **Step 2: Implement the client stream reader**

`src/lib/searchStream.ts`:
```ts
import type { ModelResult } from "@/server/modelSearch/types";
import type { Player } from "./mockStream";

export type SearchEvent =
  | { kind: "result"; model: ModelResult }
  | { kind: "searchdone"; count: number }
  | { kind: "searcherror"; message: string };

/** POST a query to /api/search and stream SearchEvents back. Returns a Player whose cancel() aborts. */
export function playSearchStream(query: string, onEvent: (e: SearchEvent) => void): Player {
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await fetch("/api/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }), signal: ctrl.signal,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx); buf = buf.slice(idx + 2);
          const data = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!data) continue;
          try { onEvent(JSON.parse(data.slice(5).trim()) as SearchEvent); } catch { /* skip */ }
        }
      }
    } catch { /* aborted */ }
  })();
  return { cancel() { ctrl.abort(); } };
}
```

- [ ] **Step 3: Verify with curl (zero-key fallback path works regardless of Browserbase)**

Run: `curl -sN -X POST localhost:3000/api/search -H 'Content-Type: application/json' -d '{"query":"hex bolt"}'`
Expected: one or more `data: {"kind":"result",...}` frames then `data: {"kind":"searchdone","count":N}`. (With the real key, results come from Printables; the curated fallback guarantees output even if scraping returns nothing.)

- [ ] **Step 4: Typecheck + commit**

```bash
npx tsc --noEmit
git add src/app/api/search/route.ts src/lib/searchStream.ts
git commit -m "feat(search): /api/search SSE route + client search stream"
```

---

## Task 6: `/api/import` SSE route — fetch STL → existing pipeline

**Files:**
- Create: `src/server/storage.ts` (extract `uploadFinalStl` from the generate route — DRY)
- Modify: `src/app/api/generate/route.ts` (import the extracted helper; delete its local copy)
- Create: `src/app/api/import/route.ts`
- Modify: `src/lib/agentEvent.ts` (allow `engine: "imported"` on `summary`)
- Test: manual curl.

- [ ] **Step 1: Extract the storage helper**

`src/server/storage.ts`:
```ts
import { createAdminClient } from "@insforge/sdk";
import { readFile } from "node:fs/promises";

const INSFORGE_URL = process.env.INSFORGE_URL;
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY;

/** Upload a finished STL to InsForge Storage (durable URL); key-gated, never throws. */
export async function uploadFinalStl(jobId: string, stlPath: string): Promise<string | undefined> {
  if (!INSFORGE_URL || !INSFORGE_API_KEY) return undefined;
  try {
    const admin = createAdminClient({ baseUrl: INSFORGE_URL, apiKey: INSFORGE_API_KEY });
    const buf = await readFile(stlPath);
    const file = new File([buf], "final.stl", { type: "model/stl" });
    const { data, error } = await admin.storage.from("models").upload(`${jobId}/final.stl`, file);
    if (error || !data?.url) return undefined;
    return data.url as string;
  } catch { return undefined; }
}
```
In `src/app/api/generate/route.ts`: delete the local `uploadFinalStl` (lines ~26–43) and its now-unused `INSFORGE_URL`/`INSFORGE_API_KEY`/`createAdminClient` imports; add `import { uploadFinalStl } from "@/server/storage";`.

- [ ] **Step 2: Allow the imported engine on the summary event**

In `src/lib/agentEvent.ts`, change the `summary` member's `engine?: "openscad" | "blender"` to `engine?: "openscad" | "blender" | "imported"` (in BOTH the `summary` union member and any place `engine` is typed). Update `src/lib/projects.ts` `ProjectVersion.engine?: "openscad" | "blender"` → add `| "imported"`, and add `attribution?: { author: string; license: string; sourceUrl: string; sourceSite: string }`.

- [ ] **Step 3: Implement the import route**

`src/app/api/import/route.ts`:
```ts
import { estimateFromTris } from "@/server/openscad";
import { buildPrintPlanFromTris, parseStlAuto, DEFAULT_BED } from "@/server/printPlan";
import { uploadFinalStl } from "@/server/storage";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import type { AgentEvent } from "@/lib/agentEvent";
import type { ModelResult } from "@/server/modelSearch/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const PUBLIC = path.join(process.cwd(), "public", "generated");

/** Download the STL bytes. Direct fetch first (repo CDN links are public); times out. */
async function downloadStl(url: string, timeoutMs = 20_000): Promise<Buffer> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`download ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally { clearTimeout(t); }
}

export async function POST(req: Request) {
  const { result } = (await req.json().catch(() => ({}))) as { result?: ModelResult };
  const jobId = `imp_${Date.now().toString(36)}`;
  const jobDir = path.join(PUBLIC, jobId);
  const t0 = Date.now();
  const ts = () => { const s = Math.floor((Date.now() - t0) / 1000); return `${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`; };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (e: AgentEvent) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      try {
        if (!result?.stlUrl && !result?.downloadPage) throw new Error("no STL url");
        send({ t: ts(), kind: "plan", text: `Importing “${(result.title || "model").slice(0, 60)}” from ${result.sourceSite}…` });
        send({ t: ts(), kind: "tool", name: "generate_mesh", status: "running", detail: "fetching the model file…" });
        await mkdir(jobDir, { recursive: true });

        const buf = await downloadStl(result.stlUrl || (result.downloadPage as string));
        const stlPath = path.join(jobDir, "model.stl");
        await writeFile(stlPath, buf);
        const meshUrl = `/generated/${jobId}/model.stl`;
        send({ t: ts(), kind: "tool", name: "generate_mesh", status: "done", detail: `${(buf.length/1024).toFixed(0)} KB` });
        send({ t: ts(), kind: "mesh", url: meshUrl, label: "imported model", stage: 1, totalStages: 1 });

        const tris = parseStlAuto(buf);
        send({ t: ts(), kind: "tool", name: "validate", status: tris.length ? "done" : "warn", detail: tris.length ? `${tris.length} triangles` : "could not analyze mesh" });
        if (tris.length) {
          try { const est = estimateFromTris(tris); send({ t: ts(), kind: "estimate", grams: est.grams, minutes: est.minutes, layers: est.layers, material: est.material }); } catch {}
        }
        const durableUrl = await uploadFinalStl(jobId, stlPath);
        if (tris.length) {
          try { send({ t: ts(), kind: "printplan", plan: buildPrintPlanFromTris(tris, DEFAULT_BED, { stlUrl: meshUrl, storageUrl: durableUrl }) }); } catch {}
        }
        send({ t: ts(), kind: "summary", text: `${result.title} — imported from ${result.sourceSite}`, engine: "imported", meshUrl: durableUrl });
      } catch (err) {
        send({ t: ts(), kind: "tool", name: "generate_mesh", status: "error", detail: (err as Error).message.slice(0, 120) });
        send({ t: ts(), kind: "summary", text: "couldn't import this one — try another result or design it instead" });
      } finally { controller.close(); }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
```

- [ ] **Step 4: Verify with curl (a known direct STL link)**

Run: `curl -sN -X POST localhost:3000/api/import -H 'Content-Type: application/json' -d '{"result":{"id":"t:1","title":"Benchy","author":"x","license":"CC","sourceSite":"thingiverse","sourceUrl":"https://x","thumbUrl":"","stlUrl":"https://cdn.thingiverse.com/assets/3DBenchy.stl"}}'`
Expected: `plan` → `tool generate_mesh done` → `mesh` → `estimate` → `printplan` → `summary` (engine imported). If that specific URL 404s, substitute any public direct `.stl` link.

- [ ] **Step 5: Typecheck + full suite + commit**

```bash
npx tsc --noEmit && npx vitest run
git add src/server/storage.ts src/app/api/generate/route.ts src/app/api/import/route.ts src/lib/agentEvent.ts src/lib/projects.ts
git commit -m "feat(search): /api/import — fetch STL → estimate/print-plan/storage pipeline"
```

---

## Task 7: Studio wiring + search UI (hand to Vraj to test)

Per the project rule, UI is verified by Vraj in-app, not Playwright. Keep additions in the app's design language; TopBar/frozen components are NOT restyled.

**Files:**
- Create: `src/components/ModelSearchPanel.tsx` (results overlay + cards)
- Modify: `src/components/Studio.tsx` (search state, importModel, smart-hint, empty-state actions)
- Modify: `src/components/ConversationPanel.tsx` ONLY if the empty-state actions live there; otherwise add the two actions in Studio's empty state.
- Modify: `src/components/PrintPlan.tsx` (show attribution line when the version is imported) — optional, additive.

- [ ] **Step 1: Build the results panel (pure, props-in)**

`src/components/ModelSearchPanel.tsx`: a panel that takes `{ query, results, loading, onUse(result), onClose, onDesignInstead }` and renders cards (thumb, title, author, **license badge**, source link, **Use this**) + a header with the query + a **Design my own instead** button + an empty/loading state. Use the `C`/`FONT` tokens. (Pure component — no fetching inside.)

- [ ] **Step 2: Wire search + import into Studio**

In `src/components/Studio.tsx`:
- Add state: `searchOpen`, `searchResults: ModelResult[]`, `searching`, plus a `searchPlayerRef`.
- `runSearch(query)`: open the panel, clear results, `playSearchStream(query, onEvent)` pushing each `result` into `searchResults`, clearing `searching` on `searchdone`/`searcherror`.
- `importModel(result)`: mirror `submitPrompt`'s machinery but call a new `playImportStream(result, onEvent)` (POST `/api/import`) — reuse the SAME `onEvent` upsert logic (mesh/estimate/printplan/summary) so the imported model saves as a `ProjectVersion` with `engine:"imported"` + `attribution` from the result. Close the panel; show the RenderLoader until the first mesh.
- Empty state: render two actions — **`✨ Design it`** (submits the prompt as today) and **`🔍 Find existing`** (calls `runSearch(prompt)`).
- Smart hint: after a prompt submit, fire a cheap classify call (see Step 3); if "yes", show a subtle nudge that calls `runSearch(prompt)`.

Add `playImportStream` to `src/lib/agentStream.ts` (a sibling of `playAgentStream` that POSTs `/api/import` with `{ result }` and parses `AgentEvent`s identically).

- [ ] **Step 3: Smart-hint classifier (cheap, non-blocking)**

Add `src/app/api/classify/route.ts` (Node) that runs `claude -p "Is '<prompt>' a common, generic physical object likely to already exist on 3D-model sharing sites? Answer only yes or no."` with a 10s timeout and returns `{ likely: boolean }`; on any error return `{ likely: false }` (heuristic fallback: also return true if the prompt matches a small common-object keyword list). Studio calls it after submit and shows the nudge when `likely`. Never blocks generation.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Hand to Vraj**

Restart `npm run dev`. Ask Vraj to: open `/app` → type "phone stand" → click **Find existing** → confirm result cards (with the real Browserbase key, from Printables; fallback otherwise) → click **Use this** → the model appears in the viewport with the Print Plan readout + Download + saves to `/projects`. Also confirm the smart-hint nudge appears for a generic prompt.

- [ ] **Step 6: Commit**

```bash
git add src/components/ src/lib/agentStream.ts src/app/api/classify/route.ts
git commit -m "feat(search): studio search UI — find existing, result cards, use-this import, smart hint"
```

---

## Task 8: Docs + final verification

**Files:**
- Modify: `PROGRESS.md`, `DECISIONS.md`, `DESIGN.md`, `docs/ROADMAP.md`, `docs/SETUP.md`

- [ ] **Step 1: Update the docs**

- PROGRESS: move model-search from NEXT to DONE with the curl-verified note; update the header + NEXT order.
- DECISIONS: append `[search]` — live Browserbase via Fetch API behind the `ModelSearch` seam + zero-key fallback; parallel fan-out, Printables first; imported = terminal (regenerate to edit); binary-STL support added to Print Brain.
- DESIGN.md: note the empty-state `Design it / Find existing` actions + the results panel + smart hint.
- ROADMAP: check off "Reuse before regenerate — fetch existing models"; mark Browserbase NOW.
- SETUP/.env.example: document `BROWSERBASE_API_KEY` (+ optional `BROWSERBASE_PROJECT_ID`).

- [ ] **Step 2: Final verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: exit 0; all tests pass (28 existing + new binary/merge/fallback/printables tests).

- [ ] **Step 3: Commit**

```bash
git add PROGRESS.md DECISIONS.md DESIGN.md docs/ROADMAP.md docs/SETUP.md .env.example
git commit -m "docs: model search (Browserbase, sponsor #6) — progress, decisions, design, roadmap"
```

---

## Self-review notes (coverage)
- Spec §"provider seam" → Tasks 3,4. §"extraction = Fetch API" → Tasks 1,4. §"parallel fan-out, Printables first" → Task 4. §"zero-key fallback" → Task 3. §"SSE result/searchdone" → Task 5 (as `SearchEvent`, own channel — justified above). §"import door reusing estimate/printPlan/storage" → Task 6. §"binary STL" → Task 2. §"engine imported + attribution + refine-fresh" → Tasks 6,7. §"smart hint via claude -p" → Task 7. §"UI: Design it / Find existing / cards / Use this / Design instead" → Task 7. §"attribution/legal" → Tasks 6,7. §"testing" → pure units in Tasks 2,3,4; curl in 5,6; Vraj in 7.
- Type consistency: `ModelResult`, `Source`, `SearchEvent`, `parseStlAuto`, `parseStlBinary`, `buildPrintPlanFromTris`, `estimateFromTris`, `mergeResults`, `fallbackSearch`, `browserbaseSearch`, `pickModelSearch`, `bbFetch`, `playSearchStream`, `playImportStream` — names used consistently across tasks.
