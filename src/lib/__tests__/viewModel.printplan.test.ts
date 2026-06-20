import { describe, it, expect } from "vitest";
import { reduce, initialViewModel } from "../viewModel";
import type { PrintPlan } from "../agentEvent";

const plan: PrintPlan = {
  dimensions: { w: 10, d: 20, h: 30 }, bed: { w: 220, d: 220, h: 250, name: "x" },
  recommendation: "one_piece", reason: "fits", parts: [{ label: "whole", w: 10, d: 20, h: 30 }],
  seams: [], supports: { needed: false, reason: "none" }, download: { stlUrl: "/x.stl" },
};

describe("reduce printplan", () => {
  it("stores the plan on the view model", () => {
    const vm = reduce(initialViewModel, { t: "00:01", kind: "printplan", plan });
    expect(vm.printPlan).toEqual(plan);
  });
});
