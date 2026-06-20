import path from "node:path";
import { existsSync, statSync } from "node:fs";
import { blenderSend, blenderLiveAvailable } from "@/server/blender";
import type { MeshGenProvider, MeshGenRequest, MeshGenResult } from "./types";

/**
 * Hyper3D Rodin via the BlenderMCP addon socket (MAIN_SITE / hyper3d.ai mode). The addon holds the
 * free-trial key. Flow (verified from the addon source):
 *   create_rodin_job{text_prompt} → {uuid, jobs:{subscription_key}}
 *   poll_rodin_job_status{subscription_key} → {status_list:[...]}   (loop until all Done)
 *   import_generated_asset{task_uuid, name} → imports the textured mesh into the LIVE scene
 * Then we export STL (print) + GLB (preview) from that imported object. The user WATCHES it appear.
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
type Res = { status: string; result?: any; message?: string };

export const rodinProvider: MeshGenProvider = {
  name: "rodin",
  // usable only when we asked for live AND the BlenderMCP socket is up (the addon has the Rodin key)
  available: async (req) => req.preferLive && (await blenderLiveAvailable()),

  async generate(req: MeshGenRequest): Promise<MeshGenResult> {
    // 1) create the job (text→3D; Hyper3D addon supplies the key)
    const create = (await blenderSend({ type: "create_rodin_job", params: { text_prompt: req.prompt } }, 90_000)) as Res;
    if (create.status !== "success") throw new Error(create.message || "rodin create failed");
    const data = create.result || {};
    if (data.error) throw new Error(`rodin: ${data.error}`);
    const taskUuid: string | undefined = data.uuid ?? data.task_uuid;
    const subKey: string | undefined = data.jobs?.subscription_key ?? data.subscription_key;
    if (!taskUuid || !subKey) throw new Error("rodin: missing uuid/subscription_key");

    // 2) poll until every job reports done (deemos: Done/Generating/Waiting/Failed)
    let done = false;
    for (let i = 0; i < 45 && !done; i++) {
      await sleep(4000);
      const poll = (await blenderSend({ type: "poll_rodin_job_status", params: { subscription_key: subKey } }, 30_000)) as Res;
      const list: string[] = poll.result?.status_list ?? [];
      if (list.some((s) => /fail|error/i.test(s))) throw new Error("rodin job failed");
      if (list.length && list.every((s) => /done|completed|success/i.test(s))) done = true;
    }
    if (!done) throw new Error("rodin timed out");

    // 3) import into the LIVE scene (user watches it appear); capture the object name to export just it
    const imp = (await blenderSend({ type: "import_generated_asset", params: { task_uuid: taskUuid, name: "rodin_model" } }, 180_000)) as Res;
    if (imp.status !== "success" || imp.result?.succeed === false) throw new Error(imp.result?.error || "rodin import failed");
    const objName: string | undefined = imp.result?.name;

    // 4) export STL (print) + GLB (textured preview) from the imported object ONLY (ignore leftover scene objects)
    const stlPath = path.join(req.jobDir, "model.stl");
    const glbPath = path.join(req.jobDir, "model.glb");
    const sel = objName
      ? `o = bpy.data.objects.get(${JSON.stringify(objName)})\ntargets = [o] if o else [x for x in bpy.data.objects if x.type=='MESH']`
      : `targets = [x for x in bpy.data.objects if x.type=='MESH']`;
    const code = `import bpy
${sel}
bpy.ops.object.select_all(action='DESELECT')
for o in targets:
    if o: o.select_set(True)
bpy.context.view_layer.objects.active = targets[0] if targets else None
if targets:
    bpy.ops.wm.stl_export(filepath=${JSON.stringify(stlPath)}, export_selected_objects=True, ascii_format=True, up_axis='Z', forward_axis='Y')
    bpy.ops.export_scene.gltf(filepath=${JSON.stringify(glbPath)}, export_format='GLB', use_selection=True)
`;
    const exp = (await blenderSend({ type: "execute_code", params: { code } }, 120_000)) as Res;
    if (exp.status !== "success" || !existsSync(stlPath) || statSync(stlPath).size === 0)
      throw new Error("rodin export produced no STL");
    return { stlPath, glbPath: existsSync(glbPath) ? glbPath : undefined, textured: existsSync(glbPath), provider: "rodin", live: true };
  },
};
