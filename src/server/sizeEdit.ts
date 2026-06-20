/**
 * Detect a PURE size change in a refine prompt so we can scale the EXISTING mesh instead of
 * regenerating. Meshgen (TRELLIS) has no editable recipe, so a "make it smaller" regen produces a
 * DIFFERENT object — scaling the current mesh is instant + perfectly faithful. Mixed edits
 * ("smaller AND add a hat") return null → the caller regenerates on-subject instead.
 */
export type SizeEdit = { kind: "factor"; factor: number } | { kind: "height"; mm: number };

// Any of these means the prompt asks for MORE than a resize → must regenerate, not just scale.
const FEATURE = /\b(and|also|with|plus|add|remove|delete|write|put|give|color|colour|paint|text|name|logo|engrav|hat|wing|arm|leg|hole|handle|face|eye|hair|spike|horn|pose|sit|stand)\b/;
const BY_A_LOT = /\b(much|way|lot|lots|very|far|significantly)\b/;

export function parseSizeEdit(prompt: string): SizeEdit | null {
  const p = prompt.toLowerCase().trim();
  if (!p || p.split(/\s+/).length > 10) return null; // long prompts aren't pure resizes
  if (FEATURE.test(p)) return null;                  // mixed edit → regenerate on-subject

  // Absolute target height: "80mm tall", "12 cm", "5 inches high", "make it 100 mm".
  const abs = /(\d+(?:\.\d+)?)\s*(mm|cm|inches|inch|in|")(?![a-z])/.exec(p);
  if (abs) {
    const n = parseFloat(abs[1]);
    const u = abs[2];
    const mm = u === "cm" ? n * 10 : u === "in" || u === "inch" || u === "inches" || u === '"' ? n * 25.4 : n;
    if (mm > 0) return { kind: "height", mm };
  }

  // Multipliers: twice / double / half / "2x" / "3 times".
  if (/\b(twice|double|2x|two times)\b/.test(p)) return { kind: "factor", factor: 2 };
  if (/\b(triple|3x|three times)\b/.test(p)) return { kind: "factor", factor: 3 };
  if (/\bhalf\b/.test(p)) return { kind: "factor", factor: 0.5 };
  const mult = /(\d+(?:\.\d+)?)\s*(?:x|times)\b/.exec(p);
  if (mult) {
    const f = parseFloat(mult[1]);
    if (f > 0 && f <= 20) return { kind: "factor", factor: f };
  }

  // Percentage: "20% bigger", "30 percent smaller".
  const pct = /(\d+(?:\.\d+)?)\s*(?:%|percent)/.exec(p);
  if (pct) {
    const n = parseFloat(pct[1]);
    if (/\b(small|less|reduc|shrink|down)/.test(p)) return { kind: "factor", factor: Math.max(0.05, 1 - n / 100) };
    if (/\b(big|large|more|increas|grow|up)/.test(p)) return { kind: "factor", factor: 1 + n / 100 };
  }

  // Relative words: smaller / bigger (with an optional "much" intensifier).
  const smaller = /\b(smaller|shrink|reduce|tinier|tiny|compact|downsize)\b/.test(p);
  const bigger = /\b(bigger|larger|enlarge|grow|upsize)\b/.test(p) || /\bscale up\b/.test(p);
  if (smaller && !bigger) return { kind: "factor", factor: BY_A_LOT.test(p) ? 0.6 : 0.8 };
  if (bigger && !smaller) return { kind: "factor", factor: BY_A_LOT.test(p) ? 1.6 : 1.3 };

  return null;
}
