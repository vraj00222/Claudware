/**
 * Staged OpenSCAD generator (server-side, pure string generation).
 *
 * Turns a natural-language prompt into an ORDERED list of build stages, where each
 * stage is a complete, renderable .scad program for the model "so far". Rendering the
 * stages in sequence makes the object visibly assemble — base → walls → openings → roof —
 * which is what streams into the viewport (and what you watch rebuild in the OpenSCAD app).
 *
 * Recognised shapes (deterministic, instant, offline): house/hut/cabin, box/cube,
 * cylinder/tube/vase. Anything else falls back to the Claude CLI generator (see route).
 */
import { parseStlTriangles, type Tri } from "./printPlan";

export interface Stage {
  /** short machine label, e.g. "cut_windows" */
  label: string;
  /** human detail for the feed, e.g. "2 windows · 11mm" */
  detail: string;
  /** a full, self-contained .scad program rendering the model up to this stage */
  scad: string;
}

export interface GenPlan {
  object: string;
  /** one-line plan summary for the feed's first row */
  summary: string;
  stages: Stage[];
  /** params echoed for UI/debug */
  params: Record<string, number>;
}

const num = (re: RegExp, s: string, dflt: number): number => {
  const m = s.match(re);
  return m ? Number(m[1]) : dflt;
};

/** Pick the object type from the prompt. */
export function classify(prompt: string): "house" | "box" | "cylinder" {
  const p = prompt.toLowerCase();
  if (/\b(house|hut|cabin|home|cottage|shed)\b/.test(p)) return "house";
  if (/\b(cylinder|tube|pipe|vase|cup|mug|ring|pot)\b/.test(p)) return "cylinder";
  return "box";
}

// ───────────────────────────── house ─────────────────────────────

