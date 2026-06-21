import { describe, it, expect, beforeAll } from "vitest";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { OPENSCAD_BIN } from "@/server/bin";
import { planSplitParts, renderSplitParts } from "@/server/split";
import { parseStlAuto, boundingBox } from "@/server/printPlan";

const execFileP = promisify(execFile);

/** OpenSCAD must be resolvable to run these — auto-skip in environments without it (CI). */
function openscadAvailable(): boolean {
  if (existsSync(OPENSCAD_BIN)) return true;
  for (const p of ["/usr/bin/openscad", "/usr/local/bin/openscad", "/opt/homebrew/bin/openscad"]) if (existsSync(p)) return true;
  return false;
}

/** Watertight = every undirected edge is shared by exactly two triangles. */
function nonManifoldEdges(stl: Buffer): number {
  const tris = parseStlAuto(stl);
  const edges = new Map<string, number>();
  const key = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => {
    const ka = `${a.x.toFixed(3)},${a.y.toFixed(3)},${a.z.toFixed(3)}`;
    const kb = `${b.x.toFixed(3)},${b.y.toFixed(3)},${b.z.toFixed(3)}`;
    return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
  };
  for (const t of tris) for (let i = 0; i < 3; i++) {
    const k = key(t[i], t[(i + 1) % 3]);
    edges.set(k, (edges.get(k) ?? 0) + 1);
  }
  let bad = 0;
  for (const c of edges.values()) if (c !== 2) bad++;
  return bad;
}

const run = openscadAvailable() ? describe : describe.skip;

run("renderSplitParts — real OpenSCAD cut produces watertight parts", () => {
  let tmp = "";
  beforeAll(async () => { tmp = await mkdtemp(path.join(os.tmpdir(), "split-it-")); });

  async function makeModel(scad: string): Promise<Buffer> {
    const s = path.join(tmp, "src.scad");
    const o = path.join(tmp, "src.stl");
    await writeFile(s, scad);
    await execFileP(OPENSCAD_BIN, ["-o", o, s], { timeout: 60_000, maxBuffer: 16 << 20 });
    return readFile(o);
  }

  it("cuts a tall cylinder into 3 watertight push-fit parts", async () => {
    const mesh = await makeModel("$fn=64; cylinder(d=40, h=120);");
    const plan = planSplitParts(boundingBox(parseStlAuto(mesh)), { parts: 3 });
    expect(plan).not.toBeNull();
    const parts = await renderSplitParts(mesh, plan!, tmp);
    expect(parts).toHaveLength(3);
    for (const p of parts) {
      const buf = await readFile(p.stlPath);
      const tris = parseStlAuto(buf);
      expect(tris.length, `${p.label} has geometry`).toBeGreaterThan(10);
      expect(nonManifoldEdges(buf), `${p.label} is watertight`).toBe(0);
    }
  }, 120_000);

  it("AUTO-splits an over-bed bar into watertight parts", async () => {
    const mesh = await makeModel("cube([30,30,300]);");
    const plan = planSplitParts(boundingBox(parseStlAuto(mesh))); // no forced parts → auto
    expect(plan!.mode).toBe("auto");
    const parts = await renderSplitParts(mesh, plan!, tmp);
    for (const p of parts) {
      expect(nonManifoldEdges(await readFile(p.stlPath)), `${p.label} watertight`).toBe(0);
    }
  }, 120_000);

  // cleanup is best-effort; tmpdir is wiped by the OS anyway
  it("cleans up", async () => { await rm(tmp, { recursive: true, force: true }).catch(() => {}); expect(true).toBe(true); });
});
