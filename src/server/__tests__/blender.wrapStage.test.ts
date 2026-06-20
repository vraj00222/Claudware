import { describe, it, expect } from "vitest";
// wrapStage is exported for testing; it wraps a stage body with clean rebuild + STL export.
import { wrapStage } from "../blender";

describe("wrapStage", () => {
  it("recalculates outward normals before STL export (roof-visible-in-r3f fix)", () => {
    const py = wrapStage("bpy.ops.mesh.primitive_cube_add()", "/tmp/x.stl");
    expect(py).toMatch(/normals_make_consistent/);
    // normals must be fixed BEFORE the export call
    expect(py.indexOf("normals_make_consistent")).toBeLessThan(py.indexOf("stl_export"));
  });
});
