import { rodinProvider } from "./rodin";
import { nimProvider } from "./nim";
import { proceduralProvider } from "./procedural";
import type { MeshGenProvider, MeshGenRequest, MeshGenResult } from "./types";
export type { MeshGenRequest, MeshGenResult } from "./types";

/** Try providers in order; first available one that doesn't throw wins. Pure (DI'd) for testing. */
export async function runProviders(providers: MeshGenProvider[], req: MeshGenRequest): Promise<MeshGenResult> {
  let lastErr: unknown;
  for (const p of providers) {
    try { if (await p.available(req)) return await p.generate(req); }
    catch (e) { lastErr = e; /* fan down to the next provider */ }
  }
  throw lastErr ?? new Error("no meshgen provider available");
}

/** Production order: NVIDIA NIM (cloud, textured) → procedural (zero-key). Rodin is OFF by default
 *  (its free-trial key returns API_INSUFFICIENT_FUNDS); set ENABLE_RODIN=1 once the Hyper3D trial is
 *  topped up (or the addon is in FAL_AI mode) to restore the live-build-in-Blender path as primary. */
export function generateMesh(req: MeshGenRequest): Promise<MeshGenResult> {
  const providers = process.env.ENABLE_RODIN === "1"
    ? [rodinProvider, nimProvider, proceduralProvider]
    : [nimProvider, proceduralProvider];
  return runProviders(providers, req);
}
