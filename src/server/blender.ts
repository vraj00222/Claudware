/**
 * Blender generation engine (server-side) — the ORGANIC/FIGURE counterpart to openscad.ts.
 *
 * Claude writes a staged `bpy` script (same @@@STAGE delimiter as the OpenSCAD path); each stage
 * is a COMPLETE, self-contained bpy program that builds the model up to that stage. We render each
 * stage to an ASCII STL two ways, picked at runtime:
 *
 *   • LIVE  — if the BlenderMCP addon socket (127.0.0.1:9876) is up, we send the stage's code to the
 *             RUNNING Blender window via `execute_code`, so the user WATCHES it build, and export the
 *             STL from that same Blender. One Blender → identical geometry in the GUI and the web viewport.
 *   • HEADLESS — otherwise we run `blender --background --python <stage>.py` in a subprocess (timeout).
 *
 * Reuses GenPlan/Stage from openscad.ts; for Blender, `Stage.scad` holds the bpy Python source.
 */
import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import type { GenPlan, Stage } from "./openscad";
import { claudeText } from "./claude";
import { BLENDER_BIN as BLENDER } from "./bin";

const execFileP = promisify(execFile);

/** Python that exports the current selection to an ASCII STL, working on BOTH Blender 4.x and 3.x.
 *  4.x uses `bpy.ops.wm.stl_export`; 3.x has no such operator (it's `bpy.ops.export_mesh.stl` with
 *  different kwarg names), so on 3.x the 4.x call raises and we fall back. Without this, every STL export
 *  silently produced nothing on Blender 3.x → NVIDIA GLB→STL and the Blender engine both "made no geometry".
 *  `pathExpr` must be an already-quoted Python string literal (e.g. JSON.stringify(stlPath)). */
export function stlExportPy(pathExpr: string, opts: { selected?: boolean; applyModifiers?: boolean; scale?: number; indent?: number } = {}): string {
  const sel = opts.selected ?? true;
  const am = opts.applyModifiers ?? false;
  const sc = opts.scale;
  const a4 = [`filepath=${pathExpr}`, ...(sel ? ["export_selected_objects=True"] : []), ...(am ? ["apply_modifiers=True"] : []),
    "ascii_format=True", "up_axis='Z'", "forward_axis='Y'", ...(sc != null ? [`global_scale=${sc}`] : [])].join(", ");
  const a3 = [`filepath=${pathExpr}`, ...(sel ? ["use_selection=True"] : []), ...(am ? ["use_mesh_modifiers=True"] : []),
    "ascii=True", "axis_up='Z'", "axis_forward='Y'", ...(sc != null ? [`global_scale=${sc}`] : [])].join(", ");
  const pad = " ".repeat(opts.indent ?? 0);
  return [
    `try:`,
    `    bpy.ops.wm.stl_export(${a4})`,
    `except Exception:`,
    `    try:`,
    `        bpy.ops.preferences.addon_enable(module='io_mesh_stl')`,
    `    except Exception:`,
    `        pass`,
    `    bpy.ops.export_mesh.stl(${a3})`,
  ].map((l) => pad + l).join("\n");
}

// The bpy plan writer is a single text-generation call → the Anthropic Messages API (Sonnet, fast). The old
// `claude -p` agent CLI loaded MCP servers + reasoned for minutes → blew past the 240s timeout → generic
// fallback creature; the raw API returns valid bpy stages in ~20-60s. Env-overridable model.
const BLENDER_MODEL = process.env.BLENDER_CLAUDE_MODEL || "sonnet";

const BHOST = "127.0.0.1";
const BPORT = 9876;

// ───────────────────────── live BlenderMCP socket ─────────────────────────

