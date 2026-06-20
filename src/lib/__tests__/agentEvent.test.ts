import { describe, it, expect } from "vitest";
import { isToolEvent, type AgentEvent } from "@/lib/agentEvent";

describe("agentEvent", () => {
  it("narrows tool events", () => {
    const e: AgentEvent = { t: "00:03", kind: "tool", name: "write_openscad", status: "done", detail: "42 lines" };
    expect(isToolEvent(e)).toBe(true);
    if (isToolEvent(e)) expect(e.name).toBe("write_openscad");
  });
  it("rejects non-tool events", () => {
    const e: AgentEvent = { t: "00:01", kind: "plan", text: "do the thing" };
    expect(isToolEvent(e)).toBe(false);
  });
});
