import { describe, it, expect, afterEach } from "vitest";
import { parseGcodeEstimate, buildSlicerArgs, slicerAvailable, sliceStl, type SliceRecipe } from "@/server/slicer";
import { resolveSlicerBin } from "@/server/bin";
import { BAMBU_A1 } from "@/server/printReady/bed";

// ── fixtures: the trailing comment block real slicers append to their G-code ──

// PrusaSlicer / Slic3r, WITH a configured filament density (reports grams directly).
const PRUSA_GCODE = `
G1 X10 Y10 E1.2
; filament used [mm] = 1168.47
; filament used [cm3] = 2.81
; filament used [g] = 3.49
; total filament used [g] = 3.49
; total filament cost = 0.00
; estimated printing time (normal mode) = 24m 33s
; estimated printing time (silent mode) = 30m 10s
`;

// PrusaSlicer with NO filament density (grams = 0.00 → must be derived from [cm3]); longer h+m+s time.
const PRUSA_NO_DENSITY = `
; filament used [mm] = 5000.0
; filament used [cm3] = 12.10
; total filament used [g] = 0.00
; estimated printing time (normal mode) = 1h 23m 4s
`;

// CuraEngine: seconds for time, meters of filament (no grams) → grams derived from length + density.
const CURA_GCODE = `
;FLAVOR:Marlin
;TIME:4980
;Filament used: 1.23456m
;LAYER_COUNT:120
`;

describe("parseGcodeEstimate", () => {
  it("parses PrusaSlicer time (prefers normal mode) and reported grams", () => {
    const r = parseGcodeEstimate(PRUSA_GCODE);
    expect(r.estimateMinutes).toBe(25); // 24m33s → 1473s → 24.55 → 25
    expect(r.filamentGrams).toBeCloseTo(3.5, 1);
    expect(r.filamentMeters).toBeCloseTo(1.168, 2);
  });

  it("derives grams from [cm3] when PrusaSlicer reports 0g (no density configured)", () => {
    const r = parseGcodeEstimate(PRUSA_NO_DENSITY, { densityGramsPerCm3: 1.24 });
    expect(r.estimateMinutes).toBe(83); // 1h23m4s = 4984s → 83.07 → 83
    expect(r.filamentGrams).toBeCloseTo(12.1 * 1.24, 1); // ≈15.0
    expect(r.filamentMeters).toBeCloseTo(5.0, 2);
  });

  it("parses CuraEngine ;TIME: seconds and derives grams from meters + density", () => {
    const r = parseGcodeEstimate(CURA_GCODE, { densityGramsPerCm3: 1.24, filamentDiameterMm: 1.75 });
    expect(r.estimateMinutes).toBe(83); // 4980s → 83
    expect(r.filamentMeters).toBeCloseTo(1.23456, 4);
    // 1.23456m of 1.75mm filament → π*(0.875)^2 * 1234.56 mm³ ≈ 2.969 cm³ → ×1.24 ≈ 3.68g
    expect(r.filamentGrams).toBeCloseTo(3.68, 1);
  });

  it("parses day/hour formats and sums multi-extruder Cura filament", () => {
    expect(parseGcodeEstimate("; estimated printing time (normal mode) = 2d 3h 5m 10s").estimateMinutes)
      .toBe(Math.round((2 * 86400 + 3 * 3600 + 5 * 60 + 10) / 60));
    const multi = parseGcodeEstimate(";Filament used: 1.2m, 0.8m\n;TIME:60");
    expect(multi.filamentMeters).toBeCloseTo(2.0, 4);
  });

  it("returns all-undefined for G-code with no estimate comments", () => {
    const r = parseGcodeEstimate("G1 X0 Y0\nG1 X1 Y1\n");
    expect(r.estimateMinutes).toBeUndefined();
    expect(r.filamentGrams).toBeUndefined();
    expect(r.filamentMeters).toBeUndefined();
  });
});

const RECIPE: SliceRecipe = {
  layerHeight: 0.12, firstLayerHeight: 0.2, infillPercent: 15, infillPattern: "gyroid",
  wallLoops: 2, topLayers: 7, bottomLayers: 7, supportStyle: "tree", supportAngle: 45,
  bedTemp: 55, nozzleTemp: 220, material: "PLA", brim: false,
};

describe("buildSlicerArgs", () => {
  it("maps the recipe to PrusaSlicer flags with the STL last", () => {
    const args = buildSlicerArgs(RECIPE, BAMBU_A1, "/tmp/out.gcode", "/tmp/in.stl");
    expect(args[0]).toBe("--export-gcode");
    expect(args).toEqual(expect.arrayContaining(["--layer-height", "0.12", "--fill-density", "15%", "--fill-pattern", "gyroid", "--perimeters", "2"]));
    expect(args).toEqual(expect.arrayContaining(["--support-material", "--support-material-style", "snug"]));
    expect(args.slice(-2)).toEqual(["/tmp/out.gcode", "/tmp/in.stl"]);
  });

  it("omits support flags when supports are off, and falls back unknown fill patterns to gyroid", () => {
    const args = buildSlicerArgs({ ...RECIPE, supportStyle: "none", infillPattern: "weird" }, BAMBU_A1, "/o.gcode", "/i.stl");
    expect(args).not.toContain("--support-material");
    const idx = args.indexOf("--fill-pattern");
    expect(args[idx + 1]).toBe("gyroid");
  });

  it("uses grid towers for normal supports", () => {
    const args = buildSlicerArgs({ ...RECIPE, supportStyle: "normal" }, BAMBU_A1, "/o.gcode", "/i.stl");
    expect(args).toEqual(expect.arrayContaining(["--support-material-style", "grid"]));
  });
});

describe("slicerAvailable (env flag gate)", () => {
  afterEach(() => { delete process.env.ENABLE_SLICER; delete process.env.SLICER_ENABLED; });

  it("is forced off when ENABLE_SLICER is a falsey flag", () => {
    process.env.ENABLE_SLICER = "false";
    expect(slicerAvailable()).toBe(false);
    process.env.ENABLE_SLICER = "0";
    expect(slicerAvailable()).toBe(false);
  });
});

describe("sliceStl (never throws; clean fallback)", () => {
  afterEach(() => { delete process.env.SLICER_BIN; });

  it("returns ok:false (not throw) for a missing STL", async () => {
    const r = await sliceStl("/definitely/missing.stl", RECIPE, BAMBU_A1, { timeoutMs: 1000 });
    expect(r.ok).toBe(false);
    expect(r.gcodePath).toBeUndefined();
    expect(typeof r.error).toBe("string");
  });

  it("reports the not-available signal cleanly when no slicer resolves", async () => {
    // Environment-agnostic: on a box WITHOUT a slicer, the error is the "not available" signal; on a box
    // WITH one installed (via candidate paths), it falls through to the STL-missing error. Both are clean
    // ok:false (never a throw), which is the contract callers depend on for graceful fallback.
    const r = await sliceStl("/whatever.stl", RECIPE, BAMBU_A1, { timeoutMs: 1000 });
    expect(r.ok).toBe(false);
    if (resolveSlicerBin() === null) expect(r.error).toBe("slicer not available");
    else expect(typeof r.error).toBe("string");
  });
});
