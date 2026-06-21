"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { getActiveStore, latest, type Project, type AsyncProjectStore } from "@/lib/projects";
import { C, FONT } from "@/design/tokens";

const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
  " · " +
  new Date(t).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

// Demo: only surface projects generated on Jun 20–21, 2026 (today + tomorrow); hide older clutter.
const DEMO_FROM = new Date(2026, 5, 20).getTime(); // Jun 20, 2026 00:00 local
const DEMO_TO = new Date(2026, 5, 22).getTime();   // Jun 22, 2026 00:00 local (exclusive)
const inDemoWindow = (t: number) => t >= DEMO_FROM && t < DEMO_TO;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const storeRef = useRef<AsyncProjectStore | null>(null);

  const refresh = useCallback(async () => {
    if (!storeRef.current) storeRef.current = await getActiveStore();
    const all = await storeRef.current.list();
    setProjects(all.filter((p) => inDemoWindow(p.createdAt)));
    setLoaded(true);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const remove = useCallback(async (id: string) => {
    const s = storeRef.current ?? (storeRef.current = await getActiveStore());
    await s.remove(id);
    void refresh();
  }, [refresh]);

  return (
    <div style={{ height: "100vh", overflowY: "auto", background: C.canvas, color: C.text, fontFamily: FONT.sans, fontWeight: 500 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 28px 80px" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
          <a href="/app" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Claude Hardware" style={{ height: 58, width: "auto", display: "block" }} />
          </a>
          <a href="/app" style={{ display: "flex", alignItems: "center", gap: 6, height: 38, padding: "0 16px", borderRadius: 9999, background: C.accent, color: C.printBtnInk, textDecoration: "none", fontWeight: 700, fontSize: 13.5 }}>
            <span style={{ fontSize: 16, marginTop: -1 }}>+</span> New project
          </a>
        </div>

        <h1 style={{ fontSize: 34, fontWeight: 800, letterSpacing: "-0.03em", margin: "0 0 4px" }}>Your projects</h1>
        <p style={{ fontFamily: FONT.mono, fontSize: 12.5, color: C.faint, margin: "0 0 28px" }}>
          {projects.length} saved · everything you&apos;ve described and built
        </p>

        {loaded && projects.length === 0 ? (
          <div style={{ border: `1px dashed ${C.border}`, borderRadius: 16, padding: "64px 24px", textAlign: "center", background: C.surface }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>No projects yet</div>
            <div style={{ fontFamily: FONT.mono, fontSize: 12.5, color: C.faint, marginBottom: 18 }}>describe something and watch it build — it&apos;ll save here automatically</div>
            <a href="/app" style={{ color: C.accentWeak, textDecoration: "none", fontWeight: 700 }}>Describe your first model →</a>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(248px, 1fr))", gap: 16 }}>
            {projects.map((p) => {
              const v = latest(p);
              return (
                <a key={p.id} href={`/app?project=${p.id}`} style={{ display: "block", textDecoration: "none", color: "inherit", border: `1px solid ${C.borderSub}`, borderRadius: 14, background: C.surface, overflow: "hidden" }}>
                  {/* thumbnail: layer-line motif over the viewport tone */}
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
                    <button
                      onClick={(e) => { e.preventDefault(); remove(p.id); }}
                      style={{ marginTop: 10, width: "100%", height: 28, borderRadius: 7, border: `1px solid ${C.borderSub}`, background: "transparent", color: C.faint, cursor: "pointer", fontFamily: FONT.mono, fontSize: 11 }}
                    >
                      delete
                    </button>
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
