/**
 * Print-Readiness v2 — Stage E EXPORT (pure mesh-format writers).
 * OBJ (universal, keeps geometry) and 3MF (the Bambu A1 default — units + multi-object container). 3MF is
 * an OPC zip; we hand-roll a minimal STORED (uncompressed) zip with correct CRC-32 so there's NO new
 * dependency (constitution rule 6). STL stays the existing artifact; G-code (OrcaSlicer) is a later phase.
 */
import type { Tri, Vec3 } from "@/server/printPlan";

// ───────────────────────── CRC-32 (IEEE) + minimal STORED zip ─────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry { name: string; data: Uint8Array }

/** Build a STORED (method 0, uncompressed) zip — enough for an OPC/3MF package; no dependency. */
export function makeZip(entries: ZipEntry[]): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, "utf8");
    const data = Buffer.from(e.data);
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4);         // version needed to extract
    local.writeUInt16LE(0, 6);          // flags
    local.writeUInt16LE(0, 8);          // method 0 = stored
    local.writeUInt16LE(0, 10);         // mod time
    local.writeUInt16LE(0x21, 12);      // mod date (a valid non-zero date)
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18); // compressed size (== uncompressed for stored)
    local.writeUInt32LE(data.length, 22); // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);         // extra field length

    const localOffset = offset;
    parts.push(local, name, data);
    offset += local.length + name.length + data.length;

    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);     // central directory header signature
    c.writeUInt16LE(20, 4);             // version made by
    c.writeUInt16LE(20, 6);             // version needed
    c.writeUInt16LE(0, 8);
    c.writeUInt16LE(0, 10);             // method
    c.writeUInt16LE(0, 12);
    c.writeUInt16LE(0x21, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(name.length, 28);
    c.writeUInt16LE(0, 30);             // extra
    c.writeUInt16LE(0, 32);             // comment
    c.writeUInt16LE(0, 34);             // disk number start
    c.writeUInt16LE(0, 36);             // internal attrs
    c.writeUInt32LE(0, 38);             // external attrs
    c.writeUInt32LE(localOffset, 42);   // offset of local header
    central.push(c, name);
  }

  const centralBuf = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);    // end of central directory signature
  eocd.writeUInt16LE(0, 4);             // disk number
  eocd.writeUInt16LE(0, 6);             // disk w/ central dir
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuf.length, 12);
  eocd.writeUInt32LE(offset, 16);       // offset of central directory
  eocd.writeUInt16LE(0, 20);            // comment length
  return Buffer.concat([...parts, centralBuf, eocd]);
}

// ───────────────────────── OBJ ─────────────────────────

/** Triangles → Wavefront OBJ (3 verts + 1 face per triangle; valid, universal). */
export function trisToObj(tris: Tri[]): string {
  let v = "", f = "";
  let i = 1;
  for (const t of tris) {
    for (const p of t) v += `v ${p.x} ${p.y} ${p.z}\n`;
    f += `f ${i} ${i + 1} ${i + 2}\n`;
    i += 3;
  }
  return `# Claude Hardware export\n${v}${f}`;
}

// ───────────────────────── 3MF (OPC package) ─────────────────────────

function build3dmodelXml(tris: Tri[]): string {
  const idx = new Map<string, number>();
  const verts: Vec3[] = [];
  const vid = (p: Vec3) => { const k = `${p.x},${p.y},${p.z}`; let i = idx.get(k); if (i === undefined) { i = verts.length; verts.push(p); idx.set(k, i); } return i; };
  const tIdx = tris.map(([a, b, c]) => [vid(a), vid(b), vid(c)] as const);
  const vXml = verts.map((p) => `<vertex x="${p.x}" y="${p.y}" z="${p.z}"/>`).join("");
  const tXml = tIdx.map(([a, b, c]) => `<triangle v1="${a}" v2="${b}" v3="${c}"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">` +
    `<resources><object id="1" type="model"><mesh><vertices>${vXml}</vertices><triangles>${tXml}</triangles></mesh></object></resources>` +
    `<build><item objectid="1"/></build></model>`;
}

/** Triangles → a 3MF package (Bambu A1 default format). No recipe = geometry only. */
export function trisTo3mf(tris: Tri[], recipe?: PrintRecipeForExport): Buffer {
  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>` +
    (recipe ? `<Default Extension="config" ContentType="text/plain"/>` : "") +
    `</Types>`;
  const rels =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rel0" Target="/3D/3dmodel.model" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>`;
  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
    { name: "_rels/.rels", data: Buffer.from(rels, "utf8") },
    { name: "3D/3dmodel.model", data: Buffer.from(build3dmodelXml(tris), "utf8") },
  ];
  if (recipe) {
    entries.push({ name: "Metadata/plate_1.config", data: Buffer.from(buildSlicerConfig(recipe), "utf8") });
    entries.push({ name: "Metadata/project_settings.config", data: Buffer.from(buildProjectConfig(recipe), "utf8") });
  }
  return makeZip(entries);
}

