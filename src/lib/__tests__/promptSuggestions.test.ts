import { describe, it, expect } from "vitest";
import { pickSuggestions, matchSuggestion } from "@/lib/promptSuggestions";

describe("pickSuggestions", () => {
  it("returns the requested number of suggestions", () => {
    expect(pickSuggestions(3)).toHaveLength(3);
    expect(pickSuggestions(5)).toHaveLength(5);
  });

  it("picks from multiple categories for variety", () => {
    const picks = pickSuggestions(5);
    const cats = new Set(picks.map((s) => s.category));
    expect(cats.size).toBeGreaterThanOrEqual(3);
  });

  it("returns no duplicates", () => {
    const picks = pickSuggestions(8);
    const texts = picks.map((s) => s.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe("matchSuggestion", () => {
  it("returns null for short input (< 2 chars)", () => {
    expect(matchSuggestion("")).toBeNull();
    expect(matchSuggestion("a")).toBeNull();
  });

  it("matches a prefix case-insensitively", () => {
    const m = matchSuggestion("a chub");
    expect(m).toBe("a chubby sitting dragon");
  });

  it("returns null when input matches the full suggestion exactly", () => {
    expect(matchSuggestion("a chubby sitting dragon")).toBeNull();
  });

  it("returns null for non-matching input", () => {
    expect(matchSuggestion("zzz nonexistent")).toBeNull();
  });
});
