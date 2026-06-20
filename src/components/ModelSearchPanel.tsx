"use client";
import type { ModelResult } from "@/server/modelSearch/types";
import { C, FONT } from "@/design/tokens";

export interface ModelSearchPanelProps {
  open: boolean;
  query: string;
  results: ModelResult[];
  loading: boolean;
  error?: string | null;
  onUse: (r: ModelResult) => void;
  /** regenerate a printable version from a login-walled result's thumbnail (image→3D meshgen) */
  onMakeWithAi: (r: ModelResult) => void;
  onClose: () => void;
  onDesignInstead: () => void;
}

/** Overlay of existing-model search results. Pure: props in, JSX out (Studio owns the fetching). */
export function ModelSearchPanel(p: ModelSearchPanelProps) {
  if (!p.open) return null;
  return (
    <div
      onClick={p.onClose}
      style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(20,16,9,0.34)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "min(880px, 100%)", maxHeight: "86vh", display: "flex", flexDirection: "column", background: C.canvas, border: `1px solid ${C.border}`, borderRadius: 18, overflow: "hidden", fontFamily: FONT.sans, color: C.text, boxShadow: "0 24px 60px rgba(20,16,9,0.3)" }}
      >
        {/* header */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "16px 20px", borderBottom: `1px solid ${C.borderSub}`, background: C.surface }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em" }}>Existing models</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 11.5, color: C.faint, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.loading ? `searching the web for “${p.query}”…` : `${p.results.length} found for “${p.query}” · reuse one, or design your own`}
            </div>
          </div>
          <button onClick={p.onClose} style={{ flex: "none", width: 30, height: 30, borderRadius: "50%", border: `1px solid ${C.border}`, background: C.surface, color: C.text2, cursor: "pointer", fontSize: 15, lineHeight: 1 }}>✕</button>
        </div>

        {/* body */}
        <div style={{ flex: 1, overflowY: "auto", padding: 18, minHeight: 120 }}>
          {p.loading && p.results.length === 0 ? (
            <div style={{ padding: "44px 12px", textAlign: "center", fontFamily: FONT.mono, fontSize: 12.5, color: C.faint }}>
              <div style={{ marginBottom: 10, fontSize: 22 }}>🔍</div>
              searching Printables &amp; more via Browserbase…
            </div>
          ) : p.error ? (
            <div style={{ padding: "40px 12px", textAlign: "center", color: C.error, fontFamily: FONT.mono, fontSize: 12.5 }}>{p.error}</div>
          ) : p.results.length === 0 ? (
            <div style={{ padding: "40px 12px", textAlign: "center", fontFamily: FONT.mono, fontSize: 12.5, color: C.faint }}>
              nothing ready-made found — design it instead →
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
              {p.results.map((r) => (
                <div key={r.id} style={{ display: "flex", flexDirection: "column", border: `1px solid ${C.borderSub}`, borderRadius: 13, background: C.surface, overflow: "hidden" }}>
                  {/* thumb */}
                  <div style={{ height: 132, background: C.viewportBg, position: "relative", borderBottom: `1px solid ${C.borderSub}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {r.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumbUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    ) : (
                      <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(0deg, ${C.layer}55 0 1px, transparent 1px 7px)`, opacity: 0.6 }} />
                    )}
                    <span style={{ position: "absolute", top: 8, left: 8, fontFamily: FONT.mono, fontSize: 9.5, color: C.text2, background: C.surface, border: `1px solid ${C.borderSub}`, borderRadius: 6, padding: "2px 6px" }}>
                      {r.sourceSite}
                    </span>
                  </div>
                  <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: "18px", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.title}</div>
                    <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: C.faint, display: "flex", justifyContent: "space-between", gap: 6 }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.author}</span>
                      <span style={{ flex: "none" }}>{r.license}</span>
                    </div>
                    {/* Importable (has a direct STL) → Use this. Otherwise the repo gates the download
                        → link out honestly instead of a button that would fail. */}
                    <div style={{ display: "flex", gap: 8, marginTop: "auto", alignItems: "center" }}>
                      {r.stlUrl ? (
                        <>
                          <button
                            onClick={() => p.onUse(r)}
                            style={{ flex: 1, height: 32, borderRadius: 8, border: "none", background: C.accent, color: C.printBtnInk, cursor: "pointer", fontFamily: FONT.sans, fontWeight: 700, fontSize: 12.5 }}
                          >
                            Use this
                          </button>
                          <a href={r.sourceUrl} target="_blank" rel="noreferrer" title="Open source page" style={{ flex: "none", height: 32, display: "flex", alignItems: "center", padding: "0 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.text2, textDecoration: "none", fontFamily: FONT.mono, fontSize: 12 }}>↗</a>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => p.onMakeWithAi(r)}
                            title="Regenerate a printable version with AI"
                            style={{ flex: 1, height: 32, borderRadius: 8, border: "none", background: C.accent, color: C.printBtnInk, cursor: "pointer", fontFamily: FONT.sans, fontWeight: 700, fontSize: 12.5 }}
                          >
                            ✨ Make with AI
                          </button>
                          <a href={r.sourceUrl} target="_blank" rel="noreferrer" title={`View on ${r.sourceSite}`} style={{ flex: "none", height: 32, display: "flex", alignItems: "center", padding: "0 10px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.text2, textDecoration: "none", fontFamily: FONT.mono, fontSize: 12 }}>↗</a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* footer */}
        <div style={{ flex: "none", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 20px", borderTop: `1px solid ${C.borderSub}`, background: C.surface }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 10.5, color: C.faint }}>reuse beats regenerate for common objects</div>
          <button onClick={p.onDesignInstead} style={{ height: 34, padding: "0 16px", borderRadius: 9999, border: `1px solid ${C.border}`, background: C.surface, color: C.text, cursor: "pointer", fontFamily: FONT.sans, fontWeight: 700, fontSize: 13 }}>
            ✨ Design my own instead
          </button>
        </div>
      </div>
    </div>
  );
}