function houseStages(prompt: string): GenPlan {
  const p = prompt.toLowerCase();
  let windows = num(/(\d+)\s*window/, p, 2);
  if (/\bno\s+window/.test(p)) windows = 0;
  windows = Math.max(0, Math.min(4, windows));
  const hasDoor = !/\bno\s+door\b/.test(p);
  const hasRoof = !/\b(no\s+roof|flat\s+roof|flat\s+top|open\s+top)\b/.test(p);

  const W = num(/(\d+)\s*mm\s*wide/, p, 64);
  const D = 48;
  const H = num(/(\d+)\s*mm\s*(tall|high)/, p, 40);
  const params = { W, D, H, t: 3, fl: 3, dW: 14, dH: 22, wW: 11, wH: 11, rH: 20, windows };

  // Compute window left-edge X positions that flank the centred door without overlapping it.
  // Split the front wall into a left and right region (excluding the door band) and spread
  // the windows proportionally to each region's width.
  const winXs = (n: number): number[] => {
    if (n <= 0) return [];
    const t = 3, dW = 14, wW = 11, gap = 4;
    const bandL = W / 2 - dW / 2 - gap; // left edge of door zone
    const bandR = W / 2 + dW / 2 + gap; // right edge of door zone
    const lLo = t + 3, lHi = bandL; // usable left span [lLo, lHi]
    const rLo = bandR, rHi = W - t - 3; // usable right span
    const lW = Math.max(0, lHi - lLo), rW = Math.max(0, rHi - rLo);
    let nl = lW + rW > 0 ? Math.round((n * lW) / (lW + rW)) : 0;
    nl = Math.max(0, Math.min(n, nl));
    const nr = n - nl;
    const spread = (lo: number, hi: number, k: number): number[] =>
      Array.from({ length: k }, (_, i) => {
        const c = lo + ((i + 1) * (hi - lo)) / (k + 1); // slot centre
        return Math.round((c - wW / 2) * 10) / 10; // left edge
      });
    return [...spread(lLo, lHi, nl), ...spread(rLo, rHi, nr)];
  };

  // shared header + modules; a stage just calls the modules it has "built" so far.
  const header = `// ${prompt.trim()}
$fn = 48;
W = ${W}; D = ${D}; H = ${H};   // footprint + wall height (mm)
t = 3; fl = 3;                  // wall thickness, floor thickness
dW = 14; dH = 22;               // door
wW = 11; wH = 11; wZ = fl + 14; // windows + sill height
rH = 20;                        // roof rise

module shell() {
  cube([W, D, fl]);                                   // floor slab
  translate([0, 0, fl]) difference() {                // 4 hollow walls
    cube([W, D, H]);
    translate([t, t, 0]) cube([W - 2*t, D - 2*t, H + 1]);
  }
}
module door()    { translate([W/2 - dW/2, -1, fl]) cube([dW, t + 2, dH]); }
module windows(xs) {                                  // xs = left-edge X of each window
  for (x = xs) translate([x, -1, wZ]) cube([wW, t + 2, wH]);
}
module roof() {
  translate([0, D/2, fl + H]) rotate([0, 90, 0])      // gable ridge along X
    linear_extrude(height = W)
      polygon([[0, -D/2], [0, D/2], [-rH, 0]]);
}
`;

  const wx = winXs(windows);

  // Body composition per stage. Door + windows are cut from the solid shell.
  const bodyAt = (s: { door: boolean; xs: number[]; roof: boolean }) => {
    const cuts: string[] = [];
    if (s.door) cuts.push("    door();");
    if (s.xs.length) cuts.push(`    windows([${s.xs.join(", ")}]);`);
    const solid = cuts.length
      ? `difference() {\n  shell();\n${cuts.join("\n")}\n}`
      : `shell();`;
    return s.roof ? `${solid}\nroof();` : solid;
  };

  const stages: Stage[] = [];
  // 1. base slab only
  stages.push({
    label: "base_plate",
    detail: `${W}×${D}mm floor`,
    scad: header + `cube([W, D, fl]);\n`,
  });
  // 2. walls
  stages.push({
    label: "raise_walls",
    detail: `4 walls · ${H}mm · ${params.t}mm thick`,
    scad: header + bodyAt({ door: false, xs: [], roof: false }) + "\n",
  });
  // 3. door
  if (hasDoor)
    stages.push({
      label: "cut_door",
      detail: `door ${params.dW}×${params.dH}mm`,
      scad: header + bodyAt({ door: true, xs: [], roof: false }) + "\n",
    });
  // 4. windows
  if (windows > 0)
    stages.push({
      label: "cut_windows",
      detail: `${windows} window${windows > 1 ? "s" : ""} · ${params.wW}mm`,
      scad: header + bodyAt({ door: hasDoor, xs: wx, roof: false }) + "\n",
    });
  // 5. roof
  if (hasRoof)
    stages.push({
      label: "add_roof",
      detail: `gable roof · +${params.rH}mm`,
      scad: header + bodyAt({ door: hasDoor, xs: wx, roof: true }) + "\n",
    });

  const feats = [hasDoor ? "a door" : null, windows ? `${windows} window${windows > 1 ? "s" : ""}` : null, hasRoof ? "a gable roof" : null].filter(Boolean);
  return {
    object: "house",
    summary: `block house — ${feats.join(", ")}`,
    stages,
    params,
  };
}

// ───────────────────────────── box ─────────────────────────────

function boxStages(prompt: string): GenPlan {
  const p = prompt.toLowerCase();
  const W = num(/(\d+)\s*mm\s*wide/, p, 50);
  const hollow = /\b(box|case|tray|container|enclosure|holder)\b/.test(p);
  const lid = /\blid\b/.test(p);
  const params = { W, D: 40, H: 30, t: 2.4, windows: 0 };
  const header = `// ${prompt.trim()}
$fn = 32;
W = ${W}; D = 40; H = 30; t = 2.4; r = 4;
module solid() { minkowski() { cube([W - 2*r, D - 2*r, H - 2*r]); sphere(r); } }
module box() { difference() { solid(); translate([t, t, t]) cube([W - 2*t, D - 2*t, H]); } }
`;
  const stages: Stage[] = [
    { label: "block_out", detail: `${W}×40×30mm`, scad: header + `solid();\n` },
  ];
  if (hollow) stages.push({ label: "hollow_walls", detail: `${params.t}mm walls`, scad: header + `box();\n` });
  if (lid) stages.push({ label: "add_lid", detail: "press-fit lid", scad: header + `box();\ntranslate([0,0,H+4]) difference(){ solid(); translate([t,t,-1]) cube([W-2*t,D-2*t,H-t]); }\n` });
  return { object: "box", summary: hollow ? "rounded box — hollowed shell" : "rounded block", stages, params };
}

