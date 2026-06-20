"use client";
import { C, FONT } from "@/design/tokens";

/**
 * RenderLoader — the prominent "this is taking a moment" loading screen for long ops
 * (boot, model generation, heavy renders/slices). Shows the printer mascot (printer-loader.png)
 * with two on-brand motions: a gentle bob, and a green layer-line scan that "prints" up the
 * machine (the signature layer-line motif). A mono status line cycles dots beneath it.
 *
 * Drop it anywhere the viewport would otherwise sit empty while work is in flight.
 */
export interface RenderLoaderProps {
  /** Primary status, bound to the live step (e.g. "Rendering preview"). */
  status: string;
  /** Optional reassurance line (e.g. "detailed models can take a moment"). */
  sub?: string;
  /** Printer artwork size in px. */
  size?: number;
}

export function RenderLoader({ status, sub, size = 132 }: RenderLoaderProps) {
  return (
    <div
      role="status"
      aria-label={`${status} — working`}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18, userSelect: "none" }}
    >
      <div style={{ position: "relative", width: size, height: size, animation: "hwbob 2.6s ease-in-out infinite" }}>
        <div
          aria-hidden
          style={{
            width: size,
            height: size,
            backgroundImage: "url(/printer-loader.png)",
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />
        {/* green layer-line scan sweeping bottom→top — reads as the machine "printing" */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: "16%",
            right: "16%",
            height: 9,
            top: "100%",
            borderTop: `1px solid ${C.accent}`,
            backgroundImage: "repeating-linear-gradient(0deg,rgba(204,120,92,.85) 0 1px,transparent 1px 3px)",
            backgroundSize: "100% 6px",
            animation: "hwprintscan 2.2s linear infinite",
            pointerEvents: "none",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 1, fontFamily: FONT.mono, fontSize: 13, color: C.text2 }}>
          <span>{status}</span>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ color: C.accent, animation: "hwpulsedot 1.2s ease-in-out infinite", animationDelay: `${i * 0.18}s` }}>
              .
            </span>
          ))}
        </div>
        {sub && <div style={{ fontFamily: FONT.mono, fontSize: 11, color: C.faint }}>{sub}</div>}
      </div>
    </div>
  );
}
