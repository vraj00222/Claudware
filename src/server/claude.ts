/**
 * Claude via the Anthropic Messages API (raw `fetch`, no SDK dependency).
 *
 * Replaces every `claude -p` subprocess in the app. The agent CLI loaded MCP servers and reasoned
 * agentically for minutes on design prompts → blew past timeouts → generic fallbacks. These are all
 * single-shot text/vision completions, so we call /v1/messages directly: ~10–40s, no agent overhead.
 *
 * Key comes from ANTHROPIC_API_KEY (Next loads .env.local into process.env). No thinking (fast).
 */

const ENDPOINT = "https://api.anthropic.com/v1/messages";

const MODEL_ALIASES: Record<string, string> = {
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-8",
  haiku: "claude-haiku-4-5",
  fable: "claude-fable-5",
};

/** Map a short alias ("sonnet") or pass a full id ("claude-sonnet-4-6") through. Default: sonnet. */
export function resolveModel(model?: string): string {
  if (!model) return MODEL_ALIASES.sonnet;
  if (model.startsWith("claude-")) return model;
  return MODEL_ALIASES[model] ?? MODEL_ALIASES.sonnet;
}

type ContentBlock = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

type Opts = { model?: string; maxTokens?: number; timeoutMs?: number };

async function callMessages(content: string | ContentBlock[], opts?: Opts): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 120_000);
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: resolveModel(opts?.model),
        max_tokens: opts?.maxTokens ?? 8_000,
        messages: [{ role: "user", content }],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }>; stop_reason?: string };
    if (data.stop_reason === "refusal") throw new Error("Claude declined the request");
    const text = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    if (!text.trim()) throw new Error("empty response from Claude");
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

/** One-shot text completion. Returns the model's reply text (same as `claude -p` stdout). */
export function claudeText(prompt: string, opts?: Opts): Promise<string> {
  return callMessages(prompt, opts);
}

const MEDIA_TYPE: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

/**
 * Vision completion: reads each local image file → base64 → image content blocks, then the prompt.
 * Replaces `claude -p "look at the image at /path"` (the CLI's Read tool can open a path; the API can't).
 */
export async function claudeVision(prompt: string, imagePaths: string[], opts?: Opts): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  const blocks: ContentBlock[] = [];
  for (const p of imagePaths) {
    const ext = path.extname(p).toLowerCase();
    const media = MEDIA_TYPE[ext];
    if (!media) continue; // skip unsupported types rather than fail the whole call
    const data = (await readFile(p)).toString("base64");
    blocks.push({ type: "image", source: { type: "base64", media_type: media, data } });
  }
  if (!blocks.length) throw new Error("no readable image for vision call");
  blocks.push({ type: "text", text: prompt });
  return callMessages(blocks, opts);
}
