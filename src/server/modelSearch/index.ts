import type { ModelSearchProvider } from "./types";
import { browserbaseConfigured } from "./bb";
import { fallbackSearch } from "./fallback";
import { browserbaseSearch } from "./browserbase";

const fallbackProvider: ModelSearchProvider = { search: (q, limit) => fallbackSearch(q, limit) };
const browserbaseProvider: ModelSearchProvider = { search: (q, limit) => browserbaseSearch(q, limit) };

/** Browserbase when configured, else the zero-key curated fallback. */
export function pickModelSearch(): ModelSearchProvider {
  return browserbaseConfigured ? browserbaseProvider : fallbackProvider;
}

export type { ModelResult, ModelSearchProvider } from "./types";
