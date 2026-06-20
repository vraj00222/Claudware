"use client";

// Full-bleed stage: the studio FILLS the whole window edge-to-edge (per Vraj — no letterbox margins,
// no centered card). The inner layout is flex-based (TopBar + flex:1 columns), so it adapts to any
// window size without overflow. (Replaces the fixed 1536×864 scale-to-fit card, which letterboxed on
// non-16:9 windows — the "empty space it's supposed to fill".)
export function Scaler({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-screen-label="Claude Hardware Studio"
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "#FBFAF6",
        fontFamily: "'Bricolage Grotesque', system-ui, sans-serif",
        color: "#232019",
        fontWeight: 500,
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </div>
  );
}
