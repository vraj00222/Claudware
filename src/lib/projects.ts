import type { Estimate } from "./viewModel";
import type { PrintPlan, PrintReadiness } from "./agentEvent";
import { insforge } from "./insforge";

/**
 * A saved project = one model and its history. Persistence sits behind this interface so the
 * localStorage implementation here can later be swapped for InsForge (per the stack) with no
 * UI churn. Models/STLs themselves live server-side under public/generated/<job>/; a project
 * just references the latest mesh + the recipe (scad) needed to refine it in place.
 */
export interface ProjectVersion {
  meshUrl: string;
  /** textured GLB preview URL (meshgen results); meshUrl stays the print STL */
  glbUrl?: string;
  estimate: Estimate | null;
  stages: number;
  /** the recipe (OpenSCAD .scad OR Blender bpy) of this version — refine it IN PLACE next time */
  source?: string;
  /** the accumulated subject prompt that produced this version. Meshgen (TRELLIS) has no editable
   *  recipe, so a refine re-runs meshgen — we re-send THIS subject + the change so the result stays
   *  the same object (e.g. "lego mug" + "smaller") instead of a random new blob. */
  prompt?: string;
  /** which engine produced this version, so a refine uses the matching engine. "imported" = a model
   *  fetched from a repo (no editable recipe → a refine regenerates fresh). */
  engine?: "openscad" | "blender" | "fusion" | "nvidia" | "imported";
  /** when imported from a model repo: who/where it came from (shown for attribution). */
  attribution?: { author: string; license: string; sourceUrl: string; sourceSite: string };
  /** durable InsForge Storage URL of the finished mesh (survives restarts); meshUrl stays the
   *  fast local /generated URL for same-session viewing. Preferred for reopen once auth is wired. */
  storageUrl?: string;
  /** Print Brain readout for this version (dimensions, split, supports, download) — saved so reopen shows it. */
  printPlan?: PrintPlan | null;
  /** Fusion ASSEMBLY part graph: each printable component + its mesh URL. Populated for multi-component
   *  Fusion builds; the input Print-Readiness v2's decompose & nest stage consumes (parts → one plate). */
  parts?: { name: string; meshUrl: string; storageUrl?: string }[];
  /** Print-Readiness v2 result for this version (the "Prepare for print" output) — saved so reopen shows it. */
  readiness?: PrintReadiness | null;
  /** @deprecated kept for back-compat with v1 projects; use `source` */
  scad?: string;
  createdAt: number;
}

/** one turn of the conversation — the chat is continuous across refinements (v1, v2, …). */
export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  at: number;
}

export interface Project {
  id: string;
  title: string;          // the first prompt (project name)
  createdAt: number;
  updatedAt: number;
  versions: ProjectVersion[];
  /** the full conversation thread (kept continuous as the model is refined) */
  messages?: ChatMsg[];
}

export interface ProjectStore {
  list(): Project[];
  get(id: string): Project | undefined;
  save(p: Project): void;
  remove(id: string): void;
}

const KEY = "claude-hardware.projects.v1";

function read(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "[]") as Project[];
  } catch {
    return [];
  }
}

function write(ps: Project[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(ps));
}

/** localStorage-backed store (zero-key fallback; InsForge can implement the same interface). */
export const localProjects: ProjectStore = {
  list() {
    return read().sort((a, b) => b.updatedAt - a.updatedAt);
  },
  get(id) {
    return read().find((p) => p.id === id);
  },
  save(p) {
    const ps = read().filter((x) => x.id !== p.id);
    ps.push(p);
    write(ps);
  },
  remove(id) {
    write(read().filter((p) => p.id !== id));
  },
};

export const newId = () =>
  (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `p_${Date.now().toString(36)}`);

export const latest = (p: Project): ProjectVersion | undefined => p.versions[p.versions.length - 1];

/* ──────────────────────────────────────────────────────────────────────────────
 * InsForge-backed persistence (per-user via RLS). Async by nature; the same four
 * methods as ProjectStore but Promise-returning. localStorage keeps the sync store
 * above for the zero-key path; `localProjectsAsync` wraps it so callers can target
 * ONE async surface and `pickStore` swaps the impl based on auth — used when the
 * post-login shell wires the Studio to the store.
 * ──────────────────────────────────────────────────────────────────────────── */
export interface AsyncProjectStore {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | undefined>;
  save(p: Project): Promise<void>;
  remove(id: string): Promise<void>;
}

/** The whole Project lives in the `projects.data` JSONB column; `title`/`updated_at` are
 *  extracted for the gallery list + ordering. RLS scopes every row to auth.uid(). */
export const insforgeProjects: AsyncProjectStore = {
  async list() {
    if (!insforge) return [];
    const { data, error } = await insforge.database
      .from("projects").select("data").order("updated_at", { ascending: false });
    if (error || !data) return [];
    return (data as { data: Project }[]).map((r) => r.data).filter(Boolean);
  },
  async get(id) {
    if (!insforge) return undefined;
    const { data, error } = await insforge.database
      .from("projects").select("data").eq("id", id).maybeSingle();
    if (error || !data) return undefined;
    return (data as { data: Project }).data;
  },
  async save(p) {
    if (!insforge) return;
    // upsert by app-controlled id (a uuid from newId) so reopen-by-id + refine-in-place keep working.
    const { data: existing } = await insforge.database
      .from("projects").select("id").eq("id", p.id).maybeSingle();
    if (existing) {
      await insforge.database.from("projects").update({ title: p.title, data: p }).eq("id", p.id);
    } else {
      // user_id defaults to auth.uid() server-side; RLS WITH CHECK enforces ownership.
      await insforge.database.from("projects").insert([{ id: p.id, title: p.title, data: p }]);
    }
  },
  async remove(id) {
    if (!insforge) return;
    await insforge.database.from("projects").delete().eq("id", id);
  },
};

/** localStorage store behind the async surface (zero-key fallback). */
export const localProjectsAsync: AsyncProjectStore = {
  list: async () => localProjects.list(),
  get: async (id) => localProjects.get(id),
  save: async (p) => { localProjects.save(p); },
  remove: async (id) => { localProjects.remove(id); },
};

/** Pick the store: InsForge when configured + signed in, else local (zero-key). */
export function pickStore(signedIn: boolean): AsyncProjectStore {
  return signedIn && insforge ? insforgeProjects : localProjectsAsync;
}

/** Resolve the active store by checking the live session: signed-in InsForge user → cloud DB (per-user
 *  via RLS), otherwise localStorage. Used by the studio + gallery so a Google user's projects persist
 *  to their account and reappear next session. */
export async function getActiveStore(): Promise<AsyncProjectStore> {
  if (!insforge) return localProjectsAsync;
  try {
    const { data, error } = await insforge.auth.getCurrentUser();
    return !error && data?.user ? insforgeProjects : localProjectsAsync;
  } catch {
    return localProjectsAsync;
  }
}
