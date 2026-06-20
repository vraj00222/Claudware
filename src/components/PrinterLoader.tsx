"use client";
import { useEffect, useState } from "react";
import { C } from "@/design/tokens";

/**
 * The PrinterLoader — Hardware Paper's spinner replacement (DESIGN.md §"PrinterLoader").
 * A width-stable ASCII 3D printer whose nozzle (▼) sweeps the gantry while the build row
 * fills, cycled ~180ms. Use it anywhere an operation takes time (boot, render, slice, print).
 *
 * Frames are the exact PRINTER array from frontend/Claude Hardware.dc.html (ported 1:1).
 * All four frames are 12 glyphs wide / 5 rows tall, so the <pre> never reflows.
 */
const PRINTER = [
  "┌─▼━━━━━━━━┐\n│ ▓░       │\n│ ████████ │\n│ ████████ │\n╘═◉══════◉╛",
  "┌━━━▼━━━━━━┐\n│ ▓▓▓▓░    │\n│ ████████ │\n│ ████████ │\n╘═◉══════◉╛",
  "┌━━━━━━━▼━━┐\n│ ▓▓▓▓▓▓▓░ │\n│ ████████ │\n│ ████████ │\n╘═◉══════◉╛",
  "┌─▼━━━━━━━━┐\n│ ░        │\n│ ████████ │\n│ ████████ │\n╘═◉══════◉╛",
] as const;

export interface PrinterLoaderProps {
  /** Live status bound to the current agent step (e.g. "printing layer 164/847"). */
  status: string;
  /** corner = small viewport overlay (forming/printing); center = prominent loading screen. */
  variant?: "corner" | "center";
}

export function PrinterLoader({ status, variant = "corner" }: PrinterLoaderProps) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % PRINTER.length), 180);
    return () => clearInterval(id);
  }, []);

  const center = variant === "center";
  const artSize = center ? 19 : 12;
  const artLine = center ? 21 : 13;
  const statusSize = center ? 12 : 11;

  return (
    <div
      role="status"
      aria-label={`printing — ${status}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: center ? "center" : "flex-start",
        gap: center ? 12 : 5,
        ...(center ? {} : { position: "absolute", left: 18, bottom: 16, zIndex: 3 }),
      }}
    >
      <pre
        aria-hidden
        style={{
          margin: 0,
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: artSize,
          lineHeight: `${artLine}px`,
          color: C.accent,
          letterSpacing: 0,
        }}
      >
        {PRINTER[idx]}
      </pre>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: statusSize, color: C.faint }}>
        {status}
        <span style={{ color: C.accent, animation: "hwblink 1s steps(1) infinite" }}>▍</span>
      </div>
    </div>
  );
}
