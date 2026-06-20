import { writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { claudeText, claudeVision } from "./claude";
import { browserbaseConfigured, bbFetch } from "./modelSearch/bb";

/** Resolve a ref image (URL, /generated|/assets path, or absolute) to a readable local file. */
async function localImagePath(ref: string, jobDir: string): Promise<string | null> {
  try {
    if (/^https?:\/\//i.test(ref)) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15_000);
      try {
        const res = await fetch(ref, { signal: ctrl.signal, redirect: "follow" });
        if (!res.ok) return null;
        const ext = (res.headers.get("content-type") || "").includes("png") ? "png" : "jpg";
        const p = path.join(jobDir, `ref.${ext}`);
        await writeFile(p, Buffer.from(await res.arrayBuffer()));
        return p;
      } finally { clearTimeout(t); }
    }
    const abs = ref.startsWith("/") && !ref.startsWith("/Users") && !existsSync(ref)
      ? path.join(process.cwd(), "public", ref.replace(/^\//, ""))
      : ref;
    return existsSync(abs) ? abs : null;
  } catch { return null; }
}

/**
 * VISION: have Claude look at a reference image and write a detailed visual descriptor of the main
 * object — so the user can "upload a reference" and get a faithful, detailed model via the WORKING
 * text→3D path. (NVIDIA's hosted image→3D 500s server-side; Claude vision + text→3D is the reliable
 * route, and also names recognizable characters/logos.) Best-effort: returns "" on any failure.
 */
export async function describeImage(ref: string, jobDir: string): Promise<string> {
  const img = await localImagePath(ref, jobDir);
  if (!img) return "";
  const instruction =
    `Write ONE comma-separated visual descriptor (~50–90 words) of the MAIN ` +
    `object/character in this image for a 3D-printable figurine: what it is (name it if recognizable), overall form, ` +
    `colors, materials/surface, distinctive features, accessories, proportions, pose, art style. No scene ` +
    `or background. Output ONLY the descriptor; if you cannot see the image, output nothing.`;
  try {
    const out = (await claudeVision(instruction, [img], { maxTokens: 400, timeoutMs: 45_000 })).replace(/\s+/g, " ");
    return out.length >= 12 && !/^NO_IMAGE/i.test(out) ? out.slice(0, 700) : "";
  } catch { return ""; }
}

/**
 * WEB RESEARCH: use Browserbase to find a reference image of the subject on the web, download it,
 * then run Claude Vision on it to get a detailed visual descriptor. This bridges the gap for obscure/
 * branded subjects (e.g. "Tesla Optimus robot") that TRELLIS can't generate well from text alone.
 * Returns { imageUrl, description } or null on failure. Best-effort, never throws.
 */
export async function webResearchImage(
  prompt: string,
  jobDir: string,
): Promise<{ imageUrl: string; description: string } | null> {
  if (!browserbaseConfigured) return null;
  try {
    // Scrape a Google Images search page through Browserbase for the subject
    const query = `${prompt} 3D reference photo`;
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&udm=2`;
    const html = await bbFetch(searchUrl, 20_000);

    // Extract image URLs from the search results — Google embeds them in various data attributes
    // and JSON blobs. We look for image URLs in common patterns.
    const imgUrls: string[] = [];

    // Pattern 1: data-src or src attributes pointing to real images (not tracking pixels/base64)
    const srcRe = /(?:data-src|src)="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi;
    let m: RegExpExecArray | null;
    while ((m = srcRe.exec(html)) && imgUrls.length < 5) {
      const u = m[1];
      if (u.includes("gstatic.com/images") || u.includes("google.com/images")) continue; // skip Google UI
      if (u.length < 20 || u.length > 2000) continue;
      imgUrls.push(u);
    }

    // Pattern 2: URLs in JSON data blocks (Google embeds original image URLs in script tags)
    const jsonRe = /\["(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)",\s*\d+,\s*\d+\]/gi;
    while ((m = jsonRe.exec(html)) && imgUrls.length < 8) {
      const u = m[1].replace(/\\u003d/gi, "=").replace(/\\u0026/gi, "&");
      if (u.includes("gstatic.com") || u.includes("google.com/images")) continue;
      if (u.length < 20 || u.length > 2000) continue;
      if (!imgUrls.includes(u)) imgUrls.push(u);
    }

    if (!imgUrls.length) return null;

    // Try downloading the first few images until one succeeds
    for (const url of imgUrls.slice(0, 3)) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 10_000);
        try {
          const res = await fetch(url, {
            signal: ctrl.signal,
            redirect: "follow",
            headers: { "User-Agent": "Mozilla/5.0 (compatible; Claudware/1.0)" },
          });
          if (!res.ok) continue;
          const ct = res.headers.get("content-type") || "";
          if (!ct.includes("image")) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 2000) continue; // too small to be useful
          const ext = ct.includes("png") ? "png" : "jpg";
          const imgPath = path.join(jobDir, `webref.${ext}`);
          await writeFile(imgPath, buf);

          // Now describe it with Claude Vision
          const desc = await describeImage(imgPath, jobDir);
          if (desc) return { imageUrl: url, description: desc };
        } finally { clearTimeout(timer); }
      } catch { continue; }
    }
    return null;
  } catch { return null; }
}

/**
 * STOPGAP canonical descriptors for named subjects that free TEXT→3D otherwise reinvents generically
 * (TRELLIS never sees reference pixels — NVIDIA's hosted image→3D 500s — so likeness is only as good as
 * the words we feed it). When the user explicitly NAMES such a subject (e.g. "the Claude Code mascot"),
 * we substitute a hand-written canonical descriptor so the result is on-brand instead of a random figure.
 * Returns "" when nothing matches. Pure + deterministic → unit-testable, and skips a Claude round-trip.
 */
export function canonicalDescriptor(prompt: string): string {
  const p = prompt.toLowerCase();
  // "Clawd" — the Claude / Anthropic mascot. Match an explicit naming, not a bare "claude".
  const isClawd =
    /\bclawd\b/.test(p) ||
    /\b(claude|anthropic)\b[^.]{0,24}\bmascot\b/.test(p) ||
    /\bmascot\b[^.]{0,24}\b(claude|anthropic)\b/.test(p) ||
    /\bclaude\s*code\s*mascot\b/.test(p);
  if (isClawd) {
    return (
      "Clawd, the Claude AI mascot, a cute chibi character with a single rounded teardrop / soft-blob body " +
      "in warm coral-orange (#cc785c), smooth matte surface, a simple friendly face with two small round dot " +
      "eyes and no nose or mouth, short stubby arms, no legs, sitting upright centered on a small flat circular " +
      "base, big-headed minimalist kawaii mascot proportions, clean rounded silhouette, soft toy-like style"
    );
  }
  return "";
}

/**
 * Turn a short prompt (+ folded clarify preferences) into a DENSE, STRUCTURED, maximally-detailed
 * visual descriptor for the text→3D engine, so it generates far more faithful detail. Claude already
 * knows iconic named subjects (Kratos, the Claude mascot "Clawd", famous mascots/characters), so it
 * effectively "looks up what the thing is" and describes its CANONICAL appearance. TRELLIS accepts long
 * prompts (verified ~90+ words → 200), so we pack identity, silhouette, colors, materials, key features,
 * accessories, proportions, pose and style into one comma-led descriptor. Best-effort: returns the raw
 * prompt on any failure (never blocks generation).
 */
export async function enrichPrompt(prompt: string): Promise<string> {
  // Named-subject stopgap first: if the user explicitly named a subject we have a canonical descriptor for
  // (e.g. the Claude mascot), use it verbatim so text→3D is on-brand instead of a generic reinvention.
  const canon = canonicalDescriptor(prompt);
  if (canon) return `${canon}. ${prompt}`.slice(0, 900);
  const instruction =
    `You are writing a prompt for a TEXT-TO-3D model generator (Microsoft TRELLIS). Turn the subject ` +
    `below into ONE single-paragraph, comma-separated VISUAL descriptor of ~60–100 words that maximises ` +
    `recognizable detail for a 3D-printable figurine.\n` +
    `If the subject is a NAMED character, mascot, or franchise, describe its CANONICAL, instantly-recognizable ` +
    `appearance accurately (correct colors, outfit, signature accessories/weapons, body type). Honor any ` +
    `"Preferences:" already in the subject.\n` +
    `Cover, in order: (1) what it is, (2) overall form/silhouette, (3) colors, (4) materials/surface/texture, ` +
    `(5) distinctive features + accessories, (6) proportions, (7) pose, (8) art style. Keep it a SINGLE ` +
    `centered object on a small flat base — no scene, no background, no lighting/camera talk, no sentences ` +
    `about printing. Output ONLY the descriptor text.\n\nSubject: ${prompt}`;
  try {
    const raw = await claudeText(instruction, { maxTokens: 800, timeoutMs: 30_000 });
    const out = raw.replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
    // TRELLIS handles long prompts; cap generously so we never truncate mid-word but stay sane.
    return out.length >= 12 ? out.slice(0, 900) : prompt;
  } catch {
    return prompt;
  }
}
