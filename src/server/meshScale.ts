import { readFile, writeFile } from "node:fs/promises";
import { parseStlTriangles, boundingBox } from "./printPlan";

/**
 * Uniformly scale an ascii STL so its Z-height equals `targetMm`. Vertices are scaled; facet
 * normal DIRECTIONS are preserved (uniform scale doesn't change them). This is what makes a
 * "30 cm tall" request actually 300 mm — so Print Brain's bed/split logic sees the real size.
 */
export function scaleStlAsciiToHeight(stl: string, targetMm: number): string {
  if (!(targetMm > 0)) return stl;
  const bb = boundingBox(parseStlTriangles(stl));
  if (!(bb.h > 0)) return stl;
  const k = targetMm / bb.h;
  return stl.replace(
    // `-` is inside the class so negative exponents (…e-015) survive — else +"…e" → NaN (see printPlan).
    /(vertex\s+)(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)\s+(-?[\d.eE+-]+)/g,
    (_m, p, x, y, z) => `${p}${+x * k} ${+y * k} ${+z * k}`,
  );
}

export async function scaleStlFileToHeight(srcPath: string, targetMm: number, outPath: string): Promise<string> {
  const out = scaleStlAsciiToHeight(await readFile(srcPath, "utf8"), targetMm);
  await writeFile(outPath, out);
  return outPath;
}
