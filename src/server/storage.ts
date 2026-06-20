import { createAdminClient } from "@insforge/sdk";
import { readFile } from "node:fs/promises";

const INSFORGE_URL = process.env.INSFORGE_URL;
const INSFORGE_API_KEY = process.env.INSFORGE_API_KEY;

/** Upload a finished STL to InsForge Storage (durable URL); key-gated, never throws. */
export async function uploadFinalStl(jobId: string, stlPath: string): Promise<string | undefined> {
  if (!INSFORGE_URL || !INSFORGE_API_KEY) return undefined;
  try {
    const admin = createAdminClient({ baseUrl: INSFORGE_URL, apiKey: INSFORGE_API_KEY });
    const buf = await readFile(stlPath);
    const file = new File([buf], "final.stl", { type: "model/stl" });
    const { data, error } = await admin.storage.from("models").upload(`${jobId}/final.stl`, file);
    if (error || !data?.url) return undefined;
    return data.url as string;
  } catch {
    return undefined; // never let storage break a successful generation/import
  }
}
