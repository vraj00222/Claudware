import path from "node:path";
import { writeFile } from "node:fs/promises";
import { glbToStl } from "@/server/glb";
import type { MeshGenProvider, MeshGenRequest, MeshGenResult } from "./types";

/**
 * NVIDIA NIM — Microsoft TRELLIS text→3D (GLB). Cloud, reliable, textured. Verified live:
 * POST {mode,prompt,seed,ss_sampling_steps,slat_sampling_steps} → {artifacts:[{base64:"<GLB>"}]}.
 * We decode the GLB (textured preview) and convert it to a cleaned ascii STL (printable) via Blender.
 *
 * NOTE: we do TEXT→3D only. Reference images are handled UPSTREAM (Claude vision describes the image →
 * folded into the text prompt) because NVIDIA's HOSTED image→3D endpoint 500s server-side.
 */
const KEY = process.env.NVIDIA_NIM || "";
const ENDPOINT = "https://ai.api.nvidia.com/v1/genai/microsoft/trellis";
// NVCF async: a busy/cold function answers the POST with 202 + an `nvcf-reqid`; the result is then polled here.
const STATUS_URL = (reqId: string) => `https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/${reqId}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type NimResponse = { artifacts?: { base64?: string; finishReason?: string }[] };

/** Pull the GLB base64 from a NIM body. Returns null for a transient empty (→ retry); throws on an
 *  explicit non-success finishReason (e.g. CONTENT_FILTERED) so the user gets an honest reason, not a blob. */
function artifactB64(j: NimResponse): string | null {
  const a = j.artifacts?.[0];
  if (a?.base64) return a.base64;
  if (a?.finishReason && a.finishReason.toUpperCase() !== "SUCCESS") throw new Error(`nim ${a.finishReason}`);
  return null;
}

/** One text→3D request. Handles the NVCF 202/async case by polling the status endpoint until fulfilled.
 *  Returns the GLB base64, or null when the result came back empty (caller retries — TRELLIS occasionally
 *  returns an empty artifact under load, which used to fall straight to the procedural blob = "did nothing"). */
async function requestGlb(prompt: string, seed: number, signal: AbortSignal): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Accept: "application/json" },
      // DEFAULT sampling only: the hosted TRELLIS function 500s ("nvcf-status: errored", ~90s) whenever
      // ss/slat_sampling_steps are set — verified 50/50→500 AND 20/20→500, but no-steps→200 fulfilled GLB.
      body: JSON.stringify({ mode: "text", prompt, seed }),
      signal,
    });
  } catch {
    return null; // network blip ("fetch failed") → treat as transient so the caller RETRIES, never dead-ends
  }
  if (res.status === 202) {
    const reqId = res.headers.get("nvcf-reqid");
    if (!reqId) return null;
    for (let i = 0; i < 30; i++) {                    // ~30 × 4s = up to 2 min of polling
      await sleep(4000);
      let pr: Response;
      try {
        pr = await fetch(STATUS_URL(reqId), { headers: { Authorization: `Bearer ${KEY}`, Accept: "application/json" }, signal });
      } catch { return null; }                         // poll network blip → retry the whole request
      if (pr.status === 202) continue;                // still pending
      if (!pr.ok) return null;                         // poll failed → let the caller retry the request
      return artifactB64((await pr.json()) as NimResponse);
    }
    return null;                                       // timed out polling → retry
  }
  // The HOSTED TRELLIS endpoint intermittently 500s under load (verified: ~2 of 3 calls 500, the rest 200).
  // Treat 5xx/429 as TRANSIENT → return null so the caller retries, instead of throwing straight to the slow
  // procedural blob ("NVIDIA did nothing"). A 4xx is a real request problem → throw (retrying would just spin).
  if (res.status >= 500 || res.status === 429) return null;
  if (!res.ok) throw new Error(`nim ${res.status}`);
  return artifactB64((await res.json()) as NimResponse);
}

export const nimProvider: MeshGenProvider = {
  name: "nim",
  available: async () => Boolean(KEY),
  async generate(req: MeshGenRequest): Promise<MeshGenResult> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 280_000);
    try {
      // Retry transient misses (a 500/429 from server load, or an empty artifact) with light backoff before
      // giving up. A 500 fails FAST (~1s), so several retries are cheap and lift the hosted endpoint's ~1-in-3
      // success rate to ~90%+ — the difference between a real textured figure and the procedural fallback.
      let b64: string | null = null;
      const MAX_TRIES = 8;
      for (let i = 0; i < MAX_TRIES && !b64; i++) {
        if (i) await sleep(Math.min(1500 * i, 5000));
        b64 = await requestGlb(req.prompt, req.seed ?? 0, ctrl.signal);
      }
      if (!b64) throw new Error(`nim unavailable after ${MAX_TRIES} retries (endpoint busy/500 or empty)`);
      const glbPath = path.join(req.jobDir, "model.glb");
      await writeFile(glbPath, Buffer.from(b64, "base64"));
      const stlPath = await glbToStl(glbPath, path.join(req.jobDir, "model.stl"));
      return { stlPath, glbPath, textured: true, provider: "nim", live: false };
    } finally { clearTimeout(t); }
  },
};
