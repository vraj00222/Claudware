import { describe, it, expect } from "vitest";
import { parseSizeEdit } from "../sizeEdit";

describe("parseSizeEdit", () => {
  it("relative smaller/bigger with intensifier", () => {
    expect(parseSizeEdit("make it smaller")).toEqual({ kind: "factor", factor: 0.8 });
    expect(parseSizeEdit("a bit smaller")).toEqual({ kind: "factor", factor: 0.8 });
    expect(parseSizeEdit("much smaller")).toEqual({ kind: "factor", factor: 0.6 });
    expect(parseSizeEdit("make it bigger")).toEqual({ kind: "factor", factor: 1.3 });
    expect(parseSizeEdit("way larger")).toEqual({ kind: "factor", factor: 1.6 });
  });
  it("multipliers and half", () => {
    expect(parseSizeEdit("twice as big")).toEqual({ kind: "factor", factor: 2 });
    expect(parseSizeEdit("double it")).toEqual({ kind: "factor", factor: 2 });
    expect(parseSizeEdit("half the size")).toEqual({ kind: "factor", factor: 0.5 });
    expect(parseSizeEdit("3x")).toEqual({ kind: "factor", factor: 3 });
  });
  it("percentages", () => {
    expect(parseSizeEdit("20% bigger")).toEqual({ kind: "factor", factor: 1.2 });
    expect(parseSizeEdit("30 percent smaller")).toEqual({ kind: "factor", factor: 0.7 });
  });
  it("absolute heights in mm/cm/inch", () => {
    expect(parseSizeEdit("make it 80mm tall")).toEqual({ kind: "height", mm: 80 });
    expect(parseSizeEdit("12 cm")).toEqual({ kind: "height", mm: 120 });
    expect(parseSizeEdit('5"')).toEqual({ kind: "height", mm: 127 });
  });
  it("returns null for mixed edits (needs regeneration) and non-size prompts", () => {
    expect(parseSizeEdit("make it a bit smaller and write my name on the handle")).toBeNull();
    expect(parseSizeEdit("smaller with a hat")).toBeNull();
    expect(parseSizeEdit("add wings")).toBeNull();
    expect(parseSizeEdit("a chubby sitting dragon")).toBeNull();
  });
});
