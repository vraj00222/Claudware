/**
 * Curated demo prompts per engine — each prompt is tested to produce a printable,
 * visually impressive result. Use these for demo day testing and live presentation.
 *
 * Each prompt includes the recommended engine, expected print time, and a note on
 * what makes it demo-worthy. Sorted by "wow factor" within each engine.
 */

export interface DemoPrompt {
  prompt: string;
  engine: "blender" | "openscad" | "fusion" | "nvidia" | "auto";
  category: "hero" | "functional" | "art" | "mechanical" | "quick_win";
  printTimeMin: number;   // rough estimate for Bambu A1 at recommended recipe
  notes: string;          // what to highlight during demo
}

/** Hero prompts — use these in the first 10 seconds of demo */
export const HERO_PROMPTS: DemoPrompt[] = [
  {
    prompt: "a phone stand with cable routing slot",
    engine: "blender",
    category: "hero",
    printTimeMin: 35,
    notes: "Functional + printable in one piece. Show: describe → builds live → download 3MF → one-click print on Bambu A1. The money shot.",
  },
  {
    prompt: "a small dragon figurine",
    engine: "nvidia",
    category: "hero",
    printTimeMin: 45,
    notes: "NVIDIA TRELLIS textured mesh. Show: organic shape → Claude auto-recipes it → tree supports → prints standing up.",
  },
  {
    prompt: "a gear with 20 teeth, 40mm diameter",
    engine: "openscad",
    category: "hero",
    printTimeMin: 15,
    notes: "Parametric precision. Show: exact dimensions → OpenSCAD script → functional part.",
  },
];

/** Blender engine — organic/figurine shapes with procedural bpy */
export const BLENDER_PROMPTS: DemoPrompt[] = [
  {
    prompt: "a cute sitting cat figurine",
    engine: "blender",
    category: "art",
    printTimeMin: 40,
    notes: "Clean organic form, tree supports for tail. Good for showing model class detection (figurine → 0.12mm layers).",
  },
  {
    prompt: "a small robot with antenna",
    engine: "blender",
    category: "art",
    printTimeMin: 35,
    notes: "Multi-part joined into single solid. Shows the join+ground pipeline.",
  },
  {
    prompt: "a snail with spiral shell",
    engine: "blender",
    category: "art",
    printTimeMin: 50,
    notes: "Spiral geometry — tests the manifold cleanup. Print on side to avoid shell supports.",
  },
  {
    prompt: "a desk nameplate that says CLAUDE",
    engine: "blender",
    category: "functional",
    printTimeMin: 20,
    notes: "Text + functional base. Shows Blender text conversion to mesh.",
  },
  {
    prompt: "a geometric succulent planter with drainage hole",
    engine: "blender",
    category: "functional",
    printTimeMin: 45,
    notes: "Hollow functional object. Shows auto-recipe detecting functional model → thicker walls.",
  },
];

/** OpenSCAD engine — parametric precision parts */
export const OPENSCAD_PROMPTS: DemoPrompt[] = [
  {
    prompt: "a rounded box 60x40x30mm with snap-fit lid",
    engine: "openscad",
    category: "functional",
    printTimeMin: 30,
    notes: "Precise dimensions + snap-fit tolerance. Print box and lid separately.",
  },
  {
    prompt: "a wall-mount hook rated for 5kg",
    engine: "openscad",
    category: "functional",
    printTimeMin: 15,
    notes: "Functional strength part. Auto-recipe should pick 40% infill + 3 walls.",
  },
  {
    prompt: "a cable management clip for 10mm cables",
    engine: "openscad",
    category: "quick_win",
    printTimeMin: 8,
    notes: "Tiny, fast print. Great for a quick live demo print — done in <10 min.",
  },
  {
    prompt: "a hex wrench holder with 6 slots",
    engine: "openscad",
    category: "functional",
    printTimeMin: 25,
    notes: "Organized functional tool. Shows parametric array operations.",
  },
  {
    prompt: "a stackable storage bin 80x60x40mm",
    engine: "openscad",
    category: "functional",
    printTimeMin: 55,
    notes: "Interlocking design. Shows how auto-recipe handles larger functional parts.",
  },
];

