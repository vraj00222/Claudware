/**
 * Engine routing — turns a requested engine ("auto" or an explicit one) + the prompt into a CONCRETE
 * engine, with a short human reason for the feed. Pure + deterministic (no env, no I/O) so it's testable.
 *
 * Why this exists: the engine choice used to persist in localStorage, so once OpenSCAD was picked, an
 * organic prompt like "Kratos" silently went to OpenSCAD → a garbage block, while "mushroom house" on
 * the Blender→NVIDIA path looked great. Auto routing makes a prompt always reach the right engine.
 *
 * Precedence (order matters): explicit-Blender intent → organic/character → mechanical/parametric →
 * simple shape → fall back to NVIDIA (a textured attempt beats a block for anything unrecognised).
 */
export type ConcreteEngine = "openscad" | "blender" | "fusion" | "nvidia";
export type RequestedEngine = "auto" | ConcreteEngine;

// Organic / character / creature / figure signals → the textured NVIDIA "wow" path. Checked FIRST so a
// character with a mechanical word in it ("luffy in gear 2 pose") still routes to NVIDIA.
const ORGANIC =
  /\b(dragon|creature|monster|beast|animal|dog|cat|kitten|puppy|bird|owl|eagle|fish|shark|lion|tiger|bear|wolf|fox|horse|dinosaur|dino|trex|t-rex|character|figure|figurine|statue|bust|mascot|person|man|woman|girl|boy|baby|hero|villain|warrior|knight|soldier|samurai|ninja|wizard|witch|mage|elf|orc|goblin|troll|fairy|angel|demon|god|goddess|skull|gargoyle|alien|zombie|robot|mech|android|anime|cartoon|chibi|pokemon|mushroom|flower|tree|plant|cactus|coral|pumpkin|skeleton|head|face|body|pose|sculpt|organic|gnome|teddy|doll|toy)\b/i;

// Explicit "do it in Blender / watch it build" intent → the live bpy build.
const EXPLICIT_BLENDER = /\b(in blender|with blender|watch (it|the)|build it live|procedural(ly)?|low.?poly|voxel)\b/i;

// Mechanical / parametric part signals → OpenSCAD (real BOSL2 gears, threads, brackets).
const MECHANICAL =
  /\b(gear|gearbox|sprocket|cog|thread|threaded|screw|bolt|nut|washer|bearing|bracket|mount|enclosure|housing|chassis|hinge|clip|clamp|fitting|adapter|adaptor|coupler|coupling|flange|gasket|spacer|standoff|pulley|rack|worm|valve|nozzle|knob|hook|peg|rod|gridfinity|bin|organiser|organizer|tray|jig|fixture|spool|pcb|raspberry pi|arduino|parametric|tolerance|press.?fit)\b/i;

// Simple primitive shapes the deterministic OpenSCAD generator nails instantly.
const SIMPLE = /\b(box|cube|block|cylinder|cup|mug|vase|bottle|bowl|plate|dish|ring|pot|tube|pipe|case|container|stand|holder|coaster|lid)\b/i;

// Text / lettering / flat-decorative / turned printables → OpenSCAD. Extruded text + parametric solids are
// fast and watertight; these used to fall through to the slow NVIDIA path (a "keychain that says HELLO" or a
// "snowflake ornament" would spin on TRELLIS for minutes, then land as a generic block). Checked AFTER the
// organic signal, so a "dragon keychain" still routes to NVIDIA.
const PARAMETRIC_PRINTABLE =
  /\b(keychain|key ?chain|keyring|key ?ring|fob|nameplate|name ?plate|badge|plaque|placard|sign|stencil|engrav(?:e|ed|ing)|emboss(?:ed|ing)?|lettering|monogram|initials|logo|cookie cutter|bookmark|ornament|snowflake|bauble|coaster|dice|domino|chess|pawn|comb|whistle|ruler|napkin ring|that says|spells?|spelling)\b/i;

/** Classify a prompt to a concrete engine (never "auto"/"fusion" — those are explicit picks). */
export function classifyEngine(prompt: string): { engine: ConcreteEngine; reason: string } {
  const p = prompt.toLowerCase();
  if (EXPLICIT_BLENDER.test(p)) return { engine: "blender", reason: "you asked to build it live → Quick Shape" };
  if (ORGANIC.test(p)) return { engine: "nvidia", reason: "looks like a character / organic figure → Premium 3D (textured with color)" };
  if (PARAMETRIC_PRINTABLE.test(p)) return { engine: "openscad", reason: "text / flat printable part → DIY" };
  if (MECHANICAL.test(p)) return { engine: "openscad", reason: "looks like a mechanical / parametric part → DIY" };
  if (SIMPLE.test(p)) return { engine: "openscad", reason: "a simple parametric shape → DIY" };
  return { engine: "nvidia", reason: "unrecognised subject → Premium 3D (a textured attempt beats a block)" };
}

const MANUAL_REASON: Record<ConcreteEngine, string> = {
  openscad: "you chose DIY (maker parts & parametric)",
  blender: "you chose Quick Shape (fast procedural build)",
  fusion: "you chose Pro Mechanical (precision CAD)",
  nvidia: "you chose Premium 3D (textured with color)",
};

/** Resolve the requested engine: a manual pick always wins; "auto" defers to the classifier. */
export function resolveEngine(requested: RequestedEngine, prompt: string): { engine: ConcreteEngine; reason: string; auto: boolean } {
  if (requested && requested !== "auto") return { engine: requested, reason: MANUAL_REASON[requested], auto: false };
  return { ...classifyEngine(prompt), auto: true };
}
