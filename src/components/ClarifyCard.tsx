"use client";
import { useState } from "react";
import { LAND, LAND_FONT } from "@/design/tokens";
import type { Question } from "@/lib/clarify";

/**
 * Clarify-first card (landing style) — asks the user a few quick questions before generating
 * (surface/pose for figures, a size question for everything). Pure: typed props in, JSX out.
 * Selected option `value`s fold into the generation prompt; the size answer also sets sizeMm.
 */
export interface ClarifyCardProps {
  prompt: string;
  questions: Question[];
  /** true while the questions are still being generated (claude) — show a thinking state + skip */
  loading?: boolean;
  onSubmit: (prefs: string[], sizeMm?: number) => void;
  onSkip: () => void;
}

export function ClarifyCard({ prompt, questions, loading, onSubmit, onSkip }: ClarifyCardProps) {
  // one selected option value per question id (free-text overrides via the same map)
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [free, setFree] = useState<Record<string, string>>({});

  const valueFor = (q: Question): string | undefined => {
    const ft = free[q.id]?.trim();
    if (ft) return q.id === "size" ? `size≈${ft}` : `${q.id}=${ft}`;
    return picked[q.id];
  };

  const submit = () => {
    const prefs: string[] = [];
    let sizeMm: number | undefined;
    for (const q of questions) {
      const v = valueFor(q);
      if (!v) continue;
      prefs.push(v);
      if (q.id === "size") {
        const ft = free.size?.trim();
        const m = ft && /([\d.]+)\s*(cm|mm|in|")?/i.exec(ft);
        if (m) {
          const n = parseFloat(m[1]);
          const unit = (m[2] || "mm").toLowerCase();
          sizeMm = unit === "cm" ? n * 10 : unit === "in" || unit === '"' ? n * 25.4 : n;
        } else if (q.sizeMm && picked.size) {
          sizeMm = q.sizeMm[picked.size];
        }
      }
    }
    onSubmit(prefs, sizeMm);
  };

  const chip = (active: boolean): React.CSSProperties => ({
    height: 30, padding: "0 13px", borderRadius: 9999, cursor: "pointer",
    border: `1px solid ${active ? LAND.accent : LAND.borderStrong}`,
    background: active ? LAND.accent : LAND.cream, color: active ? "#fff" : LAND.ink2,
    fontFamily: LAND_FONT.sans, fontSize: 13, fontWeight: active ? 600 : 500,
  });

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", background: LAND.surface, padding: 24 }}>
      <div style={{ width: "min(560px, 92%)", background: LAND.card, border: `1px solid ${LAND.border}`, borderRadius: 16, padding: 24, boxShadow: "0 8px 40px rgba(20,20,19,0.08)" }}>
        <div style={{ fontFamily: LAND_FONT.sans, fontWeight: 500, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: LAND.accent, marginBottom: 8 }}>
          A couple of quick choices
        </div>
        <div style={{ fontFamily: LAND_FONT.serif, fontSize: 22, lineHeight: 1.2, color: LAND.ink, marginBottom: 18 }}>
          Designing “{prompt}”
        </div>

        {loading && questions.length === 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0 2px", fontFamily: LAND_FONT.sans, fontSize: 13.5, color: LAND.ink2 }}>
            <span style={{ width: 9, height: 9, borderRadius: "50%", background: LAND.accent, display: "inline-block", animation: "hwpulsedot 1s ease-in-out infinite" }} />
            tailoring a couple of quick questions for this… you can generate now if you’re in a hurry.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {questions.map((q) => (
            <div key={q.id}>
              <div style={{ fontFamily: LAND_FONT.sans, fontSize: 13, fontWeight: 600, color: LAND.ink, marginBottom: 8 }}>{q.label}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                {q.options.map((o) => {
                  const active = picked[q.id] === o.value && !free[q.id]?.trim();
                  return (
                    <button key={o.value} onClick={() => { setPicked((p) => ({ ...p, [q.id]: o.value })); setFree((f) => ({ ...f, [q.id]: "" })); }} style={chip(active)}>
                      {o.label}
                    </button>
                  );
                })}
                {q.allowFreeText && (
                  <input
                    value={free[q.id] || ""}
                    onChange={(e) => setFree((f) => ({ ...f, [q.id]: e.target.value }))}
                    placeholder={q.id === "size" ? "or e.g. 30cm" : "or describe…"}
                    style={{ height: 30, minWidth: 110, flex: "0 1 140px", padding: "0 11px", borderRadius: 9999, border: `1px solid ${LAND.borderStrong}`, background: LAND.cream, color: LAND.ink, fontFamily: LAND_FONT.sans, fontSize: 13, outline: "none" }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 24 }}>
          <button onClick={onSkip} style={{ height: 38, padding: "0 16px", borderRadius: 9999, border: "none", background: "transparent", color: LAND.ink3, cursor: "pointer", fontFamily: LAND_FONT.sans, fontSize: 13, fontWeight: 500 }}>
            Skip
          </button>
          <button onClick={submit} style={{ height: 38, padding: "0 20px", borderRadius: 9999, border: "none", background: LAND.accent, color: "#fff", cursor: "pointer", fontFamily: LAND_FONT.sans, fontSize: 13, fontWeight: 700 }}>
            Generate →
          </button>
        </div>
      </div>
    </div>
  );
}
