import type { AgentEvent, PrintPlan, PrintReadiness, SplitResult } from "./agentEvent";

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
export interface Estimate { grams: number; minutes: number; layers: number; material: string }

export interface ViewModel {
  phase: Phase;
  mode: Mode;
  rows: FeedRow[];
  marker: Marker | null;
  print: PrintState | null;
  /** dynamic print estimate computed from the generated model (null until known) */
  estimate: Estimate | null;
  /** Print Brain readout for the current model (null until the `printplan` event arrives) */
  printPlan: PrintPlan | null;
  /** Print-Readiness v2 package (null until a `printready` event arrives — the "Prepare for print" action) */
  readiness: PrintReadiness | null;
  /** Split-for-print result — the model cut into push-fit parts (null until a `split` event arrives) */
  split: SplitResult | null;
  /** URL of the live mesh to render (set by streamed `mesh` events); null = use fixture */
  meshUrl: string | null;
  /** textured GLB preview URL for meshgen results (null = render the STL geometry) */
  glbUrl: string | null;
  /** whether the current mesh has a textured GLB preview */
  textured: boolean;
  /** step-by-step build progress from `mesh` events */
  stage: number;
  totalStages: number;
  /** internal cursor for the inspect→fix→clean amber band */
  _ep: "idle" | "warned" | "fixing";
}

export const initialViewModel: ViewModel = {
  phase: "boot",
  mode: "parametric",
  rows: [],
  marker: null,
  print: null,
  estimate: null,
  printPlan: null,
  readiness: null,
  split: null,
  meshUrl: null,
  glbUrl: null,
  textured: false,
  stage: 0,
  totalStages: 0,
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
    case "mesh":
      // a freshly-rendered build stage: swap the live mesh and advance the forming reveal
      return { ...vm, phase: "forming", meshUrl: e.url, glbUrl: e.glbUrl ?? null, textured: e.textured ?? false, stage: e.stage, totalStages: e.totalStages };
    case "estimate":
      return { ...vm, estimate: { grams: e.grams, minutes: e.minutes, layers: e.layers, material: e.material } };
    case "printplan":
      return { ...vm, printPlan: e.plan };
    case "printready":
      return { ...vm, readiness: e.readiness };
    case "split":
      return { ...vm, split: e.result };
  }
}

export function reduceAll(vm: ViewModel, events: AgentEvent[]): ViewModel {
  return events.reduce(reduce, vm);
}
