import { describe, it, expect } from "vitest";
import { runProviders } from "../meshgen";
import type { MeshGenProvider, MeshGenRequest, MeshGenResult } from "../meshgen/types";

const req: MeshGenRequest = { prompt: "dragon", preferLive: false, jobDir: "/tmp/x" };
type Name = MeshGenResult["provider"];
const ok = (name: Name, textured = false): MeshGenProvider => ({
  name, available: async () => true,
  generate: async () => ({ stlPath: `/tmp/${name}.stl`, textured, provider: name, live: false }),
});
const down = (name: Name): MeshGenProvider => ({ name, available: async () => false, generate: async () => { throw new Error("unavailable"); } });
const boom = (name: Name): MeshGenProvider => ({ name, available: async () => true, generate: async () => { throw new Error("kaput"); } });

describe("runProviders fan-down", () => {
  it("uses the first available provider", async () => {
    const r = await runProviders([ok("rodin"), ok("nim"), ok("procedural")], req);
    expect(r.provider).toBe("rodin");
  });
  it("skips unavailable, then a throwing provider, landing on procedural", async () => {
    const r = await runProviders([down("rodin"), boom("nim"), ok("procedural")], req);
    expect(r.provider).toBe("procedural");
  });
});