// ───────────────────────────── cylinder ─────────────────────────────

function cylinderStages(prompt: string): GenPlan {
  const p = prompt.toLowerCase();
  const Dia = num(/(\d+)\s*mm\s*(wide|diameter|dia)/, p, 40);
  const H = num(/(\d+)\s*mm\s*(tall|high)/, p, 50);
  const hollow = /\b(tube|pipe|vase|cup|mug|pot|ring|hollow)\b/.test(p);
  const params = { Dia, H, t: 2.4, windows: 0 };
  const header = `// ${prompt.trim()}
$fn = 96;
Dia = ${Dia}; H = ${H}; t = 2.4; fl = 2.4;
`;
  const stages: Stage[] = [
    { label: "block_out", detail: `Ø${Dia} × ${H}mm`, scad: header + `cylinder(d = Dia, h = H);\n` },
  ];
  if (hollow)
    stages.push({
      label: "hollow_bore",
      detail: `${params.t}mm wall`,
      scad: header + `difference(){ cylinder(d=Dia,h=H); translate([0,0,fl]) cylinder(d=Dia-2*t,h=H); }\n`,
    });
  return { object: "cylinder", summary: hollow ? "hollow tube" : "cylinder", stages, params };
}

export interface PrintEstimate { grams: number; minutes: number; layers: number; material: string }

/**
 * Rough but DYNAMIC print estimate from an ASCII STL: bounding box → layer count,
 * mesh volume → filament grams (PLA), and a volume/layer-based time guess. Good enough
 * to replace the old hard-coded "14g PLA · 1h 23m · 847 layers".
 */
export function estimateFromStl(stl: string, layerH = 0.2): PrintEstimate {
  return estimateFromTris(parseStlTriangles(stl), layerH);
}

/** Same estimate from already-parsed triangles — used by the import path (binary STLs). */
export function estimateFromTris(tris: Tri[], layerH = 0.2): PrintEstimate {
  if (tris.length < 1) return { grams: 0, minutes: 0, layers: 0, material: "PLA" };

  let minZ = Infinity, maxZ = -Infinity;
  let vol6 = 0; // 6× signed volume
  for (const [a, b, c] of tris) {
    vol6 +=
      a.x * (b.y * c.z - b.z * c.y) -
      a.y * (b.x * c.z - b.z * c.x) +
      a.z * (b.x * c.y - b.y * c.x);
    for (const v of [a, b, c]) { if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z; }
  }
  const volMm3 = Math.abs(vol6) / 6;
  const height = Math.max(layerH, maxZ - minZ);
  const layers = Math.ceil(height / layerH);
  // printed material ≈ mesh volume × density × an average wall+infill packing factor
  const grams = Math.max(1, Math.round((volMm3 / 1000) * 1.24 * 0.55));
  const minutes = Math.max(4, Math.round((volMm3 / 1000) * 3.2 + layers * 0.05));
  return { grams, minutes, layers, material: "PLA" };
}

/** Main entry: deterministic plan for a recognised shape, else null (→ Claude fallback). */
export function planOpenscad(prompt: string): GenPlan | null {
  // Mechanical/complex subjects belong to Claude + BOSL2 (real gears, threads, bearings) — NOT the
  // deterministic primitive generator. Otherwise a stray word hijacks them: "engine BLOCK" → a box,
  // "CYLINDER head" → a tube. Defer anything mechanical so it gets real detail.
  if (/\b(gear|engine|motor|watch|clockwork|movement|bearing|screw|thread|threaded|turbine|piston|crank|crankshaft|gearbox|mechanism|sprocket|pulley|propeller|valve|worm|rack|knurl|hinge)\b/i.test(prompt))
    return null;
  switch (classify(prompt)) {
    case "house":
      return houseStages(prompt);
    case "cylinder":
      return cylinderStages(prompt);
    case "box": {
      // Only treat as a box if it actually reads like one; otherwise let Claude handle it.
      if (/\b(box|cube|block|case|tray|container|enclosure|holder|lid)\b/.test(prompt.toLowerCase()))
        return boxStages(prompt);
      return null;
    }
  }
}
