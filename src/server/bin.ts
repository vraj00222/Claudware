import { accessSync, constants, statSync } from "node:fs";

/** True only for an existing, executable regular file (not a directory). */
function isExe(p: string): boolean {
  try {
    accessSync(p, constants.X_OK);
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve an external CLI binary robustly across machines.
 *
 * `execFile()` does NOT run through a shell, so shell aliases and `~/.zshrc` PATH tweaks DON'T apply — it
 * needs a real executable. On macOS the demo tools (OpenSCAD, Blender, slicers) install as `.app` bundles
 * that are NOT on PATH (see SETUP.md), so a bare `execFile("openscad")` throws `ENOENT` and the whole build
 * silently produces no geometry. We therefore check, in order: an explicit env override, then well-known
 * install locations (mac `.app` bundles + Homebrew on Apple Silicon and Intel + common Linux paths), then
 * fall back to the bare name so `execFile` can still resolve it on PATH.
 */
export function resolveBin(name: string, candidates: string[] = [], envVar?: string): string {
  const fromEnv = envVar ? process.env[envVar] : undefined;
  if (fromEnv && isExe(fromEnv)) return fromEnv;
  for (const c of candidates) if (isExe(c)) return c;
  return name; // last resort: let execFile resolve it on PATH
}

/** macOS `.app` bundle executable paths (system-wide + per-user Applications). */
function macApp(app: string, exe: string): string[] {
  const home = process.env.HOME ?? "";
  return [
    `/Applications/${app}.app/Contents/MacOS/${exe}`,
    ...(home ? [`${home}/Applications/${app}.app/Contents/MacOS/${exe}`] : []),
  ];
}

export const OPENSCAD_BIN = resolveBin(
  "openscad",
  [...macApp("OpenSCAD", "OpenSCAD"), "/opt/homebrew/bin/openscad", "/usr/local/bin/openscad", "/usr/bin/openscad"],
  "OPENSCAD_BIN",
);

export const BLENDER_BIN = resolveBin(
  "blender",
  [...macApp("Blender", "Blender"), "/opt/homebrew/bin/blender", "/usr/local/bin/blender", "/usr/bin/blender"],
  "BLENDER_BIN",
);
