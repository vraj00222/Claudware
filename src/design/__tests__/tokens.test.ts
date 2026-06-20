import { describe, it, expect } from "vitest";
import { C } from "@/design/tokens";

describe("tokens", () => {
  it("exposes the semantic terracotta accent", () => {
    expect(C.accent).toBe("#cc785c");
  });
});
