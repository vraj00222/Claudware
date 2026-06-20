import type { PrintState, Estimate } from "@/lib/viewModel";

export interface PrintCenterProps {
  print: PrintState | null;
  estimate: Estimate | null;
  rippleKey: number;
  onSend: () => void;
}

export function PrintCenter({ print, estimate, rippleKey, onSend }: PrintCenterProps) {
  const printing = print !== null;
  const pct = printing ? Math.round((print!.layer / print!.totalLayers) * 100) : 0;
  const ready = estimate !== null;
  const statLine = estimate
    ? `${estimate.grams}g ${estimate.material} · ${Math.floor(estimate.minutes / 60)}h ${estimate.minutes % 60}m · ${estimate.layers} layers`
    : "describe a model to print";

  return (
    <div style={{ flex: "none", padding: "14px 16px 16px" }}>
      {printing ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5 }}>
            <span style={{ color: "#232019" }}>{print!.printer} · bed 60°C</span>
            <span style={{ color: "#a9583e" }}>{`${Math.floor(print!.etaMin / 60)}h ${print!.etaMin % 60}m`}</span>
          </div>
          <div style={{ height: 6, background: "#F0ECE3", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${pct}%`, backgroundImage: "repeating-linear-gradient(90deg,#cc785c 0 2px,#F6ECE6 2px 4px)", transition: "width .25s" }} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6E6A60" }}>
            {`layer ${print!.layer}/${print!.totalLayers} · 0.2mm`}<span style={{ animation: "hwblink 1s steps(1) infinite" }}>▍</span>
          </div>
          <div style={{ marginTop: 3, aspectRatio: "16/9", border: "1px solid #DCD7CC", borderRadius: 8, background: "#E4DED2", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#A6A095", letterSpacing: ".1em" }}>◉ printer cam</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: ready ? "#6E6A60" : "#A6A095" }}>{statLine}</div>
          <div
            onClick={ready ? onSend : undefined}
            style={{ position: "relative", background: "#cc785c", borderRadius: 9999, height: 42, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#ffffff", cursor: ready ? "pointer" : "default", overflow: "hidden", opacity: ready ? 1 : 0.4 }}
          >
            <span style={{ position: "relative", zIndex: 2 }}>Send to printer</span>
            <span key={rippleKey} style={{ position: "absolute", left: "50%", top: "50%", width: 80, height: 80, margin: "-40px 0 0 -40px", borderRadius: "50%", background: "rgba(255,255,255,.5)", ...(rippleKey > 0 ? { animation: "hwripple .6s ease-out" } : { opacity: 0 }) }} />
          </div>
        </div>
      )}
    </div>
  );
}
