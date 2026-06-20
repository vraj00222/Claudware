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
