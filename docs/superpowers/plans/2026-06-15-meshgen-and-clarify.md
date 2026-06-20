# Meshgen + Clarify-First Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken procedural-blob figure path with real text→3D meshgen (Hyper3D Rodin live in Blender + NVIDIA NIM cloud), show a textured GLB preview, ask clarifying questions before generating (which also fixes the "30 cm → 39 mm" size bug), and make login-walled search results usable via "Make this with AI".

**Architecture:** A new `src/server/meshgen/` provider seam (mirrors `src/server/modelSearch/`) with `generateMesh()` fanning down Rodin → NIM → procedural, key/availability-gated, returning a local STL (+ optional textured GLB). The `/api/generate` Blender path calls it; a new `/api/clarify` returns chip questions whose answers (incl. a real-world size) fold into the prompt and drive a post-meshgen scale step. The viewport gains GLTFLoader so meshgen GLBs render textured; STL stays the print artifact.

**Tech Stack:** Next.js (Node runtime, SSE), TypeScript, three/three-stdlib (STLLoader + GLTFLoader), Blender (BlenderMCP socket 9876 + headless), NVIDIA NIM REST (`nvapi-` key), `claude -p` CLI, vitest.

**Setup already done (user):** Rodin free-trial key set in the Blender addon ✓ · `NVIDIA_NIM=nvapi-…` in `.env.local` ✓ · BlenderMCP Connected on 9876 for the live path. With no keys the app still runs on the procedural fallback.

**Spec:** `docs/superpowers/specs/2026-06-15-meshgen-and-clarify-design.md`

---

## File Structure

**Create:**
- `src/server/meshgen/types.ts` — `MeshGenRequest`, `MeshGenResult`, `MeshGenProvider`
- `src/server/meshgen/index.ts` — `generateMesh()` fan-down + provider order
- `src/server/meshgen/procedural.ts` — wraps existing `claudeBpyPlan`/`fallbackBpyPlan` → final STL
- `src/server/meshgen/nim.ts` — NVIDIA NIM TRELLIS text/image→3D → GLB → STL
- `src/server/meshgen/rodin.ts` — BlenderMCP Rodin socket (live) → STL + GLB
- `src/server/meshScale.ts` — `scaleStlAsciiToHeight()` (pure) + `scaleStlFileToHeight()`
- `src/server/glb.ts` — `glbToStl()` + `exportSceneStlGlb()` (headless/socket Blender)
- `src/server/clarify.ts` — `classifyPrompt()`, `heuristicQuestions()`, `claudeQuestions()`
- `src/app/api/clarify/route.ts` — `POST` → `{ questions }`
- `src/lib/clarify.ts` — `Question` type + `fetchClarify()` client
- `src/components/ClarifyCard.tsx` — chip question UI
- Tests: `src/server/__tests__/meshScale.test.ts`, `src/server/__tests__/clarify.test.ts`, `src/server/__tests__/meshgen.test.ts`, `src/lib/__tests__/viewModel.glb.test.ts`

**Modify:**
- `src/lib/agentEvent.ts` — `mesh` event `+ glbUrl?`, `+ textured?`
- `src/lib/viewModel.ts` — `ViewModel.glbUrl` / `.textured`; carry from `mesh`
- `src/viewport/Viewport.tsx` — load GLB via GLTFLoader when `glbUrl` set
- `src/app/api/generate/route.ts` — Blender path → `generateMesh`; accept `sizeMm`/`refImageUrl`; emit `glbUrl`
- `src/lib/agentStream.ts` — `playAgentStream` passes `sizeMm`/`refImageUrl`; `playMakeWithAiStream`
- `src/lib/projects.ts` — `ProjectVersion + glbUrl?`
- `src/components/Studio.tsx` — clarify step before generate; carry `glbUrl`; make-with-AI
- `src/components/ModelSearchPanel.tsx` — "✨ Make this with AI" action
- `DESIGN.md`, `docs/ROADMAP.md`, `DECISIONS.md`, `PROGRESS.md`

---

## Phase 0 — Event + persistence plumbing (no behavior change)

### Task 0.1: Add `glbUrl`/`textured` to the mesh event + viewModel

**Files:**
- Modify: `src/lib/agentEvent.ts:12`
- Modify: `src/lib/viewModel.ts:21-52,106-108`
- Modify: `src/lib/projects.ts` (ProjectVersion)
- Test: `src/lib/__tests__/viewModel.glb.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/__tests__/viewModel.glb.test.ts
import { describe, it, expect } from "vitest";
import { reduce, initialViewModel } from "../viewModel";

describe("mesh event carries glb + textured", () => {
  it("sets glbUrl and textured on the viewModel", () => {
    const vm = reduce(initialViewModel, {
      t: "00:01", kind: "mesh", url: "/g/x.stl", glbUrl: "/g/x.glb",
      textured: true, label: "dragon", stage: 1, totalStages: 1,
    });
    expect(vm.meshUrl).toBe("/g/x.stl");
    expect(vm.glbUrl).toBe("/g/x.glb");
    expect(vm.textured).toBe(true);
  });
  it("clears glb when a stage has none (STL-only build)", () => {
    const start = { ...initialViewModel, glbUrl: "/old.glb", textured: true };
    const vm = reduce(start, { t: "00:02", kind: "mesh", url: "/g/y.stl", label: "x", stage: 1, totalStages: 3 });
    expect(vm.glbUrl).toBeNull();
    expect(vm.textured).toBe(false);
  });
});
```

- [ ] **Step 2: Run it, expect FAIL** — `npx vitest run src/lib/__tests__/viewModel.glb.test.ts` → fails (`glbUrl` not on type/vm).

- [ ] **Step 3: Edit `src/lib/agentEvent.ts`** — change the mesh variant (line 12) to:

```ts
  | { t: string; kind: "mesh"; url: string; glbUrl?: string; textured?: boolean; label: string; stage: number; totalStages: number }
```

