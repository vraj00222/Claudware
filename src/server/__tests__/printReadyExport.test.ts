import { describe, it, expect } from "vitest";
import { trisToObj, trisTo3mf, makeZip, crc32 } from "../printReady/exportFormats";
import type { Tri, Vec3 } from "../printPlan";

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const tri2: Tri[] = [[v(0, 0, 0), v(1, 0, 0), v(0, 1, 0)], [v(1, 0, 0), v(1, 1, 0), v(0, 1, 0)]];

describe("crc32", () => {
  it("matches the standard check vector for '123456789'", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });
});

describe("trisToObj", () => {
  it("emits 3 vertices + 1 face per triangle", () => {
    const obj = trisToObj(tri2);
    expect((obj.match(/^v /gm) || []).length).toBe(6);
    expect((obj.match(/^f /gm) || []).length).toBe(2);
  });
});

describe("trisTo3mf", () => {
  const buf = trisTo3mf(tri2);
  it("is a valid OPC zip (PK local-header magic + an end-of-central-directory record)", () => {
    expect(buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))).toBe(true);
    expect(buf.includes(Buffer.from([0x50, 0x4b, 0x05, 0x06]))).toBe(true);
  });
  it("contains the 3MF parts + mesh xml (stored → bytes appear verbatim)", () => {
    const s = buf.toString("latin1");
    expect(s).toContain("[Content_Types].xml");
    expect(s).toContain("3dmodel.model");
    expect(s).toContain("<vertex");
    expect(s).toContain("<triangle");
    expect(s).toContain('unit="millimeter"');
  });
});

describe("makeZip", () => {
  it("stores an entry's bytes verbatim at the header-computed offset", () => {
    const data = Buffer.from("hello 3mf", "utf8");
    const zip = makeZip([{ name: "a.txt", data }]);
    const start = 30 + "a.txt".length; // local header (30) + filename, then raw stored data
    expect(zip.subarray(start, start + data.length).equals(data)).toBe(true);
  });
});
