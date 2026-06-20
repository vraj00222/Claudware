"use client";
import { useState, useRef, useEffect } from "react";
import type { Mode } from "@/lib/viewModel";
import type { ChatMsg } from "@/lib/projects";

const THINKING_WORDS = [
  "Thinking", "Designing", "Pondering", "Sketching", "Imagining", "Conjuring",
  "Shaping", "Modeling", "Noodling", "Brewing", "Crafting", "Forming",
  "Dreaming", "Plotting", "Tinkering", "Sculpting", "Envisioning", "Drafting",
  "Composing", "Assembling", "Finessing", "Measuring", "Cooking", "Spinning up",
];

/** Claude-Code-style chat-side loader: a pulsing dot + a whimsical word that cycles, shown while
 *  the agent is preparing questions / designing (so a submit never looks frozen). */
function ThinkingRow() {
  const [i, setI] = useState(() => Math.floor(Math.random() * THINKING_WORDS.length));
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1 + Math.floor(Math.random() * 2)) % THINKING_WORDS.length), 1700);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8, fontSize: 14, lineHeight: "20px", color: "#6E6A60" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#cc785c", display: "inline-block", animation: "hwpulsedot 1s ease-in-out infinite" }} />
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5 }}>{THINKING_WORDS[i]}…</span>
    </div>
  );
}

const MODE_META: Record<Mode, [string, string]> = {
  parametric: ["⚙", "parametric"],
  figure: ["✦", "figure"],
  hybrid: ["⚙+✦", "hybrid"],
};

const EXAMPLES = [
  "a block house with 2 windows and a door",
  "a hollow vase 60mm tall",
  "a rounded box with a lid",
];

export interface ConversationPanelProps {
  mode: Mode;
  showConvo: boolean;
  micActive: boolean;
  showModePopover: boolean;
  showRefImage: boolean;
  /** show the chat-side word-cycling loader (preparing questions / designing) */
  thinking?: boolean;
  /** the user's actual prompt to show in the bubble (falls back to the demo text) */
  userPrompt?: string;
  /** the full conversation thread (continuous across refinements) */
  messages?: ChatMsg[];
  /** live voice transcript shown in the input while listening */
  transcript?: string;
  /** whether browser speech recognition is available */
  voiceSupported?: boolean;
  onToggleMic: () => void;
  onToggleMode: () => void;
  onPickMode: (m: Mode) => void;
  onRemoveRef: () => void;
  /** attach a reference image (Claude vision describes it → folded into generation) */
  onAttachImage?: (file: File) => void;
  /** URL of the attached reference image (shows a thumbnail chip) */
  refImageUrl?: string | null;
  /** submit a typed/clicked prompt to the real engine */
  onSubmitPrompt?: (text: string) => void;
  /** search existing model repos instead of generating (Browserbase). */
  onFindExisting?: (text: string) => void;
}

