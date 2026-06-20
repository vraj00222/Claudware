import { useEffect, useRef } from "react";
import type { FeedRow } from "@/lib/viewModel";
import type { RequestEngine } from "@/lib/agentStream";
import { C } from "@/design/tokens";

const MINI_BARS = ["▼▁▂▃", "▁▼▂▃", "▁▂▼▃", "▁▂▃▼"];

function gutterAndBg(ep?: FeedRow["episode"]): [string, string] {
  if (ep === "a") return [C.amberGutterA, C.amberBg];
  if (ep === "b") return [C.amberGutterB, "transparent"];
  if (ep === "c") return [C.accentWeak, "transparent"];
  return ["transparent", "transparent"];
}

function glyphColor(kind: FeedRow["kind"]): string {
  if (kind === "ok") return C.accentWeak;
  if (kind === "active") return C.accent;
  if (kind === "warn") return C.warn;
  return C.text2;
}

const MONO = "'JetBrains Mono', monospace";
const ENGINES: [RequestEngine, string][] = [
  ["auto", "Auto"], ["openscad", "OpenSCAD"], ["blender", "Blender"], ["fusion", "Fusion"], ["nvidia", "NVIDIA"],
];

export function AgentFeed({ rows, engine, onPickEngine, cleanInBlender, onToggleClean, miniFrame }: {
  rows: FeedRow[];
  engine: RequestEngine;
  onPickEngine: (e: RequestEngine) => void;
  cleanInBlender: boolean;
  onToggleClean: (v: boolean) => void;
  miniFrame: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rows.length]);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, borderBottom: "1px solid #DCD7CC" }}>
      <div style={{ flex: "none", display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px 9px" }}>
        <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: ".14em", color: "#A6A095" }}>AGENT ACTIVITY</span>
        {/* engine picker — Auto routes per prompt; or force OpenSCAD/Blender/Fusion/NVIDIA. Always visible. */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <div title="Engine — Auto picks per prompt · OpenSCAD/Fusion: precise parametric · Blender: live procedural build · NVIDIA: organic figures (textured)" style={{ display: "flex", flexWrap: "wrap", background: "#F0ECE3", border: "1px solid #C9C3B6", borderRadius: 9999, padding: 2, fontFamily: MONO, fontSize: 9.5, gap: 2 }}>
            {ENGINES.map(([e, label]) => {
              const on = engine === e;
              return (
                <span key={e} onClick={() => onPickEngine(e)} style={{ cursor: "pointer", padding: "3px 8px", borderRadius: 9999, letterSpacing: ".02em", userSelect: "none", color: on ? "#232019" : "#A6A095", background: on ? "#FBFAF6" : "transparent", border: `1px solid ${on ? "#C9C3B6" : "transparent"}`, display: "flex", alignItems: "center", gap: 4 }}>
                  {on && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#cc785c", animation: "hwpulsedot 1.6s ease-in-out infinite" }} />}
                  {label}
                </span>
              );
            })}
          </div>
          {/* post-step combo: clean any engine's output in Blender (the nvidia+blender combo) */}
          <span onClick={() => onToggleClean(!cleanInBlender)} title="Post-step: import the result into Blender → weld/repair/recalc-normals/decimate → cleaner printable mesh" style={{ cursor: "pointer", userSelect: "none", display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 9999, fontFamily: MONO, fontSize: 9.5, color: cleanInBlender ? "#232019" : "#A6A095", background: cleanInBlender ? "#F6ECE6" : "#F0ECE3", border: `1px solid ${cleanInBlender ? "#cc785c" : "#C9C3B6"}` }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, border: `1px solid ${cleanInBlender ? "#cc785c" : "#A6A095"}`, background: cleanInBlender ? "#cc785c" : "transparent", color: "#fff", fontSize: 8, lineHeight: "10px", textAlign: "center" }}>{cleanInBlender ? "✓" : ""}</span>
            Clean in Blender
          </span>
        </div>
      </div>
      <div ref={ref} style={{ flex: 1, overflowY: "auto", padding: "0 14px 12px" }}>
        {rows.map((row, i) => {
          const [gutter, bg] = gutterAndBg(row.episode);
          return (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: 9, borderLeft: `2px solid ${gutter}`, borderBottom: "1px solid #E7E2D7", background: bg, animation: "hwfeedin .25s ease-out" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#A6A095", width: 34, flex: "none" }}>{row.t}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, width: 14, flex: "none", textAlign: "center", color: glyphColor(row.kind) }}>{row.glyph}</span>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, fontWeight: 500, color: "#232019" }}>{row.label}</span>
                  {row.kind === "active" && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#cc785c", letterSpacing: 1 }}>{MINI_BARS[miniFrame]}</span>}
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: "15px", color: row.kind === "warn" ? C.warn : C.faint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 228 }}>{row.detail}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
