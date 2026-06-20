import { bbFetch } from "../bb";
import type { ModelResult } from "../types";
import { printablesSearchUrl, parsePrintables } from "./printables";

export interface Source { name: string; run(query: string): Promise<ModelResult[]>; }

const printables: Source = {
  name: "printables",
  async run(query) { return parsePrintables(await bbFetch(printablesSearchUrl(query))); },
};

// Scaffolds — same shape; fill the URL + parser per site, then they join the parallel fan-out.
// Kept returning [] so the fan-out already includes them without breaking before they're built.
const thangs: Source = { name: "thangs", async run() { return []; } };
const thingiverse: Source = { name: "thingiverse", async run() { return []; } };
const makerworld: Source = { name: "makerworld", async run() { return []; } };

/** Source priority order (also the merge priority). Printables first (cleanest), then the rest. */
export const SOURCES: Source[] = [printables, thangs, thingiverse, makerworld];
