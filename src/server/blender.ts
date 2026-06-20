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

const execFileP = promisify(execFile);
const bin = (abs: string, name: string) => (existsSync(abs) ? abs : name);
const BLENDER = bin("/opt/homebrew/bin/blender", "blender");

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
    bpy.ops.wm.stl_export(filepath=${JSON.stringify(outStl)}, export_selected_objects=True, apply_modifiers=True, ascii_format=True, up_axis='Z', forward_axis='Y', global_scale=1.0)
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

/** Wrap a stage's bpy body with a clean rebuild + ASCII-STL export. Z-up matches OpenSCAD STL.
 *  `isFinal` = true for the last stage → triggers join + ground + manifold cleanup. */
export function wrapStage(body: string, stlPath: string, isFinal = false): string {
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
# ===== FINAL STAGE: join → ground → manifold cleanup =====
_meshes_pre = [o for o in bpy.data.objects if o.type == 'MESH']
if len(_meshes_pre) > 1:
    bpy.ops.object.select_all(action='DESELECT')
    for _o in _meshes_pre:
        _o.select_set(True)
    bpy.context.view_layer.objects.active = _meshes_pre[0]
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
    bpy.ops.wm.stl_export(
        filepath=${p}, export_selected_objects=True, apply_modifiers=True,
        ascii_format=True, up_axis='Z', forward_axis='Y', global_scale=1.0,
    )
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
  await execFileP(BLENDER, ["--background", "--factory-startup", "--python", pyPath], { timeout: 90_000, maxBuffer: 8 << 20 });
  if (produced()) return "headless";
  throw new Error("blender produced no STL (empty geometry — bpy created nothing exportable)");
}

// ───────────────────────── Claude-written staged bpy plan ─────────────────────────

const SCALE_HINT =
  "Model in Blender units where 1 unit = 1 mm; keep the whole model within roughly 20–80 units and " +
  "sitting on the Z=0 ground plane (printable flat base, +Z up).";

const PRINTABILITY_BLOCK = `
**PRINTABILITY (non-negotiable):**
- The FINAL model MUST be ONE CONNECTED SOLID. After the last stage, join all mesh objects
  with bpy.ops.object.join(). If parts overlap, use a boolean UNION (bpy.ops.object.modifier_add
  type='BOOLEAN', operation='UNION') to fuse them. No separate floating pieces — if there is a base
  disc or platform, it MUST be fused/intersecting with the body, NOT hovering underneath.
- It MUST sit flat on the build plate: after joining, translate so the lowest vertex Z = 0.
- No thin walls below ~1.2 mm at print scale. No tiny disconnected crumbs.
- Provide a flat-ish bottom contact patch (at least ~8mm diameter) for bed adhesion.
- Keep it watertight/manifold (no holes, no inverted faces).
- Stages are CUMULATIVE — each stage adds to the previous. The last stage is the finished,
  printable, single-solid model.
`;

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
    `Output 3 to 4 CUMULATIVE build stages (fewer = faster). For EACH stage output exactly this, nothing else:\n` +
    `@@@STAGE <snake_case_label> | <short detail>\n` +
    `<a COMPLETE, self-contained Python (bpy) program that builds the model UP TO this stage>\n\n` +
    `Rules: ${SCALE_HINT} Use only the \`bpy\` module (and \`math\`/\`mathutils\` if needed). ` +
    `PREFER mesh primitives (bpy.ops.mesh.primitive_*), modifiers and boolean ops; metaballs/curves/text ` +
    `are allowed (they're auto-converted to mesh). Keep each stage CONCISE. Do NOT clear the scene, do NOT ` +
    `add cameras/lights, do NOT export — that is handled for you. ` +
    `In the FINAL stage, JOIN all objects (bpy.ops.object.join()) and translate so min Z = 0.\n` +
    `Stage 1 = rough base form, last stage = finished, recognizable, SINGLE-SOLID model sitting on Z=0. ` +
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
