import { describe, it, expect } from "vitest";
import { parseInspectScore } from "../inspect";

describe("parseInspectScore", () => {
  it("parses a decimal score and passes above threshold", () => {
    const r = parseInspectScore("SCORE: 0.85\nREASON: clearly a sitting dragon", 0.6);
    expect(r.score).toBeCloseTo(0.85);
    expect(r.ok).toBe(true);
    expect(r.reason).toMatch(/dragon/i);
  });

  it("fails below threshold (triggers a retry)", () => {
    const r = parseInspectScore("0.3 — looks like an unrecognizable blob", 0.6);
    expect(r.score).toBeCloseTo(0.3);
    expect(r.ok).toBe(false);
  });

  it("understands an x/10 score", () => {
    expect(parseInspectScore("8/10 good likeness", 0.6).score).toBeCloseTo(0.8);
  });

  it("understands a percentage", () => {
    expect(parseInspectScore("about 80% there", 0.6).score).toBeCloseTo(0.8);
  });

  it("fails OPEN when no score can be parsed (never block a good model on a parse miss)", () => {
    const r = parseInspectScore("the model looks fine to me", 0.6);
    expect(r.score).toBeNull();
    expect(r.ok).toBe(true);
  });
});
