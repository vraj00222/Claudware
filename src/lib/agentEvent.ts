export type ToolName =
  | "write_openscad" | "write_blender" | "write_fusion" | "fusion_build"
  | "generate_mesh" | "repair_mesh" | "add_joints"
  | "render_preview" | "inspect_render" | "validate" | "slice" | "export" | "send_to_printer";

export type ToolStatus = "running" | "done" | "warn" | "error";

export type AgentEvent =
  | { t: string; kind: "plan" | "fix"; text: string }
  | { t: string; kind: "tool"; name: ToolName; status: ToolStatus; detail: string }
  | { t: string; kind: "inspect"; ok: boolean; marker?: { x: number; y: number; z: number; note: string } }
  | { t: string; kind: "print"; printer: string; layer: number; totalLayers: number; etaMin: number }
  | { t: string; kind: "mesh"; url: string; glbUrl?: string; textured?: boolean; label: string; stage: number; totalStages: number }
  // Print Brain: after the final mesh, the manufacturing readout — dimensions (mm), one-piece-vs-split
  // vs the printer bed, supports, and the download URL. Computed server-side from the final STL.
  | { t: string; kind: "printplan"; plan: PrintPlan }
  // Print-Readiness v2 — the result of the per-version "Prepare for print" action (diagnose/orient/export).
  | { t: string; kind: "printready"; readiness: PrintReadiness }
  | { t: string; kind: "estimate"; grams: number; minutes: number; layers: number; material: string }
  // `source`/`engine` carry the final recipe so the client can save it on the version and
  // refine it IN PLACE next time (edit, not regenerate). `meshUrl` is the DURABLE InsForge Storage
  // URL of the finished mesh (survives restarts/redeploys); the per-stage `mesh` events still use
  // the fast local /generated URLs during the build. All optional → back-compatible.
  // `parts` carries the Fusion ASSEMBLY part graph (each printable component + its mesh URL) so the
  // version can persist it — the input Print-Readiness v2's decompose/nest stage consumes. Optional →
  // back-compatible; only multi-component Fusion builds set it.
  | { t: string; kind: "summary"; text: string; source?: string; engine?: "openscad" | "blender" | "fusion" | "nvidia" | "imported"; meshUrl?: string; parts?: { name: string; meshUrl: string }[] };

/** Print Brain v1 readout — measured from the finished mesh; rendered by the Print Plan panel. */
export interface PrintPlan {
  dimensions: { w: number; d: number; h: number };
  bed: { w: number; d: number; h: number; name: string };
  recommendation: "one_piece" | "split";
  reason: string;
  parts: { label: string; w: number; d: number; h: number }[];
  seams: { axis: "x" | "y" | "z"; at: number }[];
  supports: { needed: boolean; reason: string };
  download: { stlUrl: string; storageUrl?: string };
}

/* ───────────────────────── Print-Readiness v2 (the "Prepare for print" package) ─────────────────────────
 * Computed on the per-version "Prepare for print" action, NOT during the build stream. v1's PrintPlan
 * MEASURES; this DIAGNOSES (4 checks) + ORIENTS + decides DECOMPOSE + offers EXPORT formats + a plain
 * "how I'd print it & why" narrative. See docs/superpowers/specs/2026-06-17-print-readiness-pipeline-v2-design.md. */
export type CheckLevel = "ok" | "warn" | "fail";

export interface ReadinessCheck {
  id: "manifold" | "overhang" | "thin" | "floaters";
  label: string;
  level: CheckLevel;
  detail: string;        // plain-language explanation
  metric?: number;       // supporting number (open-edge count, overhang %, shell count, thin-part count)
}

export interface OrientationPlan {
  /** euler degrees to rotate the model before printing (auto-applied per the LOCKED decision) */
  rotation: { x: number; y: number; z: number };
  label: string;         // e.g. "lay it flat on its back"
  why: string;           // plain reason
  heightMm: number;      // resulting z-height (lower → faster print)
  overhangFrac: number;  // resulting overhang fraction (lower → less support)
}

export interface ExportFormat {
  format: "stl" | "obj" | "3mf";
  url: string;
  label: string;         // "STL", "OBJ (keeps color)", "3MF (Bambu A1)"
  bytes?: number;
}

export interface RepairAction {
  id: string;
  label: string;
  applied: boolean;      // P0: structural repairs (thicken/weld) are REPORTED (applied:false) until the Blender pass lands
  detail: string;
}

export type ModelClass = "figurine" | "functional" | "organic" | "mechanical" | "decorative";
export type SupportStyle = "none" | "normal" | "tree";

export interface PrintRecipe {
  modelClass: ModelClass;
  layerHeight: number;        // mm
  firstLayerHeight: number;   // mm
  infillPercent: number;      // 0–100
  infillPattern: string;      // "gyroid" | "grid" | "cubic"
  wallLoops: number;          // perimeter count
  topLayers: number;
  bottomLayers: number;
  supportStyle: SupportStyle;
  supportAngle: number;       // threshold degrees
  bedTemp: number;            // °C
  nozzleTemp: number;         // °C
  speed: number;              // mm/s (outer wall)
  material: string;           // "PLA" | "PETG" etc
  brim: boolean;
  estimateMinutes: number;
  estimateGrams: number;
  why: string;                // plain-language reason for the choices
}

export interface PrintReadiness {
  score: number;         // 0..100
  grade: "ready" | "minor" | "needs_work";
  checks: ReadinessCheck[];
  orientation: OrientationPlan;
  repairs: RepairAction[];
  decompose: { strategy: "none" | "slab" | "parts"; parts: number; reason: string };
  formats: ExportFormat[];
  bed: { w: number; d: number; h: number; name: string };
  dimensions: { w: number; d: number; h: number };
  recipe: PrintRecipe;   // auto-decided print settings (layer height, infill, supports, etc.)
  narrative: string;     // the differentiator: "here's how I'd print this and why"
}

export type ToolEvent = Extract<AgentEvent, { kind: "tool" }>;
export type InspectEvent = Extract<AgentEvent, { kind: "inspect" }>;
export type PrintEvent = Extract<AgentEvent, { kind: "print" }>;
export type MeshEvent = Extract<AgentEvent, { kind: "mesh" }>;

export const isToolEvent = (e: AgentEvent): e is ToolEvent => e.kind === "tool";
export const isInspectEvent = (e: AgentEvent): e is InspectEvent => e.kind === "inspect";
export const isPrintEvent = (e: AgentEvent): e is PrintEvent => e.kind === "print";
export const isMeshEvent = (e: AgentEvent): e is MeshEvent => e.kind === "mesh";