- [ ] **Step 4: Edit `src/lib/viewModel.ts`** — add fields to `ViewModel` (after `meshUrl` line 32) and `initialViewModel`:

```ts
  /** textured GLB preview URL for meshgen results (null = render the STL geometry) */
  glbUrl: string | null;
  /** whether the current mesh has a textured GLB preview */
  textured: boolean;
```
```ts
  // in initialViewModel:
  glbUrl: null,
  textured: false,
```
Then update the `mesh` case (line 106-108):
```ts
    case "mesh":
      return { ...vm, phase: "forming", meshUrl: e.url, glbUrl: e.glbUrl ?? null, textured: e.textured ?? false, stage: e.stage, totalStages: e.totalStages };
```

- [ ] **Step 5: Edit `src/lib/projects.ts`** — add to `ProjectVersion` (near `meshUrl`):

```ts
  /** textured GLB preview URL (meshgen results); meshUrl stays the print STL */
  glbUrl?: string;
```

- [ ] **Step 6: Run tests, expect PASS** — `npx vitest run src/lib/__tests__/viewModel.glb.test.ts` and `npx vitest run` (all green) + `npx tsc --noEmit`.

- [ ] **Step 7: Commit**
```bash
git add src/lib/agentEvent.ts src/lib/viewModel.ts src/lib/projects.ts src/lib/__tests__/viewModel.glb.test.ts
git commit -m "feat(meshgen): carry textured glbUrl through mesh event + viewModel + project version"
```

---

## Phase 1 — Meshgen seam (procedural parity first, no regression)

### Task 1.1: Types

**Files:** Create `src/server/meshgen/types.ts`

- [ ] **Step 1: Write the file**
```ts
// src/server/meshgen/types.ts
/** A request to turn a text prompt (and optional reference image) into a printable mesh. */
export interface MeshGenRequest {
  prompt: string;
  /** reference image URL (e.g. a search-result thumbnail) for image→3D, when available */
  refImageUrl?: string;
  /** prefer the live BlenderMCP path (watch it build) when the socket is up */
  preferLive: boolean;
  /** target real-world height in mm; when set, the final mesh is scaled to it */
  sizeMm?: number;
  /** working directory for output files (jobDir) */
  jobDir: string;
}

export interface MeshGenResult {
  /** absolute path to the print STL (always present) */
  stlPath: string;
  /** absolute path to a textured GLB preview, when the provider produced one */
  glbPath?: string;
  textured: boolean;
  provider: "rodin" | "nim" | "procedural";
  /** built in the live Blender GUI (true only for the rodin socket path) */
  live: boolean;
}

export interface MeshGenProvider {
  name: MeshGenResult["provider"];
  /** is this provider usable right now (key present / socket up)? cheap check. */
  available(req: MeshGenRequest): Promise<boolean>;
  generate(req: MeshGenRequest): Promise<MeshGenResult>;
}
```

- [ ] **Step 2: tsc** — `npx tsc --noEmit` → clean.
- [ ] **Step 3: Commit** — `git add src/server/meshgen/types.ts && git commit -m "feat(meshgen): provider types"`

### Task 1.2: Procedural provider (wraps today's bpy path → final STL)

**Files:** Create `src/server/meshgen/procedural.ts`

- [ ] **Step 1: Write the file** — reuses `claudeBpyPlan`/`fallbackBpyPlan`/`renderStageBlender` from `blender.ts`. It renders the FINAL stage only (meshgen returns one mesh, not a build sequence):
```ts
// src/server/meshgen/procedural.ts
import path from "node:path";
import { existsSync } from "node:fs";
import { claudeBpyPlan, fallbackBpyPlan, renderStageBlender, blenderLiveAvailable } from "@/server/blender";
import type { MeshGenProvider, MeshGenRequest, MeshGenResult } from "./types";

export const proceduralProvider: MeshGenProvider = {
  name: "procedural",
  available: async () => true, // always the last-resort fallback
  async generate(req: MeshGenRequest): Promise<MeshGenResult> {
    let plan;
    try { plan = await claudeBpyPlan(req.prompt); }
    catch { plan = fallbackBpyPlan(req.prompt); }
    const last = plan.stages[plan.stages.length - 1];
    const stlPath = path.join(req.jobDir, "model.stl");
    const live = req.preferLive && (await blenderLiveAvailable());
    await renderStageBlender(last.scad, stlPath, path.join(req.jobDir, "model.py"), live);
    if (!existsSync(stlPath)) throw new Error("procedural produced no STL");
    return { stlPath, textured: false, provider: "procedural", live };
  },
};
```
- [ ] **Step 2: tsc** → clean.
- [ ] **Step 3: Commit** — `git commit -am "feat(meshgen): procedural provider (bpy fallback → final STL)"`

### Task 1.3: `generateMesh` fan-down + test with fakes

**Files:** Create `src/server/meshgen/index.ts`; Test `src/server/__tests__/meshgen.test.ts`

