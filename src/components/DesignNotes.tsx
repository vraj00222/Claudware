import { C } from "@/design/tokens";

interface Note { ok: boolean; text: string; action: boolean }

const NOTES: Note[] = [
  { ok: true, text: "0.3mm tolerance on cable slot — printed holes shrink", action: false },
  { ok: true, text: "Base edges chamfered — bed adhesion, no supports", action: false },
  { ok: false, text: "Riser wall 1.2mm — recommend 1.6mm", action: true },
  { ok: true, text: "Max overhang 45° — safe unsupported", action: false },
];

export function DesignNotes({ onApplyFix }: { onApplyFix: () => void }) {
  return (
    <div style={{ flex: "none", padding: "13px 16px", borderBottom: "1px solid #DCD7CC" }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".14em", color: "#A6A095", marginBottom: 11 }}>DESIGN NOTES</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        {NOTES.map((n, i) => (
          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9 }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, flex: "none", width: 14, color: n.ok ? C.accentWeak : C.warn }}>{n.ok ? "✓" : "⚠"}</span>
            <span style={{ flex: 1, fontSize: 13, lineHeight: "18px", color: "#6E6A60" }}>{n.text}</span>
            {n.action && <span onClick={onApplyFix} style={{ flex: "none", fontSize: 11.5, fontWeight: 500, color: "#232019", border: "1px solid #C9C3B6", borderRadius: 7, padding: "3px 9px", cursor: "pointer" }}>Apply fix</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
