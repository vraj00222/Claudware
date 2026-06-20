import { Browserbase } from "@browserbasehq/sdk";

const API_KEY = process.env.BROWSERBASE_API_KEY;
export const PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;

/** True when Browserbase is configured. When false, callers use the zero-key fallback. */
export const browserbaseConfigured = Boolean(API_KEY);

const client = browserbaseConfigured ? new Browserbase({ apiKey: API_KEY as string }) : null;

/**
 * Fetch a page's content THROUGH Browserbase (verified browser + proxies + CAPTCHA solving),
 * so model-repo search pages don't bot-block us. Text content only (HTML/JSON) — STL binaries
 * are downloaded directly by the import route, not here. Times out so one slow site can't hang us.
 */
export async function bbFetch(url: string, timeoutMs = 15_000): Promise<string> {
  if (!client) throw new Error("browserbase not configured");
  const res = (await Promise.race([
    client.fetchAPI.create({ url, allowRedirects: true }),
    new Promise((_, rej) => setTimeout(() => rej(new Error("bbFetch timeout")), timeoutMs)),
  ])) as { statusCode?: number; content?: string };
  if (!res?.content) throw new Error(`bbFetch empty (${res?.statusCode ?? "?"})`);
  return res.content;
}
