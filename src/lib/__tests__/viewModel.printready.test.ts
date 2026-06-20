import { describe, it, expect } from "vitest";
import { reduce, initialViewModel } from "../viewModel";
import type { PrintReadiness } from "../agentEvent";

const readiness: PrintReadiness = {
  score: 90,
  grade: "ready",
  checks: [{ id: "manifold", label: "Watertight", level: "ok", detail: "ok" }],
  orientation: { rotation: { x: 0, y: 0, z: 0 }, label: "as modeled", why: "fine", heightMm: 50, overhangFrac: 0 },
  repairs: [],
  decompose: { strategy: "none", parts: 1, reason: "one piece" },
  formats: [{ format: "3mf", url: "/x/model.3mf", label: "3MF" }],
  bed: { w: 256, d: 256, h: 256, name: "Bambu A1" },
  dimensions: { w: 50, d: 50, h: 50 },
  recipe: {
    modelClass: "functional", layerHeight: 0.20, firstLayerHeight: 0.20,
    infillPercent: 40, infillPattern: "cubic", wallLoops: 3, topLayers: 4, bottomLayers: 4,
    supportStyle: "none", supportAngle: 50, bedTemp: 55, nozzleTemp: 220,
    speed: 80, material: "PLA", brim: false, estimateMinutes: 25, estimateGrams: 12, why: "functional model",
  },
  narrative: "prints in one piece",
};

describe("reduce printready", () => {
  it("stores the readiness package on the view model", () => {
    expect(initialViewModel.readiness).toBeNull();
    const vm = reduce(initialViewModel, { t: "00:00", kind: "printready", readiness });
    expect(vm.readiness).toBe(readiness);
  });
});
