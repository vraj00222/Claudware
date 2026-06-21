import { accessSync, constants, statSync } from "node:fs";
import path from "node:path";

/** True only for an existing, executable regular file (not a directory). */
function isExe(p: string): boolean {
  try {
    accessSync(p, constants.X_OK);
    return statSync(p).isFile();
  } catch {
    return false;
  }
}

/** Scan `$PATH` for an executable named `name`; returns its full path or null. */
function onPath(name: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const p = path.join(dir, name);
    if (isExe(p)) return p;
  }
  return null;
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

/**
 * Like {@link resolveBin}, but returns `null` instead of the bare name when the binary can't be found on
 * disk OR on `$PATH`. This gives callers a clear "not available" signal — used by key/flag-gated tools
 * (e.g. the slicer) that must fall back gracefully when their CLI isn't installed.
 */
export function resolveBinOrNull(name: string, candidates: string[] = [], envVar?: string): string | null {
  const fromEnv = envVar ? process.env[envVar] : undefined;
  if (fromEnv && isExe(fromEnv)) return fromEnv;
  for (const c of candidates) if (isExe(c)) return c;
  return onPath(name);
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

/** PrusaSlicer console-mode install locations (mac `.app` bundle + Homebrew + Linux apt/AppImage paths). */
export const SLICER_CANDIDATES = [
  ...macApp("PrusaSlicer", "PrusaSlicer"),
  ...macApp("Original Prusa Drivers", "PrusaSlicer"),
  "/opt/homebrew/bin/prusa-slicer", "/usr/local/bin/prusa-slicer", "/usr/bin/prusa-slicer",
  "/usr/bin/prusa-slicer-console", "/usr/local/bin/PrusaSlicer", "/opt/homebrew/bin/PrusaSlicer",
];

/**
 * The slicer binary, resolved at import for `execFile`. Falls back to the bare name (PATH resolution).
 * Use {@link resolveSlicerBin} when you need to know whether it's actually installed (gating).
 */
export const SLICER_BIN = resolveBin("prusa-slicer", SLICER_CANDIDATES, "SLICER_BIN");

/** Resolve the slicer binary, returning `null` when it isn't installed — the gate's "not available" signal. */
export function resolveSlicerBin(): string | null {
  return resolveBinOrNull("prusa-slicer", SLICER_CANDIDATES, "SLICER_BIN");
}
