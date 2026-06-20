import type { ModelResult } from "../types";

/** Printables search page (the embedded JSON carries the results; rendered through Browserbase). */
export function printablesSearchUrl(query: string): string {
  return `https://www.printables.com/search/models?q=${encodeURIComponent(query)}`;
}

/**
 * Parse a Printables search page into results. The page embeds model records as JSON (App Router
 * flight payload, escaped). We unescape, then regex the contiguous `id/name/slug` model shape —
 * works on escaped OR clean input. license isn't in the payload, so we link out for it.
 */
export function parsePrintables(content: string): ModelResult[] {
  const c = content.replace(/\\"/g, '"').replace(/\\u002[fF]/g, "/").replace(/\\n/g, " ");
  const re = /"id":"(\d+)","name":"((?:[^"\\]|\\.)*)","slug":"([^"]+)"/g;
  const out: ModelResult[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(c))) {
    const [, id, rawName, slug] = m;
    if (seen.has(id)) continue;
    seen.add(id);
    const title = rawName.replace(/\\u[\dA-Fa-f]{4}/g, "").replace(/\\/g, "").trim() || "Untitled";
    const thumb = new RegExp(`"filePath":"(media/prints/${id}/[^"]+)"`).exec(c);
    const user = /"publicUsername":"((?:[^"\\]|\\.)*)"/.exec(c.slice(m.index, m.index + 1400));
    out.push({
      id: `printables:${id}`,
      title,
      author: user ? user[1].replace(/\\/g, "").trim() : "Printables maker",
      license: "See Printables",
      sourceSite: "printables",
      sourceUrl: `https://www.printables.com/model/${id}-${slug}`,
      thumbUrl: thumb ? `https://media.printables.com/${thumb[1]}` : "",
      downloadPage: `https://www.printables.com/model/${id}-${slug}/files`,
    });
  }
  return out;
}
