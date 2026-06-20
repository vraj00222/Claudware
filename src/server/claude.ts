/**
 * Claude via the Anthropic Messages API.
 *
 * Uses the official @anthropic-ai/sdk client, wrapped with The Token Company's
 * withCompression() for automatic prompt compression (sponsor integration).
 * When TTC_API_KEY is set, all prompts are compressed via bear-2 before hitting Claude —
 * cuts token costs while preserving output quality. Key-gated: works fine without TTC.
 *
 * Key comes from ANTHROPIC_API_KEY (Next loads .env.local into process.env). No thinking (fast).
 */

import Anthropic from "@anthropic-ai/sdk";

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

// ───────────────────────── Client singleton (lazy init) ─────────────────────────
// Created on first use. If TTC_API_KEY is set, wraps with compression automatically.

let _client: Anthropic | (Anthropic & { compression: import("the-token-company").CompressionStats }) | undefined;

function getClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const base = new Anthropic({ apiKey });

  const ttcKey = process.env.TTC_API_KEY;
  if (ttcKey) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { withCompression } = require("the-token-company/anthropic") as typeof import("the-token-company/anthropic");
      _client = withCompression(base, {
        compressionApiKey: ttcKey,
        aggressiveness: 0.2, // light — preserve instructions carefully
      });
      console.log("[TTC] Token compression enabled (bear-2, aggressiveness=0.2)");
      return _client;
    } catch (e) {
      console.warn(`[TTC] Failed to init compression wrapper: ${(e as Error).message?.slice(0, 100)}`);
    }
  }

  _client = base;
  return _client;
}

// ───────────────────────── TTC stats export ─────────────────────────

/** Get current TTC compression stats for display/logging. */
export function getTtcStats(): { totalSaved: number; totalInput: number; calls: number; ratio: number; enabled: boolean } {
  const client = _client as Anthropic & { compression?: import("the-token-company").CompressionStats };
  if (client?.compression) {
    return {
      totalSaved: client.compression.totalTokensSaved,
      totalInput: client.compression.totalInputTokens,
      calls: client.compression.calls,
      ratio: client.compression.ratio,
      enabled: true,
    };
  }
  return { totalSaved: 0, totalInput: 0, calls: 0, ratio: 1, enabled: false };
}

type ContentBlock = { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

type Opts = { model?: string; maxTokens?: number; timeoutMs?: number };

async function callMessages(content: string | ContentBlock[], opts?: Opts): Promise<string> {
  const client = getClient();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts?.timeoutMs ?? 120_000);
  try {
    // Build messages content in the format the SDK expects
    const messageContent: Anthropic.MessageCreateParams["messages"][0]["content"] =
      typeof content === "string"
        ? content
        : content.map((b) => {
            if (b.type === "text") return { type: "text" as const, text: b.text };
            return {
              type: "image" as const,
              source: { type: "base64" as const, media_type: b.source.media_type as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: b.source.data },
            };
          });

    const response = await client.messages.create(
      {
        model: resolveModel(opts?.model),
        max_tokens: opts?.maxTokens ?? 8_000,
        messages: [{ role: "user", content: messageContent }],
      },
      { signal: ctrl.signal },
    );

    if (response.stop_reason === "refusal") throw new Error("Claude declined the request");
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    if (!text.trim()) throw new Error("empty response from Claude");

    // Log TTC stats after each call (if compression is active)
    const stats = getTtcStats();
    if (stats.enabled && stats.totalSaved > 0) {
      console.log(
        `[TTC] Session total: ${stats.totalSaved} tokens saved (${stats.ratio.toFixed(1)}x across ${stats.calls} calls)`
      );
    }

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
