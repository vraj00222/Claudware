import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageTracker } from "@/components/StageTracker";

describe("StageTracker", () => {
  it("renders all five stages and a check on done stages", () => {
    render(<StageTracker stages={["done", "active", "pend", "pend", "pend"]} />);
    ["Describe", "Design", "Validate", "Slice", "Print"].forEach((n) => expect(screen.getByText(n)).toBeInTheDocument());
    expect(screen.getByText("✓")).toBeInTheDocument(); // the single 'done' stage
  });
});
