import { createClient } from "@insforge/sdk";

/**
 * InsForge browser client (auth + database + storage), key-gated per the constitution:
 * the app boots and demos with ZERO keys — when the env vars are absent this is `null`
 * and callers fall back to localStorage / the local filesystem.
 *
 * Auth method = Google OAuth (SPA flow). On return the SDK auto-detects `?insforge_code`
 * in the URL, exchanges it for a session, and cleans the URL — so just initialise the
 * client on the page the user lands back on. The admin (service) key is SERVER-ONLY and
 * lives in route handlers via createAdminClient — never here.
 */
const url = process.env.NEXT_PUBLIC_INSFORGE_URL;
const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

export const insforgeConfigured = Boolean(url && anonKey);

export const insforge = insforgeConfigured
  ? createClient({ baseUrl: url as string, anonKey: anonKey as string })
  : null;

export type AuthUser = {
  id: string;
  email?: string;
  profile?: { name?: string; avatar_url?: string } | null;
};

/** Current signed-in user, or null. On a cold load the SDK refreshes via the httpOnly cookie. */
export async function getCurrentUser(): Promise<AuthUser | null> {
  if (!insforge) return null;
  const { data, error } = await insforge.auth.getCurrentUser();
  return error ? null : ((data?.user as AuthUser | undefined) ?? null);
}

/** Start Google one-click sign-in. Redirects away; returns to `redirectTo` with the session set. */
export async function signInWithGoogle(redirectTo?: string): Promise<void> {
  if (!insforge) return;
  const target = redirectTo ?? (typeof window !== "undefined" ? window.location.origin : undefined);
  if (!target) return;
  await insforge.auth.signInWithOAuth("google", {
    redirectTo: target,
    additionalParams: { prompt: "select_account" },
  });
}

export async function signOut(): Promise<void> {
  if (!insforge) return;
  await insforge.auth.signOut();
}
