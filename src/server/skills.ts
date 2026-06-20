/**
 * Skills under the hood — per-engine "expertise primers" injected into the Claude generation prompt
 * for that engine. This is how the installed skills (cad-modeling, blender, BOSL2/OpenSCAD) inform the
 * model's OUTPUT on the app side, not just at dev time. Distilled to short constants on purpose: dumping
 * full SKILL.md files into every prompt is token-heavy and dilutes the instruction.
 *
 * Sources: cad-modeling skill (feature order, fully-constrained sketches, fillets late, parametric dims);
 * blender skill + our own print pipeline (manifold/watertight mesh for printing); BOSL2 (the OpenSCAD
 * standard library for real gears/threads/joints).
 */
import type { ConcreteEngine } from "./engineRoute";

const FUSION = [
  "Expert Fusion modelling (from the cad-modeling skill):",
  "- Plan feature order: primary form (base extrude/revolve) → secondary forms → positioned features (holes, pockets) → details (fillets, chamfers) LAST.",
  "- Fully constrain sketches with real dimensions; use mid-plane extrude when the part is symmetric.",
  "- Use shell for hollow parts and a sensible minimum wall (>=1.2mm = 0.12cm) so it is printable.",
  "- Prefer parametric features over raw BRep; keep the part watertight and a flat base on the build plate.",
].join("\n");

const BLENDER = [
  "Expert bpy modelling for 3D PRINTING:",
  "- Build MANIFOLD, watertight, single-shell geometry (no zero-thickness faces, no loose verts).",
  "- Prefer mesh primitives + modifiers (Subdivision, Bevel, Solidify for thickness, Boolean) then think of them as applied.",
  "- Give every surface real thickness; keep the model sitting on Z=0 with a flat printable base.",
  "- Avoid n-gons that won't triangulate cleanly; keep recognizable silhouette over micro-detail.",
].join("\n");

const OPENSCAD = [
  "Use BOSL2 (the OpenSCAD standard library) for anything mechanical:",
  "include <BOSL2/std.scad> then real primitives — spur_gear(), bevel_gear(), worm(), rack(), threaded_rod(),",
  "screw(), nut(), ball_bearing(), and rounded cuboid()/cyl(...,rounding=). Keep $fn<=64. Millimetres, watertight, flat base.",
].join("\n");

/** The expertise primer for an engine's generation prompt (empty for engines without one). */
export function enginePrimer(engine: ConcreteEngine): string {
  switch (engine) {
    case "fusion": return FUSION;
    case "blender": return BLENDER;
    case "openscad": return OPENSCAD;
    case "nvidia": return ""; // NVIDIA quality comes from prompt enrichment (promptEnrich), not a code primer
  }
}
