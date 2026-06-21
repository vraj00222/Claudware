import type { StageStatus } from "@/lib/viewModel";
import type { AuthUser } from "@/lib/insforge";
import { StageTracker } from "./StageTracker";

export function TopBar({ stages, printerStatus, onNewChat, user }: { stages: StageStatus[]; printerStatus: string; onNewChat?: () => void; user?: AuthUser | null }) {
  return (
    <div style={{ height: 54, flex: "none", display: "flex", alignItems: "center", gap: 14, padding: "0 18px", borderBottom: "1px solid #DCD7CC", background: "#FBFAF6", zIndex: 6 }}>
      <a href="/" style={{ display: "flex", alignItems: "center", flex: "none", textDecoration: "none" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Claude Hardware" style={{ height: 44, width: "auto", display: "block" }} />
      </a>
      <button
        onClick={onNewChat}
        style={{ flex: "none", display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 13px 0 11px", borderRadius: 9999, border: "1px solid #C9C3B6", background: "#F0ECE3", color: "#232019", cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600 }}
      >
        <span style={{ fontSize: 15, lineHeight: 1, marginTop: -1 }}>+</span> New
      </button>
      <a
        href="/projects"
        style={{ flex: "none", display: "flex", alignItems: "center", height: 30, padding: "0 13px", borderRadius: 9999, border: "1px solid #C9C3B6", background: "#FBFAF6", color: "#232019", textDecoration: "none", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600 }}
      >
        Projects
      </a>
      <a
        href="/showcase"
        style={{ flex: "none", display: "flex", alignItems: "center", height: 30, padding: "0 13px", borderRadius: 9999, border: "1px solid #C9C3B6", background: "#FBFAF6", color: "#232019", textDecoration: "none", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600 }}
      >
        Showcase
      </a>
      <StageTracker stages={stages} />
      <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6E6A60" }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#cc785c", animation: "hwpulsedot 2.4s ease-in-out infinite" }} />
        <span>{printerStatus}</span>
      </div>
      {user && <AccountPill user={user} />}
    </div>
  );
}

/** Account entry-point → /profile (where account details + sign-out + their projects live).
 *  Only shown when signed in; the zero-key/dev-skip path has no user and stays uncluttered. */
function AccountPill({ user }: { user: AuthUser }) {
  const name = user.profile?.name?.trim().split(/\s+/)[0] || user.email || "Account";
  const initial = (user.profile?.name || user.email || "?").trim().charAt(0).toUpperCase();
  return (
    <a
      href="/profile"
      title="Account & projects"
      style={{ flex: "none", display: "flex", alignItems: "center", gap: 7, height: 30, padding: "0 11px 0 4px", borderRadius: 9999, border: "1px solid #C9C3B6", background: "#FBFAF6", color: "#232019", textDecoration: "none", fontFamily: "inherit", fontSize: 12.5, fontWeight: 600 }}
    >
      {user.profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.profile.avatar_url} alt="" style={{ width: 22, height: 22, borderRadius: "50%", display: "block", objectFit: "cover" }} />
      ) : (
        <span style={{ width: 22, height: 22, borderRadius: "50%", background: "#cc785c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{initial}</span>
      )}
      <span style={{ maxWidth: 96, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
    </a>
  );
}
