import type { ModelResult } from "./types";

/** Catalog entry = a ModelResult plus local-only search keywords (stripped before returning). */
type CatalogEntry = ModelResult & { keywords: string };

/**
 * A small built-in library of REAL, publicly-downloadable models (verified direct STL links). It does
 * double duty: the zero-key fallback (constitution — search works with no keys), AND the set of
 * always-importable results merged into live web search so "Use this" has working options even when a
 * live repo gates its downloads. Every stlUrl here is a public, no-auth direct download (GitHub).
 */
const CATALOG: CatalogEntry[] = [
  {
    id: "lib:benchy", title: "3DBenchy — the calibration boat", author: "CreativeTools",
    license: "CC-BY-ND", sourceSite: "curated",
    sourceUrl: "https://github.com/CreativeTools/3DBenchy",
    thumbUrl: "",
    stlUrl: "https://github.com/CreativeTools/3DBenchy/raw/master/Single-part/3DBenchy.stl",
    keywords: "boat benchy calibration test torture ship",
  },
  {
    id: "lib:extruder-idler", title: "Prusa i3 extruder idler", author: "Prusa Research",
    license: "GPL-3.0", sourceSite: "curated",
    sourceUrl: "https://github.com/prusa3d/Original-Prusa-i3/tree/MK3/Printed-Parts/stl",
    thumbUrl: "",
    stlUrl: "https://raw.githubusercontent.com/prusa3d/Original-Prusa-i3/MK3/Printed-Parts/stl/extruder-idler.stl",
    keywords: "idler gear bracket pulley tensioner bearing mount part mechanical",
  },
  {
    id: "lib:x-carriage", title: "Prusa i3 X-carriage", author: "Prusa Research",
    license: "GPL-3.0", sourceSite: "curated",
    sourceUrl: "https://github.com/prusa3d/Original-Prusa-i3/tree/MK3/Printed-Parts/stl",
    thumbUrl: "",
    stlUrl: "https://raw.githubusercontent.com/prusa3d/Original-Prusa-i3/MK3/Printed-Parts/stl/x-carriage.stl",
    keywords: "carriage bracket mount plate rail slider part mechanical",
  },
  {
    id: "lib:y-belt-holder", title: "Prusa i3 Y-belt holder", author: "Prusa Research",
    license: "GPL-3.0", sourceSite: "curated",
    sourceUrl: "https://github.com/prusa3d/Original-Prusa-i3/tree/MK3/Printed-Parts/stl",
    thumbUrl: "",
    stlUrl: "https://raw.githubusercontent.com/prusa3d/Original-Prusa-i3/MK3/Printed-Parts/stl/y-belt-holder.stl",
    keywords: "belt holder clip bracket clamp tensioner hook mount part",
  },
  {
    id: "lib:extruder-body", title: "Prusa i3 extruder body", author: "Prusa Research",
    license: "GPL-3.0", sourceSite: "curated",
    sourceUrl: "https://github.com/prusa3d/Original-Prusa-i3/tree/MK3/Printed-Parts/stl",
    thumbUrl: "",
    stlUrl: "https://raw.githubusercontent.com/prusa3d/Original-Prusa-i3/MK3/Printed-Parts/stl/extruder-body.stl",
    keywords: "extruder body bracket mount housing case enclosure part mechanical",
  },
];

/** Match query tokens against each entry's title + keywords; return ModelResults (no keywords field). */
export async function fallbackSearch(query: string, limit = 12): Promise<ModelResult[]> {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];
  return CATALOG
    .map((e) => {
      const hay = `${e.title} ${e.keywords}`.toLowerCase();
      const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      return { e, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ e }) => {
      const { keywords: _kw, ...rest } = e;
      void _kw;
      return rest;
    });
}