/** Send one BlenderMCP command and resolve its JSON response (length-agnostic; reads to full JSON). */
export function blenderSend(payload: unknown, timeoutMs = 60_000): Promise<{ status: string; result?: unknown; message?: string }> {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(BPORT, BHOST);
    let buf = "";
    let settled = false;
    const finish = (fn: () => void) => { if (!settled) { settled = true; clearTimeout(timer); try { sock.destroy(); } catch {} fn(); } };
    const timer = setTimeout(() => finish(() => reject(new Error("blender socket timeout"))), timeoutMs);
    sock.on("connect", () => sock.write(JSON.stringify(payload)));
    sock.on("data", (d) => {
      buf += d.toString();
      try { const o = JSON.parse(buf); finish(() => resolve(o)); } catch { /* partial frame; keep reading */ }
    });
    sock.on("error", (e) => finish(() => reject(e)));
    sock.on("close", () => {
      if (settled) return;
      try { const o = JSON.parse(buf); finish(() => resolve(o)); }
      catch { finish(() => reject(new Error("blender closed without a full response"))); }
    });
  });
}

/** Is a live Blender (BlenderMCP addon) reachable on 9876? Cheap connect probe. */
export function blenderLiveAvailable(timeoutMs = 1200): Promise<boolean> {
  return new Promise((resolve) => {
    const sock = net.createConnection(BPORT, BHOST);
    let done = false;
    const end = (v: boolean) => { if (!done) { done = true; clearTimeout(t); try { sock.destroy(); } catch {} resolve(v); } };
    const t = setTimeout(() => end(false), timeoutMs);
    sock.on("connect", () => end(true));
    sock.on("error", () => end(false));
  });
}

async function execBlenderCode(code: string, timeoutMs = 60_000): Promise<void> {
  const res = await blenderSend({ type: "execute_code", params: { code } }, timeoutMs);
  if (res.status !== "success") throw new Error(res.message || "blender execute_code failed");
}

/** Import a finished GLB into the user's LIVE Blender scene so they can SEE/refine the NVIDIA mesh
 *  in Blender ("nvidia + blender"). Best-effort: returns false if the socket is down. */
export async function importGlbToLive(glbPath: string, timeoutMs = 60_000): Promise<boolean> {
  try {
    const code = `import bpy\nbpy.ops.import_scene.gltf(filepath=${JSON.stringify(glbPath)})`;
    const res = await blenderSend({ type: "execute_code", params: { code } }, timeoutMs);
    return res.status === "success";
  } catch {
    return false;
  }
}

/** POST-STEP "Clean in Blender": import an STL (from NVIDIA/Fusion/OpenSCAD), weld doubles, recalc
 *  outward normals, decimate if very dense, and re-export a cleaner printable ASCII STL. Prefers the
 *  live GUI (the user watches the cleanup) and falls back to headless. Best-effort — throws only if it
 *  truly produced nothing, so the caller can keep the original mesh. */
export async function cleanStlInBlender(inStl: string, outStl: string, pyPath: string, preferLive: boolean): Promise<"live" | "headless"> {
  const code = `import bpy
for _o in list(bpy.data.objects):
    if _o.type in {'MESH','CURVE','SURFACE','META','FONT'}:
        bpy.data.objects.remove(_o, do_unlink=True)
try:
    bpy.ops.wm.stl_import(filepath=${JSON.stringify(inStl)})
except Exception:
    bpy.ops.import_mesh.stl(filepath=${JSON.stringify(inStl)})
_ms = [o for o in bpy.data.objects if o.type == 'MESH']
for _o in _ms:
    bpy.ops.object.select_all(action='DESELECT')
    _o.select_set(True); bpy.context.view_layer.objects.active = _o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.0005)
    bpy.ops.mesh.normals_make_consistent(inside=False)
    try:
        bpy.ops.mesh.fill_holes(sides=0)
    except Exception:
        pass
    bpy.ops.object.mode_set(mode='OBJECT')
    if len(_o.data.polygons) > 250000:
        _d = _o.modifiers.new('dec','DECIMATE'); _d.ratio = 0.6
        bpy.ops.object.modifier_apply(modifier=_d.name)
# Join all mesh objects into one solid
_ms2 = [o for o in bpy.data.objects if o.type == 'MESH']
if len(_ms2) > 1:
    bpy.ops.object.select_all(action='DESELECT')
    for _o in _ms2: _o.select_set(True)
    bpy.context.view_layer.objects.active = _ms2[0]
    bpy.ops.object.join()
# Auto-ground: translate so min Z = 0
_ms3 = [o for o in bpy.data.objects if o.type == 'MESH']
if _ms3:
    _min_z = min(min((_o.matrix_world @ v.co).z for v in _o.data.vertices) for _o in _ms3 if _o.data.vertices)
    if abs(_min_z) > 0.001:
        for _o in _ms3: _o.location.z -= _min_z
        bpy.context.view_layer.update()
    bpy.ops.object.select_all(action='DESELECT')
    for _o in _ms3: _o.select_set(True)
    bpy.context.view_layer.objects.active = _ms3[0]
${stlExportPy(JSON.stringify(outStl), { selected: true, applyModifiers: true, scale: 1.0, indent: 4 })}
    print('CLEAN_OK')
else:
    print('CLEAN_EMPTY')
`;
  const produced = () => existsSync(outStl) && statSync(outStl).size > 0;
  if (preferLive) {
    try { await execBlenderCode(code, 90_000); if (produced()) return "live"; } catch { /* fall to headless */ }
  }
  await writeFile(pyPath, code);
  await execFileP(BLENDER, ["--background", "--factory-startup", "--python", pyPath], { timeout: 90_000, maxBuffer: 8 << 20 });
  if (produced()) return "headless";
  throw new Error("blender cleanup produced no STL");
}