- [ ] **Step 1: Write the failing test** (inject fake providers to assert order + fallback):
```ts
// src/server/__tests__/meshgen.test.ts
import { describe, it, expect } from "vitest";
import { runProviders } from "../meshgen";
import type { MeshGenProvider, MeshGenRequest } from "../meshgen/types";

const req: MeshGenRequest = { prompt: "dragon", preferLive: false, jobDir: "/tmp/x" };
const ok = (name: any, textured = false): MeshGenProvider => ({
  name, available: async () => true,
  generate: async () => ({ stlPath: `/tmp/${name}.stl`, textured, provider: name, live: false }),
});
const down = (name: any): MeshGenProvider => ({ name, available: async () => false, generate: async () => { throw new Error("unavailable"); } });
const boom = (name: any): MeshGenProvider => ({ name, available: async () => true, generate: async () => { throw new Error("kaput"); } });

describe("runProviders fan-down", () => {
  it("uses the first available provider", async () => {
    const r = await runProviders([ok("rodin"), ok("nim"), ok("procedural")], req);
    expect(r.provider).toBe("rodin");
  });
  it("skips unavailable, then a throwing provider, landing on procedural", async () => {
    const r = await runProviders([down("rodin"), boom("nim"), ok("procedural")], req);
    expect(r.provider).toBe("procedural");
  });
});
```
- [ ] **Step 2: Run, expect FAIL** — `npx vitest run src/server/__tests__/meshgen.test.ts` (no `runProviders`).
- [ ] **Step 3: Write `src/server/meshgen/index.ts`**:
```ts
// src/server/meshgen/index.ts
import { rodinProvider } from "./rodin";
import { nimProvider } from "./nim";
import { proceduralProvider } from "./procedural";
import type { MeshGenProvider, MeshGenRequest, MeshGenResult } from "./types";
export type { MeshGenRequest, MeshGenResult } from "./types";

/** Try providers in order; first available one that doesn't throw wins. Pure (DI'd) for testing. */
export async function runProviders(providers: MeshGenProvider[], req: MeshGenRequest): Promise<MeshGenResult> {
  let lastErr: unknown;
  for (const p of providers) {
    try { if (await p.available(req)) return await p.generate(req); }
    catch (e) { lastErr = e; /* fan down */ }
  }
  throw lastErr ?? new Error("no meshgen provider available");
}

/** Production order: live Rodin (wow) → NVIDIA NIM (cloud) → procedural (zero-key). */
export function generateMesh(req: MeshGenRequest): Promise<MeshGenResult> {
  return runProviders([rodinProvider, nimProvider, proceduralProvider], req);
}
```
- [ ] **Step 4: Stub `rodin.ts` + `nim.ts`** so imports resolve (real impls in Phase 2/3). Each exports a provider whose `available` returns false for now:
```ts
// src/server/meshgen/rodin.ts (stub — real impl Task 3.1)
import type { MeshGenProvider } from "./types";
export const rodinProvider: MeshGenProvider = {
  name: "rodin", available: async () => false,
  generate: async () => { throw new Error("rodin not wired yet"); },
};
```
```ts
// src/server/meshgen/nim.ts (stub — real impl Task 2.2)
import type { MeshGenProvider } from "./types";
export const nimProvider: MeshGenProvider = {
  name: "nim", available: async () => false,
  generate: async () => { throw new Error("nim not wired yet"); },
};
```
- [ ] **Step 5: Run tests + tsc, expect PASS** — `npx vitest run src/server/__tests__/meshgen.test.ts` + `npx tsc --noEmit`.
- [ ] **Step 6: Commit** — `git commit -am "feat(meshgen): generateMesh fan-down (rodin→nim→procedural) + tests"`

### Task 1.4: Wire `/api/generate` Blender path to `generateMesh` (procedural parity)

**Files:** Modify `src/app/api/generate/route.ts:82-105,128-181`

- [ ] **Step 1:** In `POST`, destructure new optional fields:
```ts
  const { prompt = "", engine = "openscad", base = "", sizeMm, refImageUrl } =
    (await req.json().catch(() => ({}))) as { prompt?: string; engine?: string; base?: string; sizeMm?: number; refImageUrl?: string };
```
- [ ] **Step 2:** Replace the Blender branch of `buildPlan()` usage. For a NON-edit Blender request, call `generateMesh` instead of staged bpy. Keep edits on the existing `claudeBpyPlan(base)` path (refine-in-place still edits the recipe). Add, inside `start(controller)` after the immediate "designing…" sends, a meshgen branch:
```ts
        if (isBlender && !isEdit) {
          send({ t: ts(), kind: "tool", name: "generate_mesh", status: "running", detail: "asking the 3D model engine…" });
          const live = await blenderLiveAvailable();
          const { generateMesh } = await import("@/server/meshgen");
          const r = await generateMesh({ prompt, refImageUrl, preferLive: live, sizeMm, jobDir });
          send({ t: ts(), kind: "tool", name: "generate_mesh", status: "done", detail: `${r.provider}${r.live ? " · live" : ""}${r.textured ? " · textured" : ""}` });

          // optional real-world scale (fixes "30cm → 39mm"): scale the STL to sizeMm
          let stlPath = r.stlPath;
          if (sizeMm && sizeMm > 0) {
            const { scaleStlFileToHeight } = await import("@/server/meshScale");
            stlPath = await scaleStlFileToHeight(r.stlPath, sizeMm, path.join(jobDir, "scaled.stl"));
          }
          const meshUrl = `/generated/${jobId}/${path.basename(stlPath)}`;
          const glbUrl = r.glbPath ? `/generated/${jobId}/${path.basename(r.glbPath)}` : undefined;
          send({ t: ts(), kind: "mesh", url: meshUrl, glbUrl, textured: r.textured, label: "model", stage: 1, totalStages: 1 });

          send({ t: ts(), kind: "validate", ...({} as any) }); // replaced below; see Step 3
          // estimate + printplan + summary (reuse the existing tail) — see Step 3
          return;
        }
```
- [ ] **Step 3:** Factor the existing post-build tail (validate → estimate → uploadFinalStl → printplan → summary, lines 167-181) into a local helper `async function finish(stlPath, meshUrl, engineName, glbUrl?)` and call it from BOTH the staged loop and the meshgen branch, so there's no duplication. The helper sends:
```ts
        async function finish(stlPath: string, meshUrl: string, engineName: "openscad"|"blender", glbUrl?: string) {
          send({ t: ts(), kind: "tool", name: "validate", status: "done", detail: "watertight · printable" });
          let est; try { est = estimateFromStl(await readFile(stlPath, "utf8")); send({ t: ts(), kind: "estimate", grams: est.grams, minutes: est.minutes, layers: est.layers, material: est.material }); } catch {}
          const durableUrl = await uploadFinalStl(jobId, stlPath);
          try { send({ t: ts(), kind: "printplan", plan: buildPrintPlan(await readFile(stlPath, "utf8"), DEFAULT_BED, { stlUrl: meshUrl, storageUrl: durableUrl }) }); } catch {}
          send({ t: ts(), kind: "summary", text: `model ready`, engine: engineName, meshUrl: durableUrl });
        }
```
NOTE: `estimateFromStl`/`buildPrintPlan` are ASCII-STL based; meshgen STLs from Blender export are ascii (`wrapStage` uses `ascii_format=True`). For NIM GLB→STL convert, export ascii too (Task 2.1).
- [ ] **Step 4: Verify procedural parity (no keys/socket needed)** — with BlenderMCP disconnected and `NVIDIA_NIM` temporarily unset, curl a figure prompt and confirm it still streams mesh→estimate→printplan→summary via the procedural fallback:
```bash
curl -sN -X POST localhost:3000/api/generate -H 'content-type: application/json' \
  -d '{"prompt":"a tiny mushroom","engine":"blender"}' | grep -E '"kind":"(mesh|summary|printplan)"' | head
```
Expected: a `mesh` event, a `printplan`, and a `summary` with `"engine":"blender"`.
- [ ] **Step 5: tsc + tests green** — `npx tsc --noEmit && npx vitest run`.
- [ ] **Step 6: Commit** — `git commit -am "feat(meshgen): /api/generate blender path → generateMesh (procedural parity)"`

