import { describe, it, expect } from "vitest";
import { PRINTABLES_SAMPLE } from "./fixtures/printables-sample";
import { parsePrintables, printablesSearchUrl } from "@/server/modelSearch/sources/printables";

describe("parsePrintables", () => {
  it("extracts model records (id/title/slug/author/thumb) from the page payload", () => {
    const out = parsePrintables(PRINTABLES_SAMPLE);
    expect(out).toHaveLength(2);
    expect(out[0].sourceSite).toBe("printables");
    expect(out[0].id).toBe("printables:226502");
    expect(out[0].title).toBe("M6 Hex Bolt and Nut");
    expect(out[0].sourceUrl).toBe("https://www.printables.com/model/226502-m6-hex-bolt-and-nut");
    expect(out[0].author).toBe("BoltMaker");
    expect(out[0].thumbUrl).toContain("media/prints/226502/");
    expect(out[1].id).toBe("printables:107870");
  });

  it("returns [] for content with no models", () => {
    expect(parsePrintables("<html>nothing here</html>")).toEqual([]);
  });

  it("builds a search URL", () => {
    expect(printablesSearchUrl("hex bolt")).toContain("printables.com/search/models?q=hex%20bolt");
  });
});
