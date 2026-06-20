import type { StageStatus } from "@/lib/viewModel";

const NAMES = ["Describe", "Design", "Validate", "Slice", "Print"] as const;
const BOX = "width:18px;height:18px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:11px;flex:none;";

function boxStyle(s: StageStatus): React.CSSProperties {
  if (s === "done") return cssObj(BOX + "background:#F6ECE6;border:1px solid #E6CFC2;color:#cc785c;");
  if (s === "active")
    return cssObj(BOX + "border:1px solid #E6CFC2;color:#cc785c;background-image:repeating-linear-gradient(0deg,rgba(204,120,92,.85) 0 1px,transparent 1px 3px);background-size:100% 6px;animation:hwlayerfill .9s linear infinite;");
  return cssObj(BOX + "border:1px solid #C9C3B6;color:#A6A095;");
}

function labelStyle(s: StageStatus): React.CSSProperties {
  return { fontSize: 12, fontWeight: 500, color: s === "pend" ? "#A6A095" : "#232019" };
}

/** parse a "a:b;c:d;" inline-style string into a React style object */
function cssObj(s: string): React.CSSProperties {
  const o: Record<string, string> = {};
  s.split(";").filter(Boolean).forEach((d) => {
    const idx = d.indexOf(":");
    const k = d.slice(0, idx).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    o[k] = d.slice(idx + 1).trim();
  });
  return o as React.CSSProperties;
}

export function StageTracker({ stages }: { stages: StageStatus[] }) {
  return (
    <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>
      {NAMES.map((name, i) => (
        <div key={name} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={boxStyle(stages[i])}>{stages[i] === "done" ? "✓" : ""}</div>
            <span style={labelStyle(stages[i])}>{name}</span>
          </div>
          {i < 4 && <div style={{ width: 26, height: 1, background: "#C9C3B6", margin: "0 12px" }} />}
        </div>
      ))}
    </div>
  );
}
