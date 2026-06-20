import { describe, it, expect } from "vitest";
import { parseFusionExec, extractFusionStl, describeClaudeFailure } from "../fusion";

const ok = {
  id: 2, jsonrpc: "2.0",
  result: { content: [{ type: "text", text: '{\n  "message": "STL_OK /tmp/job/model.stl\\n",\n  "success": true\n}' }] },
};

describe("parseFusionExec", () => {
  it("returns the script's printed message on success", () => {
    expect(parseFusionExec(ok).message).toContain("STL_OK /tmp/job/model.stl");
  });

  it("throws on a JSON-RPC level error", () => {
    expect(() => parseFusionExec({ id: 2, jsonrpc: "2.0", error: { code: -32000, message: "boom in fusion" } }))
      .toThrow(/boom in fusion/);
  });

  it("throws with the script's message when success is false (the run() exception)", () => {
    const bad = { id: 2, jsonrpc: "2.0", result: { content: [{ type: "text", text: '{"message":"NameError: adsk not defined","success":false}' }] } };
    expect(() => parseFusionExec(bad)).toThrow(/NameError/);
  });

  it("throws on a malformed / empty response", () => {
    expect(() => parseFusionExec({ id: 2, jsonrpc: "2.0", result: { content: [] } })).toThrow();
  });
});

describe("extractFusionStl", () => {
  it("pulls the STL path out of the STL_OK line", () => {
    expect(extractFusionStl("STL_OK /var/folders/T/fusion_x.stl\n")).toBe("/var/folders/T/fusion_x.stl");
  });

  it("throws when no STL path was printed (build produced nothing)", () => {
    expect(() => extractFusionStl("did some work but exported nothing")).toThrow();
  });
});

describe("describeClaudeFailure", () => {
  it("gives a too-complex/timeout message when the child was killed (execFile timeout)", () => {
    // Node sets killed:true + signal SIGTERM + code null when a timeout kills the process.
    const msg = describeClaudeFailure({ killed: true, signal: "SIGTERM", code: null, message: "Command failed: claude -p ..." }, 200_000);
    expect(msg).toMatch(/too complex/i);
    expect(msg).toMatch(/200s/);
    expect(msg).not.toMatch(/Command failed/);
  });

  it("treats an ETIMEDOUT code as a timeout too", () => {
    expect(describeClaudeFailure({ code: "ETIMEDOUT" }, 200_000)).toMatch(/too complex/i);
  });

  it("relays the real error for a non-timeout failure (non-zero exit)", () => {
    const msg = describeClaudeFailure({ code: 1, message: "claude: not logged in" }, 200_000);
    expect(msg).toMatch(/not logged in/);
    expect(msg).not.toMatch(/too complex/i);
  });
});