---

## Phase 2 — NVIDIA NIM (real textured dragon, cloud) + GLB→STL + viewport GLB

### Task 2.1: `glb.ts` — headless-Blender GLB→STL

**Files:** Create `src/server/glb.ts`

- [ ] **Step 1: Write it** — runs headless Blender to import a GLB and export an ascii STL (+ keep the GLB for preview). Reuses the BLENDER bin resolution pattern from `blender.ts`.
```ts
// src/server/glb.ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
const execFileP = promisify(execFile);
const bin = (abs: string, name: string) => (existsSync(abs) ? abs : name);
const BLENDER = bin("/opt/homebrew/bin/blender", "blender");

/** Import a .glb and export an ascii STL (Z-up, so estimateFromStl/printPlan parse it). */
export async function glbToStl(glbPath: string, stlPath: string, timeoutMs = 120_000): Promise<string> {
  const py = `import bpy
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=${JSON.stringify(glbPath)})
ms=[o for o in bpy.data.objects if o.type=='MESH']
for o in ms:
    o.select_set(True)
bpy.context.view_layer.objects.active = ms[0] if ms else None
bpy.ops.wm.stl_export(filepath=${JSON.stringify(stlPath)}, export_selected_objects=True, ascii_format=True, up_axis='Z', forward_axis='Y')
`;
  const pyPath = path.join(path.dirname(stlPath), "glb2stl.py");
  await writeFile(pyPath, py);
  await execFileP(BLENDER, ["--background", "--factory-startup", "--python", pyPath], { timeout: timeoutMs, maxBuffer: 32 << 20 });
  if (!existsSync(stlPath) || statSync(stlPath).size === 0) throw new Error("glbToStl produced no STL");
  return stlPath;
}
```
- [ ] **Step 2: tsc** → clean. (Runtime verified end-to-end in Task 2.3.)
- [ ] **Step 3: Commit** — `git commit -am "feat(meshgen): headless Blender GLB→STL converter"`

### Task 2.2: `nim.ts` — NVIDIA NIM TRELLIS text/image→3D

**Files:** Create (replace stub) `src/server/meshgen/nim.ts`

- [ ] **Step 1: VERIFY the real endpoint + request/response** from the model card before coding (do not fabricate). Fetch the API reference and capture: base URL, auth header, request body for text-to-3d and image-to-3d, and how the GLB is returned (asset URL vs base64 vs zip):
```bash
# read the API reference (note exact request + response shape)
curl -s https://build.nvidia.com/microsoft/trellis/modelcard | sed -n '1,40p'
```
Also confirm the call works with the key (replace SHAPE per the model card):
```bash
curl -s -X POST <ENDPOINT_FROM_MODELCARD> \
  -H "Authorization: Bearer $NVIDIA_NIM" -H 'content-type: application/json' \
  -d '{"prompt":"a small dragon"}' -o /tmp/nim.out -w '%{http_code}\n'
```
Expected: `200` and `/tmp/nim.out` containing a GLB asset (or a URL/base64 to one).
- [ ] **Step 2: Write `nim.ts`** using the verified shape. Structure (fill the request/response per Step 1):
```ts
// src/server/meshgen/nim.ts
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { glbToStl } from "@/server/glb";
import type { MeshGenProvider, MeshGenRequest, MeshGenResult } from "./types";

const KEY = process.env.NVIDIA_NIM || "";
const ENDPOINT = "<from model card>"; // e.g. https://ai.api.nvidia.com/v1/.../trellis

export const nimProvider: MeshGenProvider = {
  name: "nim",
  available: async () => Boolean(KEY),
  async generate(req: MeshGenRequest): Promise<MeshGenResult> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 180_000);
    try {
      const body = req.refImageUrl
        ? { /* image-to-3d shape from model card */ image: req.refImageUrl, prompt: req.prompt }
        : { /* text-to-3d shape from model card */ prompt: req.prompt };
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "content-type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body), signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`nim ${res.status}`);
      // Per the model card: extract the GLB bytes (asset URL → fetch, or base64 → decode).
      const glbBytes: Buffer = await extractGlb(res); // implement per Step 1 shape
      const glbPath = path.join(req.jobDir, "model.glb");
      await writeFile(glbPath, glbBytes);
      const stlPath = await glbToStl(glbPath, path.join(req.jobDir, "model.stl"));
      return { stlPath, glbPath, textured: true, provider: "nim", live: false };
    } finally { clearTimeout(t); }
  },
};

async function extractGlb(res: Response): Promise<Buffer> {
  // Implement exactly per the model-card response shape captured in Step 1.
  throw new Error("fill extractGlb from the verified NIM response shape");
}
```
- [ ] **Step 3: Curl the figure path end-to-end** (NIM enabled, BlenderMCP disconnected so Rodin is skipped):
```bash
curl -sN -X POST localhost:3000/api/generate -H 'content-type: application/json' \
  -d '{"prompt":"a chubby sitting dragon with folded wings","engine":"blender"}' \
  | grep -E '"provider"|"kind":"(mesh|summary)"' | head
```
Expected: `generate_mesh … nim · textured`, a `mesh` event with a `glbUrl`, and a `summary`. Open the GLB to eyeball it's a dragon.
- [ ] **Step 4: tsc + tests** → green.
- [ ] **Step 5: Commit** — `git commit -am "feat(meshgen): NVIDIA NIM TRELLIS text/image→3D provider + GLB→STL"`