/** NVIDIA engine — organic figures with TRELLIS text→3D */
export const NVIDIA_PROMPTS: DemoPrompt[] = [
  {
    prompt: "a fantasy wizard with staff",
    engine: "nvidia",
    category: "art",
    printTimeMin: 50,
    notes: "Detailed textured mesh from TRELLIS. Show the GLB texture preview vs the printable STL.",
  },
  {
    prompt: "a tiny elephant",
    engine: "nvidia",
    category: "quick_win",
    printTimeMin: 30,
    notes: "Simple organic shape — fast NVIDIA generation, cute result.",
  },
  {
    prompt: "a Tesla Optimus robot figurine",
    engine: "nvidia",
    category: "art",
    printTimeMin: 45,
    notes: "Shows Browserbase web research → NVIDIA gets reference image context → better likeness.",
  },
];

/** Fusion engine — precise CAD with tolerances */
export const FUSION_PROMPTS: DemoPrompt[] = [
  {
    prompt: "an L-bracket with 4 screw holes, 3mm thick",
    engine: "fusion",
    category: "mechanical",
    printTimeMin: 12,
    notes: "Precise CAD part with tolerances. Shows Fusion MCP integration.",
  },
  {
    prompt: "a bearing housing for a 608 bearing",
    engine: "fusion",
    category: "mechanical",
    printTimeMin: 20,
    notes: "Precise bore tolerance. Shows Fusion's parametric CAD advantage over Blender.",
  },
  {
    prompt: "a motor mount plate with 4 M3 holes",
    engine: "fusion",
    category: "mechanical",
    printTimeMin: 15,
    notes: "Mechanical part with precise hole spacing. Auto-recipe picks mechanical profile.",
  },
];

/** Quick wins — print in <15 min for live demo */
export const QUICK_PRINTS: DemoPrompt[] = [
  {
    prompt: "a cable management clip for 10mm cables",
    engine: "openscad",
    category: "quick_win",
    printTimeMin: 8,
    notes: "Fastest printable demo — done while you're still talking.",
  },
  {
    prompt: "a keychain tag that says AI",
    engine: "blender",
    category: "quick_win",
    printTimeMin: 5,
    notes: "Tiny text + ring. Prints in 5 minutes, hand to judges.",
  },
  {
    prompt: "a simple whistle",
    engine: "openscad",
    category: "quick_win",
    printTimeMin: 10,
    notes: "Functional AND fun — blow it during demo. Tests internal cavity handling.",
  },
  {
    prompt: "a coin with CLAUDE HARDWARE embossed on it",
    engine: "openscad",
    category: "quick_win",
    printTimeMin: 6,
    notes: "Brand token. Hand one to each judge. Very fast print.",
  },
];

/** All demo prompts flattened */
export const ALL_DEMO_PROMPTS: DemoPrompt[] = [
  ...HERO_PROMPTS,
  ...BLENDER_PROMPTS,
  ...OPENSCAD_PROMPTS,
  ...NVIDIA_PROMPTS,
  ...FUSION_PROMPTS,
  ...QUICK_PRINTS,
];

/** Get the top N demo prompts for a specific engine */
export function getPromptsForEngine(engine: DemoPrompt["engine"], n = 5): DemoPrompt[] {
  return ALL_DEMO_PROMPTS.filter((p) => p.engine === engine).slice(0, n);
}

/** Get the recommended demo sequence (hero first, then quick wins for live printing) */
export function getDemoSequence(): DemoPrompt[] {
  return [...HERO_PROMPTS, ...QUICK_PRINTS.slice(0, 2)];
}
