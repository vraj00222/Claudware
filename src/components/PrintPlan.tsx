"use client";
import { LAND, LAND_FONT } from "@/design/tokens";
import type { PrintPlan as Plan } from "@/lib/agentEvent";

/**
 * Print Plan panel — the Print Brain readout (landing-page style, per Vraj's design call).
 * Pure: typed props in, JSX out (rule 4). Returns null until a `printplan` event lands, so it
 * stays hidden during boot/empty/forming and appears with the finished model.
 */
const eyebrow: React.CSSProperties = {
  fontFamily: LAND_FONT.sans, fontWeight: 500, fontSize: 11, letterSpacing: 1.5,
  textTransform: "uppercase", color: LAND.accent, marginBottom: 10,
};

export function PrintPlan({ plan }: { plan: Plan | null }) {
  if (!plan) return null;
  const d = plan.dimensions;
  const split = plan.recommendation === "split";
  const dl = plan.download.storageUrl || plan.download.stlUrl;
  return (
    <div style={{ borderTop: `1px solid ${LAND.border}`, background: LAND.card, padding: 18, fontFamily: LAND_FONT.sans, color: LAND.ink }}>
      <div style={eyebrow}>Print plan</div>

      <div style={{ fontFamily: LAND_FONT.mono, fontSize: 18, letterSpacing: -0.3, color: LAND.ink }}>
        {d.w} × {d.d} × {d.h} <span style={{ fontSize: 12, color: LAND.ink3 }}>mm</span>
      </div>

      <div style={{ fontFamily: LAND_FONT.serif, fontSize: 18, lineHeight: 1.2, margin: "10px 0 4px", color: LAND.ink }}>
        {split ? `Prints best as ${plan.parts.length} parts` : "Prints in one piece"}
      </div>
      <div style={{ fontSize: 13, lineHeight: 1.5, color: LAND.ink2 }}>{plan.reason}</div>

      {split && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
          {plan.parts.map((p, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: LAND.ink2, borderBottom: `1px solid ${LAND.border}`, paddingBottom: 5 }}>
              <span>{p.label}</span>
              <span style={{ fontFamily: LAND_FONT.mono }}>{p.w}×{p.d}×{p.h}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, color: plan.supports.needed ? LAND.accentHover : LAND.ink3 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", flex: "none", background: plan.supports.needed ? LAND.accent : LAND.borderStrong }} />
        {plan.supports.reason}
      </div>

      <a href={dl} download
        style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", height: 44, borderRadius: 8,
          background: LAND.accent, color: "#fff", textDecoration: "none", fontWeight: 500, fontSize: 14 }}>
        Download STL
      </a>
      <div style={{ marginTop: 8, fontSize: 11, color: LAND.muted, textAlign: "center" }}>Bed: {plan.bed.name}</div>
    </div>
  );
}
