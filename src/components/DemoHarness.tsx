export interface Beat { label: string; go: () => void }

export function DemoHarness({ beats }: { beats: Beat[] }) {
  return (
    <div style={{ flex: "none", height: 46, display: "flex", alignItems: "center", gap: 12, padding: "0 18px", borderTop: "1px solid #DCD7CC", background: "#FBFAF6", zIndex: 6 }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: ".18em", color: "#A6A095", flex: "none" }}>DEMO&nbsp;HARNESS</span>
      <div style={{ width: 1, height: 15, background: "#DCD7CC", flex: "none" }} />
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 1, overflowX: "auto", minWidth: 0 }}>
        {beats.map((b, i) => (
          <div key={i} onClick={b.go} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6E6A60", padding: "5px 9px", borderRadius: 9999, cursor: "pointer", whiteSpace: "nowrap" }}>{b.label}</div>
        ))}
      </div>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: ".06em", color: "#A6A095", flex: "none" }}>auto-plays once · replay any moment</span>
    </div>
  );
}
