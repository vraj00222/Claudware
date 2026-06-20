"use client";
import { useEffect, useState } from "react";
import { insforgeConfigured, getCurrentUser, signInWithGoogle, type AuthUser } from "@/lib/insforge";

/**
 * Gates the studio behind InsForge Google sign-in. Key-gated + resilient:
 *  - InsForge unconfigured (zero-key dev) → render the app directly.
 *  - signed in → render the app.
 *  - otherwise → a clean "Continue with Google" screen (with a dev-skip so a misconfigured OAuth
 *    app can never BLOCK the demo). The landing's CTAs deep-link here (/app).
 * After Google returns to /app?insforge_code=…, the SDK auto-exchanges the code → getCurrentUser resolves.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [bypass, setBypass] = useState(false);

  useEffect(() => {
    if (!insforgeConfigured) { setLoading(false); return; }
    let cancelled = false;
    getCurrentUser().then((u) => { if (!cancelled) { setUser(u); setLoading(false); } });
    return () => { cancelled = true; };
  }, []);

  if (!insforgeConfigured || user || bypass) return <>{children}</>;
  return <GateScreen loading={loading} onSkip={() => setBypass(true)} />;
}

function GateScreen({ loading, onSkip }: { loading: boolean; onSkip: () => void }) {
  const onGoogle = () => signInWithGoogle(typeof window !== "undefined" ? `${window.location.origin}/app` : undefined);
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FBFAF6", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 392, textAlign: "center" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Claude Hardware" style={{ height: 64, width: "auto", margin: "0 auto 18px", display: "block" }} />
        <h1 style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: "-0.02em", color: "#232019", margin: "0 0 8px" }}>
          Sign in to start designing.
        </h1>
        <p style={{ fontSize: 14, color: "#6E6A60", margin: "0 0 26px", lineHeight: 1.5 }}>
          Your projects, print files, and history — all in one place.
        </p>
        <button
          onClick={onGoogle}
          disabled={loading}
          style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 11, background: "#FBFAF6", border: "1px solid #C9C3B6", borderRadius: 9, padding: "0 18px", height: 48, cursor: loading ? "default" : "pointer", fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 600, fontSize: 15, color: "#232019", opacity: loading ? 0.6 : 1 }}
        >
          <GoogleG />
          <span>{loading ? "Checking session…" : "Continue with Google"}</span>
        </button>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#A6A095", marginTop: 16, lineHeight: 1.6 }}>
          By continuing you agree to the Terms &amp; Privacy Policy.
        </div>
        <div onClick={onSkip} style={{ fontSize: 12.5, color: "#A6A095", marginTop: 22, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>
          continue without signing in →
        </div>
      </div>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width={18} height={18} viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9.1h12.4c-.5 2.9-2.1 5.3-4.6 7l7.1 5.5c4.2-3.9 6.2-9.6 6.2-17z" />
      <path fill="#FBBC05" d="M10.4 28.3c-.5-1.4-.8-2.9-.8-4.3s.3-3 .8-4.3l-7.8-6.1C1 16.7 0 20.2 0 24s1 7.3 2.6 10.4l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.5-2 15.3-5.5l-7.1-5.5c-2 1.3-4.6 2.1-8.2 2.1-6.4 0-11.7-3.8-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
