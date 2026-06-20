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
