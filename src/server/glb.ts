import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { BLENDER_BIN as BLENDER } from "./bin";

const execFileP = promisify(execFile);

/**
 * Import a .glb, AUTO-CLEAN it for printing, and export an ascii STL (Z-up, so estimateFromStl/
 * buildPrintPlan parse it). Cleanup = join all meshes → merge-by-distance (weld doubles) → recalc
 * OUTWARD normals → decimate when very dense (>200k tris, keeps prints/files sane). Runs headless
 * Blender in a subprocess with a timeout — turns a cloud meshgen GLB (NVIDIA NIM) into a cleaner,
 * more printable STL while the original GLB stays the textured preview.
 */
export async function glbToStl(glbPath: string, stlPath: string, timeoutMs = 150_000): Promise<string> {
  const py = `import bpy
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
bpy.ops.import_scene.gltf(filepath=${JSON.stringify(glbPath)})
ms = [o for o in bpy.data.objects if o.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
for o in ms:
    o.select_set(True)
if not ms:
    print('STL_EMPTY')
else:
    bpy.context.view_layer.objects.active = ms[0]
    # join all parts into one object
    if len(ms) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    # ----- auto-cleanup for printability -----
    try:
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.remove_doubles(threshold=0.0001)        # weld coincident verts (watertight-er)
        bpy.ops.mesh.normals_make_consistent(inside=False)   # outward normals (no dark/invisible faces)
        bpy.ops.object.mode_set(mode='OBJECT')
    except Exception as e:
        print('CLEAN_WARN', e)
    # decimate only if extremely dense (preserves NVIDIA detail — the old 0.2 ratio destroyed figures)
    try:
        n = len(obj.data.polygons)
        if n > 500000:
            mod = obj.modifiers.new('dec', 'DECIMATE')
            mod.ratio = max(0.5, 350000.0 / n)
            bpy.ops.object.modifier_apply(modifier=mod.name)
            print('DECIMATED', n, '->', len(obj.data.polygons))
    except Exception as e:
        print('DECIMATE_WARN', e)
    # Smooth the mesh slightly to reduce staircase artifacts from TRELLIS voxel output
    try:
        mod_s = obj.modifiers.new('smooth', 'SMOOTH')
        mod_s.iterations = 2
        mod_s.factor = 0.3
        bpy.ops.object.modifier_apply(modifier=mod_s.name)
    except Exception as e:
        print('SMOOTH_WARN', e)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.wm.stl_export(filepath=${JSON.stringify(stlPath)}, export_selected_objects=True, ascii_format=True, up_axis='Z', forward_axis='Y')
    print('STL_OK')
`;
  const pyPath = path.join(path.dirname(stlPath), "glb2stl.py");
  await writeFile(pyPath, py);
  await execFileP(BLENDER, ["--background", "--factory-startup", "--python", pyPath], { timeout: timeoutMs, maxBuffer: 32 << 20 });
  if (!existsSync(stlPath) || statSync(stlPath).size === 0) throw new Error("glbToStl produced no STL");
  return stlPath;
}
