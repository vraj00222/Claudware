"use client";
import { LAND, LAND_FONT } from "@/design/tokens";
import type { PrintReadiness, CheckLevel } from "@/lib/agentEvent";
import { modelFileName, modelSlug } from "@/lib/fileName";

/**
 * Print-Readiness v2 panel — the per-version "Prepare for print" surface (landing style, like PrintPlan).
 * Pure: typed props in, JSX out (rule 4). Shows the "Prepare for print" button until a `printready`
 * package arrives, then the readiness score, the 4 checks, the recommended orientation, the decompose
 * decision, format downloads (STL/OBJ/3MF) + any Fusion assembly part downloads, and the plain narrative.
 */
const eyebrow: React.CSSProperties = {
  fontFamily: LAND_FONT.sans, fontWeight: 500, fontSize: 11, letterSpacing: 1.5,
  textTransform: "uppercase", color: LAND.accent, marginBottom: 10,
};

const LEVEL_COLOR: Record<CheckLevel, string> = { ok: "#5f8f6a", warn: LAND.accent, fail: LAND.accentHover };
const GRADE_COLOR = { ready: "#5f8f6a", minor: LAND.accent, needs_work: LAND.accentHover } as const;
const GRADE_LABEL = { ready: "Print-ready", minor: "Minor issues", needs_work: "Needs work" } as const;

function DownloadBtn({ url, fileName, label, primary }: { url: string; fileName: string; label: string; primary?: boolean }) {
  return (
    <a href={url} download={fileName} style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center", height: 32, padding: "0 12px",
      borderRadius: 7, textDecoration: "none", fontSize: 12.5, fontWeight: 500, fontFamily: LAND_FONT.sans,
      background: primary ? LAND.accent : "transparent", color: primary ? "#fff" : LAND.ink2,
      border: primary ? "none" : `1px solid ${LAND.borderStrong}`,
    }}>{label}</a>
  );
}

export function PrintReadyPanel({
  readiness, parts, canPrepare, preparing, onPrepare, modelName,
}: {
  readiness: PrintReadiness | null;
  parts?: { name: string; meshUrl: string }[] | null;
  canPrepare: boolean;
  preparing: boolean;
  onPrepare: () => void;
  modelName?: string | null;
}) {
  const hasParts = !!parts && parts.length > 0;
  if (!readiness && !canPrepare && !hasParts) return null;

  return (
    <div style={{ flex: "none", maxHeight: "46vh", overflowY: "auto", borderTop: `1px solid ${LAND.border}`, background: LAND.cream, padding: 18, fontFamily: LAND_FONT.sans, color: LAND.ink }}>
      <div style={eyebrow}>Print readiness</div>

      {!readiness ? (
        <>
          <div style={{ fontFamily: LAND_FONT.serif, fontSize: 16, lineHeight: 1.3, color: LAND.ink2, marginBottom: 12 }}>
            Check walls, holes & overhangs, pick the best orientation, and export a print file for your Bambu A1.
          </div>
          <button onClick={onPrepare} disabled={!canPrepare || preparing} style={{
            width: "100%", height: 44, borderRadius: 8, border: "none", cursor: canPrepare && !preparing ? "pointer" : "default",
            background: canPrepare && !preparing ? LAND.accent : LAND.borderStrong, color: "#fff",
            fontFamily: LAND_FONT.sans, fontWeight: 600, fontSize: 14,
          }}>{preparing ? "Preparing…" : "Prepare for print"}</button>
          <div style={{ marginTop: 8, fontSize: 11, color: LAND.muted, textAlign: "center" }}>diagnose · orient · export 3MF</div>
        </>
      ) : (
        <>
          {/* score + grade */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <div style={{ fontFamily: LAND_FONT.mono, fontSize: 26, letterSpacing: -0.5, color: GRADE_COLOR[readiness.grade] }}>{readiness.score}<span style={{ fontSize: 13, color: LAND.ink3 }}>/100</span></div>
            <div style={{ fontFamily: LAND_FONT.sans, fontSize: 13, fontWeight: 600, color: GRADE_COLOR[readiness.grade] }}>{GRADE_LABEL[readiness.grade]}</div>
          </div>

          {/* checks */}
          <div style={{ display: "flex", flexDirection: "column", gap: 7, margin: "12px 0" }}>
            {readiness.checks.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 8, fontSize: 12 }}>
                <span style={{ marginTop: 4, width: 7, height: 7, borderRadius: "50%", flex: "none", background: LEVEL_COLOR[c.level] }} />
                <span style={{ color: LAND.ink2, lineHeight: 1.4 }}><span style={{ color: LAND.ink, fontWeight: 600 }}>{c.label}.</span> {c.detail}</span>
              </div>
            ))}
          </div>

          {/* orientation */}
          <div style={{ marginTop: 8, paddingTop: 10, borderTop: `1px solid ${LAND.border}` }}>
            <div style={{ fontSize: 12, color: LAND.ink }}><span style={{ fontWeight: 600 }}>Orientation:</span> {readiness.orientation.label}</div>
            <div style={{ fontSize: 12, color: LAND.ink3, lineHeight: 1.45, marginTop: 2 }}>{readiness.orientation.why}</div>
          </div>

          {/* decompose (only when it adds info) */}
          {readiness.decompose.strategy !== "none" && (
            <div style={{ marginTop: 10, fontSize: 12, color: LAND.ink2, lineHeight: 1.45 }}>
              <span style={{ fontWeight: 600, color: LAND.ink }}>{readiness.decompose.strategy === "slab" ? "Split for the bed:" : "Print as parts:"}</span> {readiness.decompose.reason}
            </div>
          )}

          {/* narrative */}
          <div style={{ marginTop: 12, fontFamily: LAND_FONT.serif, fontSize: 14, lineHeight: 1.45, color: LAND.ink2 }}>{readiness.narrative}</div>

          {/* downloads */}
          <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {readiness.formats.map((f) => (
              <DownloadBtn key={f.format} url={f.url} fileName={modelFileName(modelName, f.format)} label={f.label} primary={f.format === "3mf"} />
            ))}
          </div>

          <button onClick={onPrepare} disabled={preparing} style={{ marginTop: 12, background: "none", border: "none", color: LAND.accent, cursor: preparing ? "default" : "pointer", fontFamily: LAND_FONT.sans, fontSize: 12, padding: 0 }}>
            {preparing ? "Re-checking…" : "↻ Re-check"}
          </button>
        </>
      )}

      {/* Fusion assembly parts — per-part downloads */}
      {hasParts && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${LAND.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: LAND.ink, marginBottom: 8 }}>{parts!.length} printable parts</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {parts!.map((p, i) => (
              <a key={i} href={p.meshUrl} download={`${modelSlug(modelName)}-${modelSlug(p.name, `part-${i + 1}`)}.stl`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: LAND.ink2, textDecoration: "none", borderBottom: `1px solid ${LAND.border}`, paddingBottom: 5 }}>
                <span>{p.name}</span>
                <span style={{ color: LAND.accent, fontSize: 11 }}>download STL ↓</span>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
