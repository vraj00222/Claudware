import { describe, it, expect } from "vitest";
// wrapStage is exported for testing; it wraps a stage body with clean rebuild + STL export.
import { wrapStage, validateStl, stlExportPy } from "../blender";

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

describe("stlExportPy", () => {
  it("emits the Blender 4.x export with a 3.x fallback (export_mesh.stl)", () => {
    const py = stlExportPy('"/tmp/m.stl"');
    expect(py).toMatch(/bpy\.ops\.wm\.stl_export/);
    expect(py).toMatch(/except Exception:/);
    expect(py).toMatch(/bpy\.ops\.export_mesh\.stl/);
    // 4.x is attempted first; the 3.x fallback comes after
    expect(py.indexOf("wm.stl_export")).toBeLessThan(py.indexOf("export_mesh.stl"));
  });

  it("translates kwargs between the 4.x and 3.x operators", () => {
    const py = stlExportPy('"/tmp/m.stl"', { selected: true, applyModifiers: true, scale: 1.0 });
    expect(py).toMatch(/export_selected_objects=True/); // 4.x selection
    expect(py).toMatch(/use_selection=True/);           // 3.x selection
    expect(py).toMatch(/ascii_format=True/);            // 4.x ascii
    expect(py).toMatch(/ascii=True/);                   // 3.x ascii
    expect(py).toMatch(/apply_modifiers=True/);         // 4.x modifiers
    expect(py).toMatch(/use_mesh_modifiers=True/);      // 3.x modifiers
  });

  it("indents every line for embedding inside a python block", () => {
    const py = stlExportPy('"/tmp/m.stl"', { indent: 4 });
    expect(py.split("\n").every((l) => l.startsWith("    "))).toBe(true);
  });
});

describe("validateStl", () => {
  it("returns false for non-existent file", () => {
    expect(validateStl("/tmp/does_not_exist_abc123.stl")).toBe(false);
  });
});
