"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveStore, latest, type Project, type AsyncProjectStore } from "@/lib/projects";
import { getCurrentUser, signOut, insforgeConfigured, type AuthUser } from "@/lib/insforge";
import { C, FONT } from "@/design/tokens";

const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
  " · " +
  new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

export default function ProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const storeRef = useRef<AsyncProjectStore | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [u, store] = await Promise.all([getCurrentUser(), getActiveStore()]);
      if (cancelled) return;
      storeRef.current = store;
      setUser(u);
      setProjects(await store.list());
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Sign out → back to the landing (`/`). signOut is a no-op when InsForge is unconfigured.
  const onSignOut = useCallback(async () => {
    setSigningOut(true);
    try { await signOut(); } finally { window.location.href = "/"; }
  }, []);

  const name = user?.profile?.name?.trim() || user?.email || "Guest";
  const initial = (user?.profile?.name || user?.email || "?").trim().charAt(0).toUpperCase();

  return (
    <div style={{ height: "100vh", overflowY: "auto", background: C.canvas, color: C.text, fontFamily: FONT.sans, fontWeight: 500 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 28px 80px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <a href="/app" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Claude Hardware" style={{ height: 58, width: "auto", display: "block" }} />
          </a>
          <a href="/app" style={{ display: "flex", alignItems: "center", gap: 6, height: 38, padding: "0 16px", borderRadius: 9999, border: `1px solid ${C.border}`, background: C.surface, color: C.text, textDecoration: "none", fontWeight: 700, fontSize: 13.5 }}>
            ← Studio
          </a>
        </div>

        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 24px" }}>Account</h1>

        {/* account card */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, border: `1px solid ${C.borderSub}`, borderRadius: 16, background: C.surface, padding: "20px 22px", marginBottom: 36 }}>
          {user?.profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.profile.avatar_url} alt="" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", display: "block", flex: "none" }} />
          ) : (
            <span style={{ width: 56, height: 56, borderRadius: "50%", background: C.accent, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700, flex: "none" }}>{initial}</span>
          )}
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 12, color: C.faint, marginTop: 4 }}>
              {user ? (user.email ?? "signed in") : insforgeConfigured ? "not signed in" : "local workspace (no account)"}
            </div>
          </div>
          {user ? (
            <button
              onClick={onSignOut}
              disabled={signingOut}
              style={{ flex: "none", height: 38, padding: "0 18px", borderRadius: 9999, border: `1px solid ${C.border}`, background: "transparent", color: C.text, cursor: signingOut ? "default" : "pointer", fontFamily: FONT.sans, fontWeight: 700, fontSize: 13.5, opacity: signingOut ? 0.6 : 1 }}
            >
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          ) : (
            <a href="/app" style={{ flex: "none", display: "flex", alignItems: "center", height: 38, padding: "0 18px", borderRadius: 9999, background: C.accent, color: C.printBtnInk, textDecoration: "none", fontWeight: 700, fontSize: 13.5 }}>
              Sign in
            </a>
          )}
        </div>

        {/* their projects */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em", margin: 0 }}>Your projects</h2>
          <a href="/projects" style={{ fontFamily: FONT.mono, fontSize: 12, color: C.accentWeak, textDecoration: "none", fontWeight: 700 }}>
            view all →
          </a>
        </div>

        {loaded && projects.length === 0 ? (
          <div style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: "48px 24px", textAlign: "center", background: C.surface }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>No projects yet</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 12.5, color: C.faint, marginBottom: 16 }}>describe something and watch it build — it&apos;ll save here automatically</div>
            <a href="/app" style={{ color: C.accentWeak, textDecoration: "none", fontWeight: 700 }}>Describe your first model →</a>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 16 }}>
            {projects.map((p) => {
              const v = latest(p);
              return (
                <a key={p.id} href={`/app?project=${p.id}`} style={{ display: "block", textDecoration: "none", color: "inherit", border: `1px solid ${C.borderSub}`, borderRadius: 14, background: C.surface, overflow: "hidden" }}>
                  <div style={{ height: 132, background: C.viewportBg, position: "relative", borderBottom: `1px solid ${C.borderSub}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ position: "absolute", inset: 0, backgroundImage: `repeating-linear-gradient(0deg, ${C.layer}55 0 1px, transparent 1px 7px)`, opacity: 0.6 }} />
                    <span style={{ position: "relative", fontFamily: FONT.mono, fontSize: 11, color: C.text2, background: C.surface, border: `1px solid ${C.borderSub}`, borderRadius: 7, padding: "4px 9px" }}>
                      {v ? `${v.stages} build steps` : "model"}
                    </span>
                  </div>
                  <div style={{ padding: "12px 13px 13px" }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, lineHeight: "19px", marginBottom: 7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: FONT.mono, fontSize: 10.5, color: C.faint }}>
                      <span>{fmtDate(p.updatedAt)}</span>
                      {v?.estimate && <span>{v.estimate.grams}g · {v.estimate.layers}L</span>}
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