export function ConversationPanel(p: ConversationPanelProps) {
  const [icon, label] = MODE_META[p.mode];
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const submit = () => {
    const t = text.trim();
    if (t) { p.onSubmitPrompt?.(t); setText(""); }
  };
  return (
    <div style={{ width: 300, flex: "none", borderRight: "1px solid #DCD7CC", background: "#FBFAF6", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{ padding: "14px 16px 8px", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".14em", color: "#A6A095", flex: "none" }}>CONVERSATION</div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 16px 12px", display: "flex", flexDirection: "column", gap: 14, minHeight: 0 }}>
        {p.showConvo ? (
          <>
            {/* CONTINUOUS conversation thread — every prompt + reply across all refinements (v1, v2, …) */}
            {(p.messages?.length ? p.messages : (p.userPrompt ? [{ role: "user" as const, text: p.userPrompt, at: 0 }] : [])).map((msg, i) =>
              msg.role === "user" ? (
                <div key={i} style={{ alignSelf: "flex-end", maxWidth: 240, background: "#DCD7CC", border: "1px solid #C9C3B6", borderRadius: "14px 14px 4px 14px", padding: "10px 13px", fontSize: 14, lineHeight: "20px", color: "#232019" }}>
                  {msg.text}
                </div>
              ) : (
                <div key={i} style={{ alignSelf: "flex-start", maxWidth: 248, fontSize: 14, lineHeight: "20px", color: "#6E6A60" }}>
                  {msg.text}
                </div>
              ),
            )}
            {p.thinking && <ThinkingRow />}
            {/* re-route engine chip (kept in sync with the header toggle) */}
            <div style={{ position: "relative", alignSelf: "flex-start" }}>
              <div onClick={p.onToggleMode} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#F0ECE3", border: "1px solid #C9C3B6", borderRadius: 9999, padding: "5px 11px 5px 9px", cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#232019", userSelect: "none" }}>
                <span style={{ color: "#a9583e" }}>{icon}</span><span>{label}</span>
                <span style={{ color: "#A6A095", fontSize: 9 }}>▾</span>
              </div>
              {p.showModePopover && (
                <div style={{ position: "absolute", top: 34, left: 0, width: 188, background: "#F0ECE3", border: "1px solid #C9C3B6", borderRadius: 10, padding: 5, zIndex: 20, display: "flex", flexDirection: "column", gap: 2 }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: ".12em", color: "#A6A095", padding: "5px 8px 3px" }}>RE-ROUTE ENGINE</div>
                  {(Object.keys(MODE_META) as Mode[]).map((m) => (
                    <div key={m} onClick={() => p.onPickMode(m)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 8px", borderRadius: 7, fontFamily: "'JetBrains Mono', monospace", fontSize: 12, cursor: "pointer", color: "#232019", background: p.mode === m ? "#DCD7CC" : "transparent" }}>
                      <span style={{ width: 16, display: "inline-block", color: "#a9583e" }}>{MODE_META[m][0]}</span>
                      <span style={{ flex: 1 }}>{MODE_META[m][1]}</span>
                      <span style={{ color: "#cc785c" }}>{p.mode === m ? "✓" : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          // empty-state placeholder — fills the panel and invites a prompt
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
            <div style={{ fontSize: 15, lineHeight: "21px", color: "#6E6A60" }}>
              Describe anything. I&apos;ll design it, make it printable, and show it forming — step by step.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: ".14em", color: "#A6A095" }}>TRY ONE</div>
              {EXAMPLES.map((c) => (
                <div
                  key={c}
                  onClick={() => p.onSubmitPrompt?.(c)}
                  style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#232019", background: "#F0ECE3", border: "1px solid #DCD7CC", borderRadius: 9, padding: "8px 11px", cursor: "pointer" }}
                >
                  {c}
                </div>
              ))}
            </div>
            <button
              onClick={() => p.onFindExisting?.(text)}
              style={{ marginTop: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, height: 38, borderRadius: 9999, border: "1px solid #C9C3B6", background: "#FBFAF6", color: "#232019", cursor: "pointer", fontFamily: "inherit", fontWeight: 600, fontSize: 13 }}
            >
              🔍 Find an existing model
            </button>
          </div>
        )}
      </div>

      <div style={{ flex: "none", borderTop: "1px solid #DCD7CC", padding: "12px 14px 14px" }}>
        {p.refImageUrl && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "5px 7px", border: "1px solid #cc785c", borderRadius: 8, background: "#F6ECE6" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.refImageUrl} alt="reference" style={{ width: 30, height: 30, borderRadius: 5, objectFit: "cover", flex: "none" }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#6E6A60" }}>reference image</span>
            <span onClick={p.onRemoveRef} style={{ color: "#A6A095", cursor: "pointer", fontSize: 13, padding: "0 2px" }}>✕</span>
          </div>
        )}
        {p.micActive && (
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 22, marginBottom: 9, padding: "0 4px" }}>
            {Array.from({ length: 22 }, (_, i) => (
              <div key={i} style={{ width: 3, flex: 1, maxWidth: 4, borderRadius: 2, background: "#cc785c", transformOrigin: "bottom", animation: `hwwave ${0.5 + (i % 5) * 0.12}s ease-in-out infinite`, animationDelay: `${i * 0.03}s`, height: "100%" }} />
            ))}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 9, background: "#F0ECE3", border: "1px solid #C9C3B6", borderRadius: 9999, padding: "6px 7px 6px 6px" }}>
          <div
            onClick={p.onToggleMic}
            title={p.voiceSupported === false ? "Voice not supported in this browser" : "Speak your idea"}
            style={{ width: 30, height: 30, borderRadius: "50%", flex: "none", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, cursor: "pointer", ...(p.micActive ? { background: "#cc785c", color: "#ffffff" } : { background: "#DCD7CC", color: "#6E6A60" }) }}
          >●</div>
          <input
            value={p.micActive ? (p.transcript ?? "") : text}
            readOnly={p.micActive}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={p.micActive ? "listening…" : "Describe anything — e.g. 'a block house…'"}
            style={{ flex: 1, minWidth: 0, fontSize: 13, color: "#232019", fontWeight: 500, background: "transparent", border: "none", outline: "none", fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}
          />
          <span onClick={() => fileRef.current?.click()} title="Attach a reference image" style={{ color: "#A6A095", fontSize: 14, cursor: "pointer", paddingRight: 4 }}>📎</span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) p.onAttachImage?.(f); e.target.value = ""; }}
          />
        </div>
        <div
          onClick={() => p.onFindExisting?.(p.micActive ? (p.transcript ?? "") : text)}
          style={{ marginTop: 9, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#A6A095", cursor: "pointer" }}
        >
          🔍 or find an existing model →
        </div>
      </div>
    </div>
  );
}
