import { describe, it, expect } from "vitest";
// wrapStage is exported for testing; it wraps a stage body with clean rebuild + STL export.
import { wrapStage, validateStl } from "../blender";

describe("wrapStage", () => {
  it("recalculates outward normals before STL export (roof-visible-in-r3f fix)", () => {
    const py = wrapStage("bpy.ops.mesh.primitive_cube_add()", "/tmp/x.stl");
    expect(py).toMatch(/normals_make_consistent/);
    // normals must be fixed BEFORE the export call
    expect(py.indexOf("normals_make_consistent")).toBeLessThan(py.indexOf("stl_export"));
  });

  it("non-final stage does NOT include join/ground cleanup", () => {
    const py = wrapStage("bpy.ops.mesh.primitive_cube_add()", "/tmp/x.stl", false);
    expect(py).not.toMatch(/FINAL STAGE/);
    expect(py).not.toMatch(/object\.join/);
    expect(py).not.toMatch(/fill_holes/);
  });

  it("final stage includes join + ground + manifold cleanup", () => {
    const py = wrapStage("bpy.ops.mesh.primitive_cube_add()", "/tmp/x.stl", true);
    expect(py).toMatch(/FINAL STAGE/);
    expect(py).toMatch(/object\.join/);
    expect(py).toMatch(/remove_doubles/);
    expect(py).toMatch(/fill_holes/);
    expect(py).toMatch(/_min_z/);
    // join must happen BEFORE normals + export
    expect(py.indexOf("object.join")).toBeLessThan(py.indexOf("normals_make_consistent"));
    expect(py.indexOf("normals_make_consistent")).toBeLessThan(py.indexOf("stl_export"));
  });
});

describe("validateStl", () => {
  it("returns false for non-existent file", () => {
    expect(validateStl("/tmp/does_not_exist_abc123.stl")).toBe(false);
  });
});
