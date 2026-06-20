import { describe, it, expect } from "vitest";
import { classifyPrompt, heuristicQuestions } from "../clarify";

describe("clarify heuristic", () => {
  it("classifies a dragon as a figure but the heuristic fallback asks ONLY size", () => {
    // The deterministic fallback no longer blind-guesses surface/pose (a "Scales/Furry?" on a Lego
    // Luffy is worse than asking nothing). Prompt-specific questions come from Claude; look detail
    // comes from enrichment. So the zero-Claude fallback is just the universal size question.
    expect(classifyPrompt("a chubby sitting dragon")).toBe("figure");
    const qs = heuristicQuestions("a chubby sitting dragon");
    expect(qs.some((q) => /skin|scales|feather/i.test(q.label))).toBe(false);
    expect(qs.length).toBe(1);
    expect(qs[0].id).toBe("size");
  });
  it("classifies a bracket as a part and asks only size", () => {
    expect(classifyPrompt("a 30mm corner bracket")).toBe("part");
    const qs = heuristicQuestions("a 30mm corner bracket");
    expect(qs.length).toBe(1);
    expect(qs[0].id).toBe("size");
  });
  it("size options map to mm, larger for display-size", () => {
    const size = heuristicQuestions("anything").find((q) => q.id === "size")!;
    expect(size.sizeMm!["size≈large"]).toBeGreaterThan(size.sizeMm!["size≈small"]);
  });
});
