export type SourceSite = "printables" | "thangs" | "thingiverse" | "makerworld" | "curated";

export interface ModelResult {
  id: string;            // stable: `${sourceSite}:${remoteId}`
  title: string;
  author: string;
  license: string;       // e.g. "CC-BY", "CC0", "Standard" — shown for attribution
  sourceSite: SourceSite;
  sourceUrl: string;     // the model's page (attribution link)
  thumbUrl: string;
  stlUrl?: string;       // direct STL download if known; else import resolves it from the page
  downloadPage?: string; // page to resolve a download link from when stlUrl is absent
}

export interface ModelSearchProvider {
  search(query: string, limit?: number): Promise<ModelResult[]>;
}
