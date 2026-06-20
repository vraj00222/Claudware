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
