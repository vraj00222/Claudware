const MONO = "'JetBrains Mono', monospace";

/** Subtle version strip. Versions appear only as models are generated/edited — no add button,
 * no decorative dots; the current one gets a quiet (non-green) highlight. */
export function VersionRail({ current, count, onPick }: { current: number; count: number; onPick: (i: number) => void }) {
  return (
    <div style={{ flex: "none", height: 64, borderTop: "1px solid #DCD7CC", background: "#FBFAF6", display: "flex", alignItems: "center", gap: 9, padding: "0 18px" }}>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", color: "#A6A095", marginRight: 2 }}>VERSIONS</span>
      {count === 0 ? (
        <span style={{ fontFamily: MONO, fontSize: 11, color: "#C2BBAD" }}>—</span>
      ) : (
        Array.from({ length: count }, (_, i) => {
          const cur = current === i;
          return (
            <div
              key={i}
              onClick={() => onPick(i)}
              style={{
                width: 42, height: 42, borderRadius: 8, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                background: cur ? "#ECE7DC" : "#F4F1EA",
                border: `1px solid ${cur ? "#B8B1A2" : "#E4DFD4"}`,
              }}
            >
              <span style={{ fontFamily: MONO, fontSize: 11, color: cur ? "#232019" : "#A6A095" }}>{`v${i + 1}`}</span>
            </div>
          );
        })
      )}
    </div>
  );
}
