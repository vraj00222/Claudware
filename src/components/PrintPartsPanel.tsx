"use client";
import { LAND, LAND_FONT } from "@/design/tokens";
import { useState } from "react";
import type { SplitResult } from "@/lib/agentEvent";
import { modelSlug } from "@/lib/fileName";

/**
 * Print-in-parts panel — the "print version" surface: split a model into printable pieces joined by
 * PUSH-FIT connectors, with a Whole↔Parts viewport toggle and per-part STL downloads + the exact join
 * measurements. Pure: typed props in, JSX out (rule 4); the actual cut runs server-side via /api/split.
 */
const eyebrow: React.CSSProperties = {
  fontFamily: LAND_FONT.sans, fontWeight: 500, fontSize: 11, letterSpacing: 1.5,
  textTransform: "uppercase", color: LAND.accent, marginBottom: 10,
};

function Seg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, height: 30, borderRadius: 7, cursor: "pointer", fontFamily: LAND_FONT.sans, fontSize: 12.5, fontWeight: 600,
      border: active ? "none" : `1px solid ${LAND.borderStrong}`, background: active ? LAND.accent : "transparent",
      color: active ? "#fff" : LAND.ink2,
    }}>{children}</button>
  );
}

export function PrintPartsPanel({
  split, canSplit, splitting, view, onSplit, onSetView, modelName,
}: {
  split: SplitResult | null;
  canSplit: boolean;
  splitting: boolean;
  view: "whole" | "parts";
  onSplit: (parts: number) => void;
  onSetView: (v: "whole" | "parts") => void;
  modelName?: string | null;
}) {
  const [count, setCount] = useState(3);
  if (!split && !canSplit) return null;
  const c = split?.connector;

  return (
    <div style={{ flex: "none", borderTop: `1px solid ${LAND.border}`, background: LAND.card, padding: 18, fontFamily: LAND_FONT.sans, color: LAND.ink }}>
      <div style={eyebrow}>Print in parts</div>

      {!split ? (
        <>
          <div style={{ fontFamily: LAND_FONT.serif, fontSize: 16, lineHeight: 1.3, color: LAND.ink2, marginBottom: 12 }}>
            Split this into snap-together pieces with calibrated push-fit pegs — print on a smaller bed or in
            multiple colors, then press them together (no glue needed).
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[2, 3, 4].map((n) => (
              <Seg key={n} active={count === n} onClick={() => setCount(n)}>{n} parts</Seg>
            ))}
          </div>
          <button onClick={() => onSplit(count)} disabled={!canSplit || splitting} style={{
            width: "100%", height: 44, borderRadius: 8, border: "none", cursor: canSplit && !splitting ? "pointer" : "default",
            background: canSplit && !splitting ? LAND.accent : LAND.borderStrong, color: "#fff",
            fontFamily: LAND_FONT.sans, fontWeight: 600, fontSize: 14,
          }}>{splitting ? "Cutting parts…" : "Create push-fit version"}</button>
          <div style={{ marginTop: 8, fontSize: 11, color: LAND.muted, textAlign: "center" }}>cut · push-fit pegs · per-part STL</div>
        </>
      ) : (
        <>
          {/* Whole ↔ Parts viewport toggle */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            <Seg active={view === "whole"} onClick={() => onSetView("whole")}>Whole</Seg>
            <Seg active={view === "parts"} onClick={() => onSetView("parts")}>Parts ({split.parts.length})</Seg>
          </div>

          {c && (
            <div style={{ fontSize: 12.5, lineHeight: 1.5, color: LAND.ink2, marginBottom: 10 }}>
              <span style={{ fontWeight: 600, color: LAND.ink }}>Push-fit join:</span> {c.count} × Ø{c.pegDiameter}mm
              peg{c.count > 1 ? "s" : ""} → Ø{c.socketDiameter}mm socket{c.count > 1 ? "s" : ""} per seam ·{" "}
              <span style={{ fontFamily: LAND_FONT.mono }}>{c.clearance}mm</span> clearance · {c.pegLength}mm deep
            </div>
          )}
          <div style={{ fontSize: 12, lineHeight: 1.5, color: LAND.ink3, marginBottom: 12 }}>{split.guide}</div>

          {/* per-part downloads */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {split.parts.map((p) => (
              <a key={p.index} href={p.url} download={`${modelSlug(modelName)}-${modelSlug(p.label, `part-${p.index + 1}`)}.stl`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: LAND.ink2, textDecoration: "none", borderBottom: `1px solid ${LAND.border}`, paddingBottom: 5 }}>
                <span>{p.label} <span style={{ fontFamily: LAND_FONT.mono, color: LAND.ink3 }}>{p.w}×{p.d}×{p.h}</span></span>
                <span style={{ color: LAND.accent, fontSize: 11 }}>download STL ↓</span>
              </a>
            ))}
          </div>

          <button onClick={() => onSplit(split.parts.length)} disabled={splitting} style={{ marginTop: 12, background: "none", border: "none", color: LAND.accent, cursor: splitting ? "default" : "pointer", fontFamily: LAND_FONT.sans, fontSize: 12, padding: 0 }}>
            {splitting ? "Re-cutting…" : "↻ Re-cut"}
          </button>
        </>
      )}
    </div>
  );
}
