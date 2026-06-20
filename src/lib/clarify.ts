export type PromptClass = "character" | "figure" | "part" | "container" | "generic";

export interface QOption {
  label: string;
  /** appended to the prompt as a preference (e.g. "skin=scales") */
  value: string;
}

export interface Question {
  id: string;
  label: string;
  options: QOption[];
  allowFreeText: boolean;
  /** for the size question: maps an option value → target height in mm */
  sizeMm?: Record<string, number>;
}

export interface ClarifyResult {
  promptClass: PromptClass;
  questions: Question[];
}

/** POST the prompt to /api/clarify; never blocks generation (returns empty on failure). */
export async function fetchClarify(prompt: string): Promise<ClarifyResult> {
  try {
    const r = await fetch("/api/clarify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    if (!r.ok) return { promptClass: "generic", questions: [] };
    return (await r.json()) as ClarifyResult;
  } catch {
    return { promptClass: "generic", questions: [] };
  }
}