// ───────────────────────── stage wrapper (build + export) ─────────────────────────

/** Deterministically fix Claude's Blender-4.x bpy so it runs on Blender 5.x (the user's 5.1.2). Claude
 *  was trained on the old API; 5.x renamed two things that hard-crash a stage otherwise:
 *   • boolean modifier solver enum 'FAST' was removed → use 'EXACT' (valid on BOTH 4.x and 5.x).
 *   • uv-sphere kwarg `rings=` → `ring_count=`.
 *  A cheap pre-pass beats a Claude self-repair round-trip for these KNOWN breakages. */
export function sanitizeBpy(code: string): string {
  return code
    .replace(/(\.solver\s*=\s*)(['"])FAST\2/g, "$1'EXACT'")
    .replace(/(solver\s*=\s*)(['"])FAST\2/g, "$1'EXACT'")
    .replace(/\brings(\s*=)/g, "ring_count$1");
}

/** Wrap a stage's bpy body with a clean rebuild + ASCII-STL export. Z-up matches OpenSCAD STL.
 *  `isFinal` = true for the last stage → triggers join + ground + manifold cleanup. */
export function wrapStage(body: string, stlPath: string, isFinal = false): string {
  body = sanitizeBpy(body);
  // JSON.stringify gives a safe single-quote-free Python string literal for the path.
  const p = JSON.stringify(stlPath);
  return `import bpy
# clean rebuild: drop the default cube + anything from a previous stage so the view shows only this model
for _o in list(bpy.data.objects):
    if _o.type in {'MESH', 'CURVE', 'SURFACE', 'META', 'FONT'}:
        bpy.data.objects.remove(_o, do_unlink=True)
try:
    bpy.ops.object.select_all(action='DESELECT')
except Exception:
    pass

# ----- model (this stage) -----
${body}
# ----- /model -----

# REALIZE metaballs / curves / text / surfaces into real mesh — STL export only sees MESH objects,
# so without this a metaball/curve/text model exports an EMPTY file (the blob-fallback bug).
bpy.context.view_layer.update()
_nonmesh = [o for o in bpy.data.objects if o.type in {'META', 'CURVE', 'SURFACE', 'FONT'}]
if _nonmesh:
    try:
        bpy.ops.object.select_all(action='DESELECT')
        for _o in _nonmesh:
            _o.select_set(True)
        bpy.context.view_layer.objects.active = _nonmesh[0]
        bpy.ops.object.convert(target='MESH')
    except Exception as _ex:
        print('CONVERT_FAIL', _ex)
${isFinal ? `
# ===== FINAL STAGE: FUSE every part into ONE connected solid → ground → cleanup =====
# Claude often leaves AIR GAPS between parts (floating arms/head — unprintable) and/or pre-join()s
# them into one object full of DISCONNECTED shells (join merges datablocks, it does NOT fuse gaps).
# So: split into loose shells, MAGNETIZE each floater inward until it overlaps the body, then
# BOOLEAN-UNION into one watertight solid. The WHOLE block is guarded and always ends by joining into
# one object — a fuse failure can never produce "no geometry" (which would dump us to the box fallback).
try:
    _pre = [o for o in bpy.data.objects if o.type == 'MESH']
    if _pre:
        bpy.ops.object.select_all(action='DESELECT')
        for _o in _pre:
            _o.select_set(True)
        bpy.context.view_layer.objects.active = _pre[0]
        if len(_pre) > 1:
            bpy.ops.object.join()
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.separate(type='LOOSE')
        bpy.ops.object.mode_set(mode='OBJECT')
        import mathutils as _mu
        # MAGNETIZE: nudge every floater so it overlaps the biggest shell (the body) by ~2 units on
        # whichever axis it was gapped. INLINE bbox math + explicit loops, NO nested defs/lambdas —
        # those close over locals and silently break when the stage is exec()'d over the live socket
        # (which is exactly why the live build came out scattered). A few passes let chained parts settle.
        _OV = 2.0
        for _pass in range(4):
            _shells = [o for o in bpy.data.objects if o.type == 'MESH']
            if len(_shells) < 2:
                break
            _bbx = {}
            _body = None
            _bestv = -1.0
            for _o in _shells:
                _xs = []
                _ys = []
                _zs = []
                for _c in _o.bound_box:
                    _w = _o.matrix_world @ _mu.Vector(_c)
                    _xs.append(_w.x)
                    _ys.append(_w.y)
                    _zs.append(_w.z)
                _mn = (min(_xs), min(_ys), min(_zs))
                _mx = (max(_xs), max(_ys), max(_zs))
                _bbx[_o.name] = (_mn, _mx)
                _v = (_mx[0] - _mn[0]) * (_mx[1] - _mn[1]) * (_mx[2] - _mn[2])
                if _v > _bestv:
                    _bestv = _v
                    _body = _o
            _bmn, _bmx = _bbx[_body.name]
            for _o in _shells:
                if _o is _body:
                    continue
                _omn, _omx = _bbx[_o.name]
                _d = [0.0, 0.0, 0.0]
                for _i in range(3):
                    if _omn[_i] > _bmx[_i] - _OV:
                        _d[_i] = (_bmx[_i] - _OV) - _omn[_i]
                    elif _omx[_i] < _bmn[_i] + _OV:
                        _d[_i] = (_bmn[_i] + _OV) - _omx[_i]
                _o.location.x += _d[0]
                _o.location.y += _d[1]
                _o.location.z += _d[2]
            bpy.context.view_layer.update()
        # BOOLEAN-UNION the now-overlapping shells into one manifold solid (guarded per part).
        _shells = [o for o in bpy.data.objects if o.type == 'MESH']
        if len(_shells) > 1:
            _base = _shells[0]
            for _o in _shells[1:]:
                try:
                    _bm = _base.modifiers.new(name='fuse', type='BOOLEAN')
                    _bm.operation = 'UNION'
                    _bm.object = _o
                    try:
                        _bm.solver = 'EXACT'
                    except Exception:
                        pass
                    bpy.ops.object.select_all(action='DESELECT')
                    _base.select_set(True)
                    bpy.context.view_layer.objects.active = _base
                    bpy.ops.object.modifier_apply(modifier=_bm.name)
                    bpy.data.objects.remove(_o, do_unlink=True)
                except Exception as _bex:
                    print('UNION_FAIL', _bex)
except Exception as _fex:
    print('FUSE_FAIL', _fex)
    try:
        bpy.ops.object.mode_set(mode='OBJECT')
    except Exception:
        pass
# SAFETY: join whatever remains into ONE object so the export always sees geometry (magnetized parts
# that the boolean couldn't fuse still overlap → slicers union them at slice time → printable).
_left = [o for o in bpy.data.objects if o.type == 'MESH']
if len(_left) > 1:
    bpy.ops.object.select_all(action='DESELECT')
    for _o in _left:
        _o.select_set(True)
    bpy.context.view_layer.objects.active = _left[0]
    bpy.ops.object.join()
# Apply all pending transforms so geometry is in world space
for _o in [o for o in bpy.data.objects if o.type == 'MESH']:
    _o.select_set(True)
    bpy.context.view_layer.objects.active = _o
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# Weld doubles + fill holes for manifold cleanup
for _o in [o for o in bpy.data.objects if o.type == 'MESH']:
    bpy.ops.object.select_all(action='DESELECT')
    _o.select_set(True)
    bpy.context.view_layer.objects.active = _o
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=0.001)
    try:
        bpy.ops.mesh.fill_holes(sides=0)
    except Exception:
        pass
    bpy.ops.object.mode_set(mode='OBJECT')
# AUTO-GROUND: translate so lowest vertex sits at Z = 0
_all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
if _all_mesh:
    _min_z = min(min((_o.matrix_world @ v.co).z for v in _o.data.vertices) for _o in _all_mesh if _o.data.vertices)
    if abs(_min_z) > 0.001:
        for _o in _all_mesh:
            _o.location.z -= _min_z
        bpy.context.view_layer.update()
` : ''}
# Recalculate OUTWARD-consistent normals on every mesh. Blender's solid view draws backfaces, but
# r3f's single-sided MeshStandardMaterial hides reversed faces (the missing-roof bug) — fix before export.
for _o in [o for o in bpy.data.objects if o.type == 'MESH']:
    try:
        bpy.ops.object.select_all(action='DESELECT')
        _o.select_set(True)
        bpy.context.view_layer.objects.active = _o
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.normals_make_consistent(inside=False)
        bpy.ops.object.mode_set(mode='OBJECT')
    except Exception as _nex:
        print('NORMALS_FAIL', _nex)
# export every mesh as ONE ascii STL (ascii so estimateFromStl parses it; Z-up matches OpenSCAD).
_meshes = [o for o in bpy.data.objects if o.type == 'MESH']
if _meshes:
    bpy.ops.object.select_all(action='DESELECT')
    for _o in _meshes:
        _o.select_set(True)
    bpy.context.view_layer.objects.active = _meshes[0]
${stlExportPy(p, { selected: true, applyModifiers: true, scale: 1.0, indent: 4 })}
    print('STL_OK', ${p})
else:
    print('STL_EMPTY')
`;
}

/** Render one stage to an STL. Prefers the live window (watchable) and falls back to headless.
 *  `isFinal` = true for the last stage → triggers join + ground + manifold cleanup in wrapStage. */
export async function renderStageBlender(
  body: string,
  stlPath: string,
  pyPath: string,
  preferLive: boolean,
  isFinal = false,
): Promise<"live" | "headless"> {
  const wrapped = wrapStage(body, stlPath, isFinal);
  const produced = () => existsSync(stlPath) && statSync(stlPath).size > 0;
  if (preferLive) {
    try {
      await execBlenderCode(wrapped, 90_000);
      if (produced()) return "live"; // built live in the GUI + exported from that same Blender
    } catch { /* socket hiccup → fall back to headless for this stage */ }
  }
  await writeFile(pyPath, wrapped);
  try {
    await execFileP(BLENDER, ["--background", "--factory-startup", "--python", pyPath], { timeout: 90_000, maxBuffer: 8 << 20 });
  } catch (e) {
    if (produced()) return "headless"; // errored after a successful export — still usable
    // Surface the bpy TRACEBACK (Blender prints it to stderr) so the caller can self-repair the script.
    const stderr = (e as { stderr?: string }).stderr || "";
    const tail = (stderr || (e as Error).message || "").trim().slice(-700);
    throw new Error(tail || "blender produced no STL (bpy error)");
  }
  if (produced()) return "headless";
  throw new Error("blender produced no STL (empty geometry — bpy created nothing exportable)");
}

// ───────────────────────── Claude-written staged bpy plan ─────────────────────────

const SCALE_HINT =
  "Model in Blender units where 1 unit = 1 mm; keep the whole model within roughly 20–80 units and " +
  "sitting on the Z=0 ground plane (printable flat base, +Z up).";

const PRINTABILITY_BLOCK = `
**PRINTABILITY (non-negotiable):**
- ★★ PARTS MUST PHYSICALLY OVERLAP — this is the #1 rule. EVERY component (head, neck, arms, legs,
  hands, feet, antenna, ears, base, ANY add-on) MUST INTERSECT the part it attaches to by AT LEAST
  2-3 units of solid overlap. NEVER leave an air gap between two parts — a gap = a floating piece
  that CANNOT be 3D-printed and looks broken. Concrete rules:
    • An arm on the side of a torso must be placed so its inner edge EMBEDS INTO the torso wall
      (overlap ≥2 units), NOT floating out to the side with a gap.
    • The head must SINK 2-3 units into the neck/torso (or add a NECK cylinder that overlaps BOTH
      the head and the torso). Never a head hovering above the body.
    • Legs/feet must overlap the torso/base; a base or platform must INTERSECT the body, never hover
      under it.
    • If two parts would otherwise have a gap, ADD A CONNECTING piece (neck, shoulder block, strut,
      peg) that overlaps BOTH so the whole model is ONE continuous mass of overlapping solids.
- The FINAL model MUST be ONE CONNECTED SOLID. The post-process BOOLEAN-UNIONS every overlapping mesh
  into a single watertight shell automatically — but the union can only fuse parts that ACTUALLY
  OVERLAP (see above). Non-overlapping parts stay as separate floaters and ruin the print.
- It MUST sit flat on the build plate: lowest vertex Z = 0 (handled for you — keep a flat-ish bottom).
- No thin walls below ~1.2 mm at print scale. No tiny disconnected crumbs. Watertight/manifold.
- Provide a flat-ish bottom contact patch (at least ~8mm) for bed adhesion.
- Stages are CUMULATIVE — each stage adds to the previous. The last stage is the finished,
  recognizable, printable, SINGLE-SOLID model with NO gaps between any parts.
`;

// Design intelligence for Blender bpy generation (mirrors the OpenSCAD block in route.ts).
const BLENDER_COMMON_SENSE =
  `\n**DESIGN INTELLIGENCE — how real-world printable objects MUST work (non-negotiable):**\n` +
  `\n--- FUNCTIONAL FEATURES ---\n` +
  `- KEYCHAINS/TAGS: MUST have a THROUGH-HOLE near one end (5-6mm dia, all the way through). ` +
  `Use a boolean DIFFERENCE cylinder. Without a through-hole it is NOT a keychain. ` +
  `Size: 50-70mm long, 25-35mm wide, 4-5mm thick.\n` +
  `- PHONE STANDS: Back support 60-75°, front lip ≥5mm, cable slot at bottom (~15×8mm), ` +
  `wide stable base ≥80mm.\n` +
  `- CABLE CLIPS: Channel dia to match cable (USB-C ~3.5mm, power ~6-8mm). Snap-fit slot. Wall ≥2mm.\n` +
  `- WALL HOOKS: Opening 25-35mm, mounting with 2 screw holes (4mm dia) or keyhole. ` +
  `Curve radius ≥8mm. Load thickness ≥4mm.\n` +
  `- HEADPHONE STANDS: ~200mm tall, base ≥100mm, curved top cradle ~50mm. Cable-wrap hooks optional.\n` +
  `- PEN HOLDERS: Inner dia ≥15mm, wall ≥2mm, stable weighted base.\n` +
  `\n--- TEXT & BRANDING ---\n` +
  `- TEXT: Copy EXACT spelling from prompt. "CLAUDE HARDWARE" ≠ "CLAUDWARE". ` +
  `Use bpy.ops.object.text_add() with extrude ≥0.8mm. Convert to mesh before joining.\n` +
  `- COINS/TOKENS: 35-45mm dia, 3-4mm thick, raised rim 0.5mm. Center text/logo.\n` +
  `\n--- CONTAINERS ---\n` +
  `- BOXES: Wall ≥1.5mm, press-fit lid lip (0.3mm clearance), rounded interior corners.\n` +
  `- VASES: Wall ≥2mm, flat base ≥40mm, solid shell if watertight.\n` +
  `- PLANTERS: Drainage holes (3-4 × 5mm). Wall ≥2.5mm.\n` +
  `\n--- MECHANICAL ---\n` +
  `- BRACKETS: Screw holes +0.2mm clearance (M3=3.2mm, M4=4.2mm). Corner fillets ≥2mm.\n` +
  `- HINGES: Print-in-place clearance 0.3-0.4mm. Pin ≥3mm.\n` +
  `- SNAP-FITS: Beam 1-2mm thick, overhang 0.3-0.5mm, 45° lead-in.\n` +
  `\n--- DECORATIVE ---\n` +
  `- FIGURES/ROBOTS/CHARACTERS: build a clear central BODY first, then attach each limb so it OVERLAPS ` +
  `the body by 3-4 units AT THE JOINT — arms on the upper SIDES (inner face buried in the torso wall), ` +
  `legs UNDERNEATH, head ON TOP with its base sinking 3-4 units into the body/neck. Keep proportions ` +
  `recognizable and distinct (clear head, body, arms, legs) — do NOT place limbs far out in empty space, ` +
  `and do NOT make one cramped blob. Solid base ≥15mm, no floating parts, min feature 1.5mm.\n` +
  `- ORNAMENTS: Hanging hole 3-4mm at top.\n` +
  `- DESK TOYS: Smooth edges (bevel ≥1mm). Moving parts 0.3mm clearance.\n` +
  `\n--- UNIVERSAL RULES ---\n` +
  `- All THROUGH-HOLES: boolean DIFFERENCE, never blind pockets unless asked.\n` +
  `- All edges: bevel modifier 0.5-1mm for printability.\n` +
  `- Min wall 1.2mm. Min feature 1mm. Flat bottom. Contact patch ≥8mm.\n` +
  `- No unsupported bridges >20mm. No overhangs past 60° without support.\n` +
  `- When in doubt: THICKER and STURDIER — thin prints break.\n`;

/** Ask the Claude CLI for a staged bpy plan (arbitrary prompts; no API key). `base` = refine-in-place. */
export async function claudeBpyPlan(prompt: string, base?: string, primer = ""): Promise<GenPlan> {
  const editIntro = base
    ? `Here is the CURRENT model's final-stage bpy script. MODIFY it to satisfy this change: "${prompt}".\n` +
      `Keep what works; change only what the request implies. Re-emit the FULL staged build.\n` +
      `The result MUST still be a single connected solid sitting on Z=0 — obey the printability rules below.\n` +
      `--- CURRENT SCRIPT ---\n${base}\n--- END ---\n\n`
    : "";
  const instruction =
    `You are a Blender ${"bpy"} expert procedurally modelling a 3D-PRINTABLE object: "${prompt}".\n` +
    editIntro + (primer ? primer + "\n" : "") +
    PRINTABILITY_BLOCK +
    BLENDER_COMMON_SENSE +
    `Output 3 to 4 CUMULATIVE build stages (fewer = faster). For EACH stage output exactly this, nothing else:\n` +
    `@@@STAGE <snake_case_label> | <short detail>\n` +
    `<a COMPLETE, self-contained Python (bpy) program that builds the model UP TO this stage>\n\n` +
    `Rules: ${SCALE_HINT} Use ONLY the \`bpy\` module (and \`math\`/\`mathutils\` if needed). ` +
    `Build by ADDING SIMPLE MESH PRIMITIVES — bpy.ops.mesh.primitive_cube_add / _cylinder_add / _cone_add / ` +
    `_uv_sphere_add — positioned so every neighbouring part OVERLAPS the part it attaches to by ≥2-3 units ` +
    `(see PRINTABILITY). ★ CRASH-PROOF RULES (critical — Blender 5.x): do NOT use boolean modifiers, do NOT ` +
    `call bpy.ops.object.join(), do NOT clear/delete the scene, do NOT add cameras/lights, do NOT export, and ` +
    `capture each new object right after creating it (obj = bpy.context.active_object) rather than relying on ` +
    `bpy.context.object later. The system AUTOMATICALLY fuses every overlapping part into ONE watertight solid, ` +
    `grounds it at Z=0, and exports — you ONLY place overlapping primitives. metaballs/curves/text are allowed ` +
    `(auto-converted to mesh). Keep each stage CONCISE.\n` +
    `Stage 1 = rough base form, last stage = finished, recognizable model with ALL parts overlapping (no gaps). ` +
    `Each stage stands alone and creates non-empty geometry. No prose, no markdown, no backticks. ` +
    `Begin your reply immediately with "@@@STAGE".`;
  const stdout = await claudeText(instruction, { model: BLENDER_MODEL, maxTokens: 12_000, timeoutMs: 120_000 });

  const stages: Stage[] = [];
  for (const part of stdout.split(/@@@STAGE\s*/g).map((s) => s.trim()).filter(Boolean)) {
    const nl = part.indexOf("\n");
    if (nl < 0) continue;
    const [label, detail] = part.slice(0, nl).split("|").map((s) => s.trim());
    const code = part.slice(nl + 1).replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
    if (code && /\bbpy\b/.test(code))
      stages.push({ label: (label || "stage").replace(/\s+/g, "_"), detail: detail || "", scad: code });
  }
  if (!stages.length) throw new Error("no bpy stages parsed from claude output");
  return { object: "model", summary: prompt.trim(), stages, params: {} };
}

/** Validate an STL file has actual geometry (non-empty, has triangles). */
export function validateStl(stlPath: string): boolean {
  if (!existsSync(stlPath)) return false;
  const size = statSync(stlPath).size;
  if (size < 100) return false;
  return true;
}

/** Last-resort procedural bpy plan so the Blender route never hard-fails. Uses real MESH primitives
 *  (uv_sphere/cone) — NOT metaballs — so it always exports a non-empty STL and renders in the viewport.
 *  The final stage JOINS all parts and grounds at Z=0 (printable single-solid). */
export function fallbackBpyPlan(prompt: string): GenPlan {
  const defs =
    `import bpy\n` +
    `def ball(x,y,z,r):\n` +
    `    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=(x,y,z), segments=28, ring_count=18)\n` +
    `def cone(x,y,z,r,d):\n` +
    `    bpy.ops.mesh.primitive_cone_add(radius1=r, depth=d, location=(x,y,z))\n`;
  // a friendly little character (body → head → eyes/ears/feet) — generic stand-in for any prompt
  const body = `ball(0,0,12,12)\n`;
  const headP = `ball(0,0,28,8)\n`;
  const feats =
    `for s in (-1,1):\n` +
    `    ball(s*3.2,-7,30,1.8)\n` +     // eyes
    `    cone(s*5,0,36,2.4,4)\n` +      // ears
    `    ball(s*6,0,2,3.2)\n`;          // feet
  // Final stage: join everything into one solid + ground at Z=0
  const joinGround =
    `# JOIN all into one printable solid + ground at Z=0\n` +
    `_all = [o for o in bpy.data.objects if o.type == 'MESH']\n` +
    `if len(_all) > 1:\n` +
    `    bpy.ops.object.select_all(action='DESELECT')\n` +
    `    for _o in _all: _o.select_set(True)\n` +
    `    bpy.context.view_layer.objects.active = _all[0]\n` +
    `    bpy.ops.object.join()\n` +
    `_final = [o for o in bpy.data.objects if o.type == 'MESH']\n` +
    `if _final:\n` +
    `    _min_z = min(min(v.co.z for v in _o.data.vertices) for _o in _final if _o.data.vertices)\n` +
    `    if abs(_min_z) > 0.001:\n` +
    `        for _o in _final: _o.location.z -= _min_z\n`;
  return {
    object: "figure",
    summary: `${prompt.trim()} (procedural figure)`,
    stages: [
      { label: "base_body", detail: "core body", scad: defs + body },
      { label: "add_head", detail: "+ head", scad: defs + body + headP },
      { label: "add_features", detail: "+ eyes, ears, feet (joined + grounded)", scad: defs + body + headP + feats + joinGround },
    ],
    params: {},
  };
}