// ───────────────────────── Slicer config for Bambu Studio / OrcaSlicer ─────────────────────────

/** Subset of PrintRecipe needed for 3MF embedding (avoids circular import). */
export interface PrintRecipeForExport {
  layerHeight: number;
  firstLayerHeight: number;
  infillPercent: number;
  infillPattern: string;
  wallLoops: number;
  topLayers: number;
  bottomLayers: number;
  supportStyle: "none" | "normal" | "tree";
  supportAngle: number;
  bedTemp: number;
  nozzleTemp: number;
  speed: number;
  material: string;
  brim: boolean;
}

/** Bambu Studio / OrcaSlicer-compatible plate config (INI format). */
function buildSlicerConfig(r: PrintRecipeForExport): string {
  const supportType = r.supportStyle === "tree" ? "tree(auto)" : r.supportStyle === "normal" ? "normal(auto)" : "none";
  return [
    `; Generated by Claude Hardware — one-click printable`,
    `; Printer: Bambu Lab A1`,
    `; Material: ${r.material}`,
    ``,
    `[plate]`,
    `plate_index = 1`,
    ``,
    `[print]`,
    `layer_height = ${r.layerHeight}`,
    `initial_layer_print_height = ${r.firstLayerHeight}`,
    `wall_loops = ${r.wallLoops}`,
    `top_shell_layers = ${r.topLayers}`,
    `bottom_shell_layers = ${r.bottomLayers}`,
    `sparse_infill_density = ${r.infillPercent}%`,
    `sparse_infill_pattern = ${r.infillPattern}`,
    `outer_wall_speed = ${r.speed}`,
    `inner_wall_speed = ${Math.round(r.speed * 1.5)}`,
    `sparse_infill_speed = ${Math.round(r.speed * 2)}`,
    `enable_support = ${r.supportStyle !== "none" ? 1 : 0}`,
    `support_type = ${supportType}`,
    `support_threshold_angle = ${r.supportAngle}`,
    `brim_type = ${r.brim ? "outer_only" : "no_brim"}`,
    `brim_width = ${r.brim ? 5 : 0}`,
    ``,
  ].join("\n");
}

/** Project-wide settings config (read by Bambu Studio on open). */
function buildProjectConfig(r: PrintRecipeForExport): string {
  return [
    `; Claude Hardware — project settings for Bambu Lab A1`,
    ``,
    `[filament]`,
    `filament_type = ${r.material}`,
    `nozzle_temperature = ${r.nozzleTemp}`,
    `bed_temperature = ${r.bedTemp}`,
    ``,
    `[print]`,
    `layer_height = ${r.layerHeight}`,
    `initial_layer_print_height = ${r.firstLayerHeight}`,
    `wall_loops = ${r.wallLoops}`,
    `top_shell_layers = ${r.topLayers}`,
    `bottom_shell_layers = ${r.bottomLayers}`,
    `sparse_infill_density = ${r.infillPercent}%`,
    `sparse_infill_pattern = ${r.infillPattern}`,
    `enable_support = ${r.supportStyle !== "none" ? 1 : 0}`,
    `support_type = ${r.supportStyle === "tree" ? "tree(auto)" : r.supportStyle === "normal" ? "normal(auto)" : "none"}`,
    `support_threshold_angle = ${r.supportAngle}`,
    `outer_wall_speed = ${r.speed}`,
    `brim_type = ${r.brim ? "outer_only" : "no_brim"}`,
    ``,
  ].join("\n");
}
