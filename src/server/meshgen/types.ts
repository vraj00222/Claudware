/** A request to turn a text prompt (and optional reference image) into a printable mesh. */
export interface MeshGenRequest {
  prompt: string;
  /** reference image URL (e.g. a search-result thumbnail) for image→3D, when available */
  refImageUrl?: string;
  /** prefer the live BlenderMCP path (watch it build) when the socket is up */
  preferLive: boolean;
  /** target real-world height in mm; when set, the final mesh is scaled to it */
  sizeMm?: number;
  /** generation seed — varied on a self-inspect retry so a fresh attempt differs from the first */
  seed?: number;
  /** working directory for output files (jobDir) */
  jobDir: string;
}

export interface MeshGenResult {
  /** absolute path to the print STL (always present) */
  stlPath: string;
  /** absolute path to a textured GLB preview, when the provider produced one */
  glbPath?: string;
  textured: boolean;
  provider: "rodin" | "nim" | "procedural";
  /** built in the live Blender GUI (true only for the rodin socket path) */
  live: boolean;
}

export interface MeshGenProvider {
  name: MeshGenResult["provider"];
  /** is this provider usable right now (key present / socket up)? cheap check. */
  available(req: MeshGenRequest): Promise<boolean>;
  generate(req: MeshGenRequest): Promise<MeshGenResult>;
}