### Task 2.3: Viewport renders the textured GLB

**Files:** Modify `src/viewport/Viewport.tsx`

- [ ] **Step 1: Add a GLB loader path.** Import `GLTFLoader` from `three-stdlib`. Pass `glbUrl`/`textured` through `ViewportProps` and `Scene`. When `glbUrl` is set, render a `<LoadedGlb url={glbUrl}/>` that loads the scene graph and frames it; else keep `LoadedModel` (STL). Add to `ViewportProps`:
```ts
  glbUrl?: string | null;
  textured?: boolean;
```
- [ ] **Step 2: Implement `LoadedGlb`** (keep materials; center + sit on the bed; orbit only — gizmo/forming stay STL-only for v1):
```ts
import { GLTFLoader } from "three-stdlib";
function LoadedGlb({ url }: { url: string }) {
  const [obj, setObj] = useState<THREE.Object3D | null>(null);
  const [halfH, setHalfH] = useState(20);
  useEffect(() => {
    let alive = true;
    new GLTFLoader().loadAsync(url).then((g) => {
      if (!alive) return;
      const root = g.scene;
      const box = new THREE.Box3().setFromObject(root);
      const c = box.getCenter(new THREE.Vector3());
      root.position.sub(c);                       // center
      const h = (box.max.y - box.min.y) / 2;
      root.position.y += h;                        // sit on the bed
      setHalfH(h); setObj(root);
    }).catch(() => {});
    return () => { alive = false; };
  }, [url]);
  if (!obj) return null;
  return (<><primitive object={obj} />{bedGrid(0)}</>);
}
```
- [ ] **Step 3: Route in `Scene`** — `if (glbUrl) return <LoadedGlb url={glbUrl} />;` before the STL path. Wire props in `Viewport(...)`.
- [ ] **Step 4: Pass props from Studio** (Task 4.x also touches Studio, but the viewport prop is here) — Studio already renders `<Viewport meshUrl={vm.meshUrl} … />`; add `glbUrl={vm.glbUrl} textured={vm.textured}`.
- [ ] **Step 5: Eyeball in-app** (per the workflow rule, hand to Vraj): generate a dragon, confirm the textured GLB shows with color/scales, orbit works, Download STL still downloads the print STL.
- [ ] **Step 6: tsc + tests** → green. **Commit** — `git commit -am "feat(viewport): render textured GLB preview when present (DESIGN.md touch)"` and update DESIGN.md noting the viewport GLB support.

---

## Phase 3 — Hyper3D Rodin (live in Blender, primary)

### Task 3.1: `rodin.ts` — drive the BlenderMCP Rodin pipeline over the socket

**Files:** Create (replace stub) `src/server/meshgen/rodin.ts`

- [ ] **Step 1: VERIFY the exact socket `type` strings** from the installed addon source (do not guess). Find and read the addon:
```bash
find ~ -path '*blender*addon*.py' 2>/dev/null | xargs grep -l -i "rodin\|hyper3d" 2>/dev/null | head
# then read the handlers to capture the exact 'type' values + params for:
#   create_rodin_job (text + image), poll_rodin_job_status, import_generated_asset, get_hyper3d_status
```
Capture: the request `type` strings, their params (e.g. `text_prompt`, `images`, `bbox_condition`), the poll response shape (job uuid + status), and the import params (uuid/name).
- [ ] **Step 2: Write `rodin.ts`** using `blenderSend` (export it from `blender.ts` first — change `function blenderSend` to `export function blenderSend`). Flow: status check → create job (text, or image when `refImageUrl`) → poll until done → import asset into the scene → export STL + GLB from the imported object using a small bpy snippet via `execute_code`. Structure (fill `type`/params per Step 1):
```ts
// src/server/meshgen/rodin.ts
import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { blenderSend, blenderLiveAvailable } from "@/server/blender";
import type { MeshGenProvider, MeshGenRequest, MeshGenResult } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const rodinProvider: MeshGenProvider = {
  name: "rodin",
  // only usable when the live Blender (addon, with its own Rodin key) is up
  available: async (req) => req.preferLive && (await blenderLiveAvailable()),
  async generate(req: MeshGenRequest): Promise<MeshGenResult> {
    // 1) create job  (type + params from Step 1; text_prompt = req.prompt; images = [req.refImageUrl] if set)
    const create = await blenderSend({ type: "create_rodin_job", params: { text_prompt: req.prompt } }, 60_000);
    const jobId = (create.result as any)?.uuid ?? (create.result as any)?.subscription_key; // per Step 1
    // 2) poll
    for (let i = 0; i < 60; i++) {
      const s = await blenderSend({ type: "poll_rodin_job_status", params: { /* uuid/subscription_key per Step 1 */ } }, 30_000);
      if (/done|completed|success/i.test(JSON.stringify(s.result))) break;
      if (/fail|error/i.test(JSON.stringify(s.result))) throw new Error("rodin job failed");
      await sleep(4000);
    }
    // 3) import the generated asset into the live scene (user watches it appear)
    await blenderSend({ type: "import_generated_asset", params: { /* name/uuid per Step 1 */ } }, 120_000);
    // 4) export STL (print) + GLB (textured preview) from the imported mesh(es)
    const stlPath = path.join(req.jobDir, "model.stl");
    const glbPath = path.join(req.jobDir, "model.glb");
    const code = `import bpy
