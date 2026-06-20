/** Prompt suggestions shown in the empty state + used for Tab-to-accept ghost text.
 *  Grouped by category so the UI can show a varied selection. */

export interface PromptSuggestion {
  text: string;
  category: "figure" | "functional" | "art" | "mechanical" | "toy";
}

const ALL: PromptSuggestion[] = [
  // figures
  { text: "a chubby sitting dragon", category: "figure" },
  { text: "a small robot figurine", category: "figure" },
  { text: "a cute cat figurine", category: "figure" },
  { text: "a miniature astronaut", category: "figure" },
  { text: "a tiny fox with a scarf", category: "figure" },
  // functional
  { text: "a hollow vase 60mm tall", category: "functional" },
  { text: "a rounded box with a lid", category: "functional" },
  { text: "a phone stand with cable slot", category: "functional" },
  { text: "a desk organizer with 3 slots", category: "functional" },
  { text: "a wall-mount hook for keys", category: "functional" },
  { text: "a toothbrush holder", category: "functional" },
  // art / decorative
  { text: "a geometric succulent planter", category: "art" },
  { text: "a twisted tower sculpture", category: "art" },
  { text: "a low-poly mountain landscape", category: "art" },
  { text: "a honeycomb wall shelf", category: "art" },
  // mechanical
  { text: "a gear with 24 teeth", category: "mechanical" },
  { text: "a snap-fit enclosure for Arduino", category: "mechanical" },
  { text: "a hinge with pin joint", category: "mechanical" },
  // toys
  { text: "a block house with 2 windows and a door", category: "toy" },
  { text: "a stackable ring tower toy", category: "toy" },
  { text: "a spinning top", category: "toy" },
];

/** Pick `n` random suggestions, one from each category first for variety. */
export function pickSuggestions(n = 5): PromptSuggestion[] {
  const cats = [...new Set(ALL.map((s) => s.category))];
  const picked: PromptSuggestion[] = [];
  const used = new Set<number>();

  // one from each category
  for (const cat of cats) {
    if (picked.length >= n) break;
    const pool = ALL.map((s, i) => ({ s, i })).filter((x) => x.s.category === cat && !used.has(x.i));
    if (pool.length) {
      const r = pool[Math.floor(Math.random() * pool.length)];
      picked.push(r.s);
      used.add(r.i);
    }
  }
  // fill remaining randomly
  while (picked.length < n) {
    const remaining = ALL.map((s, i) => ({ s, i })).filter((x) => !used.has(x.i));
    if (!remaining.length) break;
    const r = remaining[Math.floor(Math.random() * remaining.length)];
    picked.push(r.s);
    used.add(r.i);
  }
  return picked;
}

/** Find the best matching suggestion for ghost-text autocomplete.
 *  Returns the full suggestion text if the input is a prefix (case-insensitive, >= 2 chars). */
export function matchSuggestion(input: string): string | null {
  const t = input.toLowerCase().trim();
  if (t.length < 2) return null;
  for (const s of ALL) {
    if (s.text.toLowerCase().startsWith(t) && s.text.toLowerCase() !== t) {
      return s.text;
    }
  }
  return null;
}
