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
