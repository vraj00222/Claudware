import type { Bed } from "@/server/printPlan";

/** A printer bed profile — Print Brain's Bed plus the nozzle width (drives the thin-feature threshold). */
export interface PrinterBed extends Bed { nozzle: number }

/** Vraj's printer (the studio already shows "BAMBU-A1 online"). Real build volume 256×256×256, 0.4mm nozzle. */
export const BAMBU_A1: PrinterBed = { w: 256, d: 256, h: 256, name: "Bambu A1", nozzle: 0.4 };

/** Zero-printer fallback (matches Print Brain v1's DEFAULT_BED dimensions). */
export const GENERIC_BED: PrinterBed = { w: 220, d: 220, h: 250, name: "Generic 220×220×250", nozzle: 0.4 };
