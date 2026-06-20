import { describe, it, expect } from "vitest";
import { classifyFusionBuild, extractFusionParts, EXPORT_TAIL_ASSEMBLY } from "../fusion";

describe("classifyFusionBuild", () => {
  it("routes a multi-component prompt to 'assembly'", () => {
    expect(classifyFusionBuild("a small hinged box with a snap lid")).toBe("assembly");
    expect(classifyFusionBuild("a desk organizer with three drawers")).toBe("assembly");
    expect(classifyFusionBuild("a two-part enclosure with a screw-on cover")).toBe("assembly");
    expect(classifyFusionBuild("a modular phone case")).toBe("assembly");
  });

  it("is case-insensitive", () => {
    expect(classifyFusionBuild("GEARS that mesh together")).toBe("assembly");
    expect(classifyFusionBuild("A Box With A LID")).toBe("assembly");
  });

  it("defaults plain single-part prompts to 'part'", () => {
    expect(classifyFusionBuild("a 40mm cube with a counterbored hole")).toBe("part");
    expect(classifyFusionBuild("a phone stand")).toBe("part");
    expect(classifyFusionBuild("a single spur gear")).toBe("part");
  });

  it("does not false-positive on substrings (solid/valid contain 'lid')", () => {
    expect(classifyFusionBuild("a solid bracket")).toBe("part");
    expect(classifyFusionBuild("a valid M8 bolt")).toBe("part");
  });
});

describe("extractFusionParts", () => {
  it("parses the PARTS_OK json array into name/file entries", () => {
    const msg = 'STL_OK /x/model.stl\nPARTS_OK [{"name": "body", "file": "part_1.stl"}, {"name": "lid", "file": "part_2.stl"}]\n';
    const parts = extractFusionParts(msg);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toEqual({ name: "body", file: "part_1.stl" });
    expect(parts[1].name).toBe("lid");
  });

  it("returns [] when there is no PARTS_OK line (a single part build)", () => {
    expect(extractFusionParts("STL_OK /x/model.stl\n")).toEqual([]);
  });

  it("returns [] on a malformed PARTS_OK payload", () => {
    expect(extractFusionParts("PARTS_OK [not json")).toEqual([]);
  });

  it("drops entries missing name or file", () => {
    const parts = extractFusionParts('PARTS_OK [{"name": "a", "file": "part_1.stl"}, {"oops": 1}]');
    expect(parts).toHaveLength(1);
    expect(parts[0].name).toBe("a");
  });
});

describe("EXPORT_TAIL_ASSEMBLY", () => {
  const tail = EXPORT_TAIL_ASSEMBLY("/tmp/job");

  it("exports the combined model and prints STL_OK", () => {
    expect(tail).toContain("/tmp/job");
    expect(tail).toContain("model.stl");
    expect(tail).toContain("STL_OK");
    expect(tail).toContain("createSTLExportOptions");
  });

  it("loops occurrences and prints a PARTS_OK manifest", () => {
    expect(tail).toContain("occurrences");
    expect(tail).toContain("PARTS_OK");
    expect(tail).toContain("part_");
  });
});