ms=[o for o in bpy.data.objects if o.type=='MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in ms: o.select_set(True)
bpy.context.view_layer.objects.active = ms[0] if ms else None
bpy.ops.wm.stl_export(filepath=${JSON.stringify(stlPath)}, export_selected_objects=True, ascii_format=True, up_axis='Z', forward_axis='Y')
bpy.ops.export_scene.gltf(filepath=${JSON.stringify(glbPath)}, export_format='GLB', use_selection=True)
`;
    const res = await blenderSend({ type: "execute_code", params: { code } }, 120_000);
    if (res.status !== "success" || !existsSync(stlPath) || statSync(stlPath).size === 0)
      throw new Error("rodin export produced no STL");
    return { stlPath, glbPath: existsSync(glbPath) ? glbPath : undefined, textured: existsSync(glbPath), provider: "rodin", live: true };
  },
};
```
- [ ] **Step 3: Export `blenderSend`** — in `src/server/blender.ts:35` change `function blenderSend` → `export function blenderSend`.
- [ ] **Step 4: Live test** (BlenderMCP Connected, Rodin key set): curl the dragon prompt and watch the Blender GUI:
```bash
curl -sN -X POST localhost:3000/api/generate -H 'content-type: application/json' \
  -d '{"prompt":"a chubby sitting dragon with folded wings","engine":"blender"}' \
  | grep -E '"provider"|"kind":"(mesh|summary)"' | head
```
Expected: `generate_mesh … rodin · live · textured`, the dragon appears in Blender, a `mesh` event with `glbUrl`, `summary`. (Hand to Vraj to watch the live build.)
- [ ] **Step 5: tsc + tests** → green. **Commit** — `git commit -am "feat(meshgen): Hyper3D Rodin live provider via BlenderMCP socket"`

---

## Phase 4 — Clarify-first (questions + size→scale fix)

### Task 4.1: `meshScale.ts` — pure STL scale-to-height (fixes 30cm bug)

**Files:** Create `src/server/meshScale.ts`; Test `src/server/__tests__/meshScale.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// src/server/__tests__/meshScale.test.ts
import { describe, it, expect } from "vitest";
import { scaleStlAsciiToHeight } from "../meshScale";
import { parseStlTriangles, boundingBox } from "../printPlan";

// a 10mm cube (z 0..10) in ascii STL
const cube = `solid c
facet normal 0 0 1
outer loop
vertex 0 0 10
vertex 10 0 10
vertex 10 10 10
endloop
endfacet
facet normal 0 0 -1
outer loop
vertex 0 0 0
vertex 10 10 0
vertex 10 0 0
endloop
endfacet
endsolid c`;

describe("scaleStlAsciiToHeight", () => {
  it("scales the Z height to the target mm", () => {
    const out = scaleStlAsciiToHeight(cube, 300);
    const bb = boundingBox(parseStlTriangles(out));
    expect(Math.round(bb.h)).toBe(300);   // 10mm → 300mm
    expect(Math.round(bb.w)).toBe(300);   // uniform scale
  });
  it("returns input unchanged for non-positive target", () => {
    expect(scaleStlAsciiToHeight(cube, 0)).toBe(cube);
  });
});
```
- [ ] **Step 2: Run, expect FAIL.**
- [ ] **Step 3: Implement** — uniform scale so bbox height (Z) = target; multiply only `vertex` lines, leave `facet normal` directions:
```ts
// src/server/meshScale.ts
import { readFile, writeFile } from "node:fs/promises";
import { parseStlTriangles, boundingBox } from "./printPlan";

/** Uniformly scale an ascii STL so its Z-height equals targetMm. Normals (directions) preserved. */
export function scaleStlAsciiToHeight(stl: string, targetMm: number): string {
  if (!(targetMm > 0)) return stl;
  const bb = boundingBox(parseStlTriangles(stl));
  if (!(bb.h > 0)) return stl;
  const k = targetMm / bb.h;
  return stl.replace(/(vertex\s+)(-?[\d.eE+]+)\s+(-?[\d.eE+]+)\s+(-?[\d.eE+]+)/g,
    (_m, p, x, y, z) => `${p}${(+x * k)} ${(+y * k)} ${(+z * k)}`);
}

export async function scaleStlFileToHeight(srcPath: string, targetMm: number, outPath: string): Promise<string> {
  const out = scaleStlAsciiToHeight(await readFile(srcPath, "utf8"), targetMm);
  await writeFile(outPath, out);
  return outPath;
}
```
- [ ] **Step 4: Run tests, expect PASS** + `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `git commit -am "feat(meshgen): pure STL scale-to-height (fixes 30cm size bug)"`

### Task 4.2: Clarify classifier + question heuristic (pure, TDD)

**Files:** Create `src/lib/clarify.ts` (type), `src/server/clarify.ts`; Test `src/server/__tests__/clarify.test.ts`

- [ ] **Step 1: Define the `Question` type** in `src/lib/clarify.ts`:
```ts
// src/lib/clarify.ts
export type PromptClass = "character" | "figure" | "part" | "container" | "generic";
export interface QOption { label: string; /** appended to the prompt as a preference */ value: string }
export interface Question {
  id: string;
  label: string;
  options: QOption[];
  allowFreeText: boolean;
  /** answers to this question that set a target size (mm) instead of a text preference */
  sizeMm?: Record<string, number>;
}
export interface ClarifyResult { promptClass: PromptClass; questions: Question[] }

/** POST the prompt to /api/clarify; never blocks generation (returns empty on failure). */
export async function fetchClarify(prompt: string): Promise<ClarifyResult> {
  try {
    const r = await fetch("/api/clarify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ prompt }) });
    if (!r.ok) return { promptClass: "generic", questions: [] };
    return (await r.json()) as ClarifyResult;
  } catch { return { promptClass: "generic", questions: [] }; }
}
```
- [ ] **Step 2: Write the failing test** for the server heuristic:
```ts
// src/server/__tests__/clarify.test.ts
import { describe, it, expect } from "vitest";
import { classifyPrompt, heuristicQuestions } from "../clarify";

describe("clarify heuristic", () => {
  it("classifies a dragon as a figure and asks skin + the generic size", () => {
    expect(classifyPrompt("a chubby sitting dragon")).toBe("figure");
    const qs = heuristicQuestions("a chubby sitting dragon");
    expect(qs.some(q => /skin|scales|feather/i.test(q.label))).toBe(true);
    expect(qs.some(q => q.id === "size")).toBe(true);   // generic on every prompt
  });
  it("classifies a bracket as a part and asks only size", () => {
    expect(classifyPrompt("a 30mm corner bracket")).toBe("part");
    const qs = heuristicQuestions("a 30mm corner bracket");
    expect(qs.length).toBe(1);
    expect(qs[0].id).toBe("size");
  });
  it("size options map to mm", () => {
    const size = heuristicQuestions("anything").find(q => q.id === "size")!;
    expect(size.sizeMm!["display-size"]).toBeGreaterThan(size.sizeMm!["palm-size"]);
  });
});
```
- [ ] **Step 3: Run, expect FAIL.**
- [ ] **Step 4: Implement `src/server/clarify.ts`** (heuristic; the claude path is best-effort sugar on top):
```ts
// src/server/clarify.ts
import type { PromptClass, Question } from "@/lib/clarify";

const FIGURE = /(dragon|figure|figurine|character|creature|animal|cat|dog|monster|robot|knight|warrior|anime|mascot|kratos)/i;
const NAMED = /\b([A-Z][a-z]+ ?){1,3}\b/; // crude proper-noun hint for "named things"
const PART = /(bracket|mount|holder|clip|hook|gear|spacer|adapter|stand|case|enclosure|knob)/i;
const CONTAINER = /(vase|cup|bowl|box|jar|pot|planter|container|tray)/i;

export function classifyPrompt(p: string): PromptClass {
  if (FIGURE.test(p)) return "figure";
  if (CONTAINER.test(p)) return "container";
  if (PART.test(p)) return "part";
  if (NAMED.test(p.trim())) return "character";
  return "generic";
}

const SIZE: Question = {
  id: "size", label: "About how big?", allowFreeText: true,
  options: [
    { label: "Palm-size", value: "size≈small" },
    { label: "Hand-size", value: "size≈medium" },
    { label: "Display-size", value: "size≈large" },
  ],
  sizeMm: { "size≈small": 60, "size≈medium": 120, "size≈large": 220, "palm-size": 60, "hand-size": 120, "display-size": 220 },
};

export function heuristicQuestions(p: string): Question[] {
  const c = classifyPrompt(p);
  const qs: Question[] = [];
  if (c === "figure" || c === "character") {
    qs.push({ id: "skin", label: "Surface / skin?", allowFreeText: true,
      options: [{ label: "Scales", value: "skin=scales" }, { label: "Smooth", value: "skin=smooth" }, { label: "Feathered", value: "skin=feathered" }, { label: "Furry", value: "skin=furry" }] });
    qs.push({ id: "pose", label: "Pose?", allowFreeText: true,
      options: [{ label: "Sitting", value: "pose=sitting" }, { label: "Standing", value: "pose=standing" }, { label: "Flying", value: "pose=flying" }] });
  }
  qs.push(SIZE); // generic, every prompt
  return qs;
}
```
- [ ] **Step 5: Run tests, expect PASS** + `npx tsc --noEmit`.
- [ ] **Step 6: Commit** — `git commit -am "feat(clarify): prompt classifier + question heuristic (pure, tested)"`

### Task 4.3: `/api/clarify` route

**Files:** Create `src/app/api/clarify/route.ts`

- [ ] **Step 1: Write it** — heuristic immediately; optionally enrich with `claude -p` (best-effort, short timeout) but never block:
```ts
// src/app/api/clarify/route.ts
import { NextResponse } from "next/server";
import { classifyPrompt, heuristicQuestions } from "@/server/clarify";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { prompt = "" } = (await req.json().catch(() => ({}))) as { prompt?: string };
  const promptClass = classifyPrompt(prompt);
  const questions = heuristicQuestions(prompt);
  return NextResponse.json({ promptClass, questions });
}
```
- [ ] **Step 2: Curl it**
```bash
curl -s -X POST localhost:3000/api/clarify -H 'content-type: application/json' -d '{"prompt":"a chubby sitting dragon"}' | head -c 400
```
Expected: JSON with `promptClass:"figure"` and a `skin`, `pose`, `size` question.
- [ ] **Step 3: Commit** — `git commit -am "feat(clarify): /api/clarify route"`

### Task 4.4: `ClarifyCard` + Studio clarify-first flow

**Files:** Create `src/components/ClarifyCard.tsx`; Modify `src/components/Studio.tsx`, `src/lib/agentStream.ts`

- [ ] **Step 1: Build `ClarifyCard`** — a pure props-in component (chips per question + free-text + "Skip"). Uses landing tokens/chip styling already used in Studio. Props:
```ts
export interface ClarifyCardProps {
  questions: Question[];
  onSubmit: (prefs: string[], sizeMm?: number) => void; // prefs = chosen QOption.value[]; sizeMm from the size question
  onSkip: () => void;
}
```
Render each question's options as toggle chips; collect selected `value`s; if the `size` question has a selected option, map it via `question.sizeMm[value]` to `sizeMm`. "Generate" calls `onSubmit(prefs, sizeMm)`; "Skip" calls `onSkip()`.
- [ ] **Step 2: Wire into Studio `submitPrompt`** — before starting the generate stream, for the figure/Blender engine (and any prompt, since the size question is generic), call `fetchClarify(prompt)`; if it returns questions and this isn't a refine-edit, show `ClarifyCard` and PAUSE. On submit, fold prefs into the prompt and pass `sizeMm`:
```ts
// pseudo: inside submitPrompt, non-edit path
const { questions } = await fetchClarify(prompt);
if (questions.length && !isEdit) {
  setClarify({ prompt, engine, questions });   // renders <ClarifyCard/>
  return; // wait for the user
}
// onSubmit(prefs, sizeMm): augment + proceed
const augmented = prefs.length ? `${prompt}\nPreferences: ${prefs.join("; ")}` : prompt;
startGenerate(augmented, engine, { sizeMm });
```
- [ ] **Step 3: Thread `sizeMm` through `playAgentStream`** — add to its body:
```ts
  body: JSON.stringify({ prompt, engine, base: opts?.base, sizeMm: opts?.sizeMm, refImageUrl: opts?.refImageUrl }),
```
and extend `opts?: { base?: string; sizeMm?: number; refImageUrl?: string }`.
- [ ] **Step 4: Eyeball in-app (hand to Vraj):** "a vase 30 cm tall" → pick Display-size or type 30cm → confirm the model comes out ~300 mm and Print Brain shows a **split** with parts. "a dragon" → pick Scales/Sitting → confirms prefs reach generation.
- [ ] **Step 5: tsc + tests** → green. **Commit** — `git commit -am "feat(clarify): ClarifyCard + Studio clarify-first flow + sizeMm passthrough"`

---

## Phase 5 — Search "Make this with AI" (test 4 fix)

### Task 5.1: image→3D regenerate from a search result

**Files:** Modify `src/components/ModelSearchPanel.tsx`, `src/components/Studio.tsx`, `src/lib/agentStream.ts`

- [ ] **Step 1: Add `playMakeWithAiStream`** in `agentStream.ts` — posts to `/api/generate` with the result's thumbnail as `refImageUrl` + title as prompt, engine `"blender"` (so it routes through meshgen image→3D), streaming the same AgentEvents:
```ts
export function playMakeWithAiStream(result: ModelResult, onEvent: (e: AgentEvent) => void): Player {
  return playAgentStream(result.title, "blender", onEvent, { refImageUrl: result.thumbUrl });
}
```
- [ ] **Step 2: Studio `makeWithAi(result)`** — mirror `importModel` but use `playMakeWithAiStream`; save as an `imported`-style version with attribution + `engine:"blender"`/source "ai". Close the search panel.
- [ ] **Step 3: `ModelSearchPanel`** — for every card, add a primary **"✨ Make this with AI"** button calling `onMakeWithAi(result)`; keep "Use this" (direct STL) and "View on {site} ↗" (source link). Add `onMakeWithAi` to its props; pass from Studio.
- [ ] **Step 4: Eyeball (hand to Vraj):** search "claude mascot" → the login-walled Printables result now offers "✨ Make this with AI" → a printable textured version builds in the studio (test 4 no longer a dead end).
- [ ] **Step 5: tsc + tests** → green. **Commit** — `git commit -am "feat(search): Make this with AI (image→3D) for login-walled results (test 4 fix)"`

---

## Phase 6 — Docs + skills

### Task 6.1: find-skills pass

- [ ] **Step 1:** Invoke the `find-skills` skill for Blender/bpy, 3D-generation, and texturing/material skills. Install the clearly-useful ones. Record findings in the spec's "Skills to evaluate" section and in DECISIONS.

### Task 6.2: Update project docs

**Files:** `DESIGN.md`, `docs/ROADMAP.md`, `DECISIONS.md`, `PROGRESS.md`

- [ ] **Step 1: DESIGN.md** — note the viewport now renders a textured GLB preview when present (STL stays the print artifact); ClarifyCard chip component.
- [ ] **Step 2: ROADMAP.md** — flip the meshgen + clarify + "Make with AI" items to done/in-progress; keep Hunyuan3D + Edify-finals + Browserbase-auth-downloads as next.
- [ ] **Step 3: DECISIONS.md** — append `[meshgen]` (provider order Rodin→NIM→procedural, why; GLB preview / STL print split; sizeMm scale fixes the 30cm bug), `[clarify]` (heuristic-first, generic size on every prompt + richer for figures/named), `[search]` ("Make with AI" via image→3D for walled results).
- [ ] **Step 4: PROGRESS.md** — update the top line + DONE entries; set NEXT (Hunyuan3D provider, Edify 4K finals, auth'd live downloads, repair/decimate, GLB in gizmo/forming).
- [ ] **Step 5: Commit** — `git commit -am "docs: meshgen + clarify + make-with-AI (DESIGN/ROADMAP/DECISIONS/PROGRESS)"`

---

## Self-review notes (filled by the author)

- **Spec coverage:** §1 meshgen seam → Phase 1–3. §2 textured preview → Tasks 0.1, 2.3. §3 clarify + size fix → Phase 4. §4 search fix → Phase 5. §5 progress presentation → Task 1.4 (honest steps) + 3.1 (live). Provider matrix/keys → setup header. Skills → Task 6.1.
- **External-shape deferrals (intentional, not placeholders):** NIM endpoint/response (Task 2.2 Step 1 verifies before coding) and Rodin socket `type` strings (Task 3.1 Step 1 verifies from the addon source). These are I/O contracts that must be read from the real source, not invented.
- **Type consistency:** `MeshGenRequest`/`MeshGenResult`/`MeshGenProvider` used identically across `index.ts`, `procedural.ts`, `nim.ts`, `rodin.ts`. `Question`/`ClarifyResult` shared via `src/lib/clarify.ts`. `mesh` event `glbUrl`/`textured` consistent across agentEvent, viewModel, route, viewport, Studio.
- **Fallbacks:** every provider gated + fan-down; clarify never blocks; scale no-ops on bad input; route keeps procedural parity (Task 1.4 verified with no keys).
