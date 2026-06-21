/**
 * Download filenames — name an exported file after the THING it actually is (the model's
 * prompt/title), not "model.stl" or an opaque job hash. Used by the download buttons so a
 * "cute dragon" build saves as `cute-dragon.stl` / `.3mf` / `.obj`.
 */

/** Turn a model name/prompt into a safe, human-readable file base (no extension). */
export function modelSlug(name: string | null | undefined, fallback = "model"): string {
  const slug = (name ?? "")
    .toLowerCase()
    .replace(/['"]/g, "")        // drop quotes so "lego" mug → lego-mug, not -lego--mug-
    .replace(/[^a-z0-9]+/g, "-") // any run of non-alphanumerics → single hyphen
    .replace(/^-+|-+$/g, "")     // trim leading/trailing hyphens
    .slice(0, 60)
    .replace(/-+$/g, "");        // re-trim in case the slice cut mid-hyphen
  return slug || fallback;
}

/** Download filename for a model export, e.g. `modelFileName("Cute Dragon", "stl")` → "cute-dragon.stl". */
export function modelFileName(name: string | null | undefined, ext: string, fallback = "model"): string {
  return `${modelSlug(name, fallback)}.${ext.replace(/^\./, "")}`;
}
