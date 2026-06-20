import path from "node:path";
import { existsSync } from "node:fs";
import { claudeBpyPlan, fallbackBpyPlan, renderStageBlender, blenderLiveAvailable } from "@/server/blender";
import type { MeshGenProvider, MeshGenRequest, MeshGenResult } from "./types";

/**
 * Zero-key last resort: the existing procedural Blender path, rendering only the FINAL stage
 * (meshgen returns one mesh, not a build sequence). Always available so the route never hard-fails.
 */
export const proceduralProvider: MeshGenProvider = {
  name: "procedural",
  available: async () => true,
  async generate(req: MeshGenRequest): Promise<MeshGenResult> {
    let plan;
    try { plan = await claudeBpyPlan(req.prompt); }
    catch { plan = fallbackBpyPlan(req.prompt); }
    const last = plan.stages[plan.stages.length - 1];
    const stlPath = path.join(req.jobDir, "model.stl");
    const live = req.preferLive && (await blenderLiveAvailable());
    await renderStageBlender(last.scad, stlPath, path.join(req.jobDir, "model.py"), live);
    if (!existsSync(stlPath)) throw new Error("procedural produced no STL");
    return { stlPath, textured: false, provider: "procedural", live };
  },
};
