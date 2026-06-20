/**
 * Fusion 360 generation engine (server-side) — the PRECISE PARAMETRIC counterpart to openscad.ts.
 *
 * Fusion hosts an HTTP MCP server (the add-in) at http://127.0.0.1:27182/mcp. We drive it directly
 * from Node (no Claude Code in the loop), exactly the way blender.ts drives the BlenderMCP socket:
 *   initialize → notifications/initialized → tools/call fusion_mcp_execute {featureType:"script"}.
 * Claude writes an `adsk` Python `run(_context)` that builds the part in a fresh Fusion doc (the user
 * WATCHES it build) and exports an ASCII STL; we read that STL into the normal estimate/printplan path.
 *
 * UNITS: the Fusion API is centimetres (1 unit = 10 mm) but STL export is millimetres — so the script
 * builds with cm = mm/10 and the exported STL drops straight into our mm pipeline (no rescaling, which
 * keeps Fusion's parametric precision). Verified live: a 4×3×2 cm box exports as 40×30×20 mm.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { copyFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const execFileP = promisify(execFile);
const bin = (abs: string, name: string) => (existsSync(abs) ? abs : name);
const CLAUDE = bin(path.join(os.homedir(), ".local/bin/claude"), "claude");

const MCP_URL = process.env.FUSION_MCP_URL || "http://127.0.0.1:27182/mcp";

// Writing a complex adsk script is the slow step. The session default (Opus) reasons past the 200s
// limit on multi-feature parts → ETIMEDOUT → a cryptic "Command failed" + nothing built. Pin the
// script writer to a FASTER model (Sonnet) so bracket-class parts finish in time; env-overridable.
const FUSION_MODEL = process.env.FUSION_CLAUDE_MODEL || "sonnet";
const FUSION_TIMEOUT_MS = Number(process.env.FUSION_CLAUDE_TIMEOUT_MS) || 200_000;

type ExecErr = { killed?: boolean; signal?: string | null; code?: number | string | null; message?: string };

/**
 * Turn an execFile failure (Claude writing the adsk script) into an HONEST, actionable message —
 * the cryptic "Command failed: claude -p …" told the user nothing about WHY Fusion did nothing.
 * A timeout kills the child (killed:true / signal set / code null); a non-zero exit sets a numeric code.
 */
export function describeClaudeFailure(err: ExecErr, timeoutMs = FUSION_TIMEOUT_MS): string {
  const secs = Math.round(timeoutMs / 1000);
  if (err?.killed || err?.signal != null || err?.code === "ETIMEDOUT")
    return `the part was too complex to write in one shot — Claude ran past the ${secs}s limit. Try fewer features (ribs, patterns, fillets), a simpler part, or another engine.`;
  return `couldn't write the Fusion script: ${(err?.message || "unknown error").trim().slice(0, 140)}`;
}

// ───────────────────────── pure response parsing (TDD'd) ─────────────────────────

type RpcResponse = {
  id?: number | string;
  jsonrpc?: string;
  error?: { code?: number; message?: string };
  result?: { content?: { type?: string; text?: string }[] };
};

/** Pull the script's printed output out of a tools/call response, throwing a useful error on failure. */
export function parseFusionExec(resp: RpcResponse): { message: string } {
  if (resp?.error) throw new Error(`fusion mcp error: ${resp.error.message || resp.error.code || "unknown"}`);
  const text = resp?.result?.content?.[0]?.text;
  if (!text) throw new Error("fusion returned no content (script produced no output)");
  let inner: { message?: string; error?: string; success?: boolean };
  try { inner = JSON.parse(text); } catch { return { message: text }; } // some tools return raw text
  // a failing run() comes back as { error: "<traceback>", success: false } (note: `error`, not `message`).
  if (inner.success === false) throw new Error(`fusion script failed: ${(inner.error || inner.message || "unknown error").trim().slice(-200)}`);
  return { message: inner.message ?? text };
}

/** Extract the exported STL path from the script's "STL_OK <path>" print line. */
export function extractFusionStl(message: string): string {
  const m = message.match(/STL_OK\s+(\S+\.stl)/i);
  if (!m) throw new Error("fusion built nothing exportable (no STL_OK line)");
  return m[1];
}

// ───────────────────────── assembly build mode (auto-detected) ─────────────────────────

/**
 * Decide whether a Fusion prompt should build a single PART or a multi-component ASSEMBLY. Pure
 * keyword heuristic (no LLM) — Auto-detect surfacing (Vraj): no picker, no jargon. Word-boundary
 * patterns avoid substring false positives ("solid"/"valid" contain "lid"; "gear" singular is one
 * part, "gears" implies meshing parts). Claude's actual output (how many components it builds) stays
 * the source of truth for the reported count; this only flips the writer + the export tail. HYBRID
 * designs fold into the assembly path (an assembly whose components are themselves multi-feature parts).
 * See docs/superpowers/specs/2026-06-18-fusion-design-types-design.md.
 */
const ASSEMBLY_PATTERNS: RegExp[] = [
  /\bhinged?\b/, /\blids?\b/, /\bcovers?\b/, /\bclips?\b/, /\bsnaps?\b/, /\bsnap[-\s]?fit\b/,
  /\bpress[-\s]?fit\b/, /\bdrawers?\b/, /\bscrew[-\s]?on\b/, /\bthreaded lid\b/, /\bgears\b/,
  /\bplanetary\b/, /\barticulated\b/, /\bswivel\b/, /\bmodular\b/, /\bremovable\b/,
  /\b(two|three|multi|multiple|separate)[-\s]?parts?\b/, /\bassembl(y|e|ies|ed|ing)\b/,
  /\b(slots?|fits?|snaps?|clicks?)[-\s]?together\b/,
];

export function classifyFusionBuild(prompt: string): "part" | "assembly" {
  const p = (prompt || "").toLowerCase();
  return ASSEMBLY_PATTERNS.some((re) => re.test(p)) ? "assembly" : "part";
}

/** Parse the `PARTS_OK [<json>]` manifest printed by the assembly export tail. Returns [] when the
 *  line is absent or malformed — a single-part build, or Claude put bodies in root with no
 *  occurrences (then the combined model.stl is treated as the only part). */
export function extractFusionParts(message: string): { name: string; file: string }[] {
  const m = message.match(/PARTS_OK\s+(\[[^\n]*\])/);
  if (!m) return [];
  try {
    const arr: unknown = JSON.parse(m[1]);
    if (!Array.isArray(arr)) return [];
    return (arr as { name?: unknown; file?: unknown }[])
      .filter((e) => e && typeof e.name === "string" && typeof e.file === "string")
      .map((e) => ({ name: e.name as string, file: e.file as string }));
  } catch { return []; }
}

/**
 * Multi-part export tail appended to an assembly run(): exports the whole assembly (model.stl — the
 * viewport preview) AND each component (part_<i>.stl — for printing the parts separately), then prints
 * STL_OK (the existing `extractFusionStl` parser still works) + a PARTS_OK json manifest. NO imports
 * (avoids the adsk/json function-local-scope footgun documented in claudeFusionScript) — the manifest
 * is built with plain string concatenation. Component names are quote-sanitized for the inline JSON.
 */
export const EXPORT_TAIL_ASSEMBLY = (outDir: string) => {
  const dir = JSON.stringify(outDir); // python-safe double-quoted literal
  return `
    _des = adsk.fusion.Design.cast(adsk.core.Application.get().activeProduct)
    _root = _des.rootComponent
    _em = _des.exportManager
    _model = ${dir} + '/model.stl'
    _o = _em.createSTLExportOptions(_root, _model)
    _o.meshRefinement = adsk.fusion.MeshRefinementSettings.MeshRefinementMedium
    _o.isBinaryFormat = False
    _em.execute(_o)
    print('STL_OK ' + _model)
    _parts = []
    _i = 0
    for _occ in _root.occurrences:
        _comp = _occ.component
        if _comp.bRepBodies.count == 0:
            continue
        _i = _i + 1
        _fname = 'part_' + str(_i) + '.stl'
        _po = _em.createSTLExportOptions(_comp, ${dir} + '/' + _fname)
        _po.meshRefinement = adsk.fusion.MeshRefinementSettings.MeshRefinementMedium
        _po.isBinaryFormat = False
        _em.execute(_po)
        _nm = _comp.name.replace('"', "'").replace('\\\\', '/')
        _parts.append('{"name": "' + _nm + '", "file": "' + _fname + '"}')
    print('PARTS_OK [' + ', '.join(_parts) + ']')
`;
};

// ───────────────────────── HTTP MCP bridge ─────────────────────────

async function rpc(body: unknown, sid: string | undefined, timeoutMs: number): Promise<{ json: RpcResponse; sid?: string }> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };
    if (sid) headers["MCP-Session-Id"] = sid;
    const res = await fetch(MCP_URL, { method: "POST", headers, body: JSON.stringify(body), signal: ctrl.signal });
    const sidOut = res.headers.get("mcp-session-id") || sid;
    const txt = await res.text();
    let json: RpcResponse = {};
    if (txt.trim()) { try { json = JSON.parse(txt); } catch { /* notification → empty/non-JSON body is fine */ } }
    return { json, sid: sidOut ?? undefined };
  } finally { clearTimeout(t); }
}

/** Open an MCP session (initialize + initialized) and return the session id. */
async function openSession(timeoutMs: number): Promise<string> {
  const init = await rpc(
    { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "claude-hardware", version: "1.0" } } },
    undefined, timeoutMs,
  );
  if (!init.sid) throw new Error("fusion mcp gave no session id");
  await rpc({ jsonrpc: "2.0", method: "notifications/initialized" }, init.sid, timeoutMs);
  return init.sid;
}

/** Run one tools/call on a fresh session; returns the raw RPC response. */
async function callTool(name: string, args: unknown, timeoutMs: number): Promise<RpcResponse> {
  const sid = await openSession(Math.min(timeoutMs, 15_000));
  const { json } = await rpc({ jsonrpc: "2.0", id: 2, method: "tools/call", params: { name, arguments: args } }, sid, timeoutMs);
  return json;
}

/** Is Fusion running and reachable on the MCP HTTP port? Cheap read probe. */
export async function fusionAvailable(timeoutMs = 2500): Promise<boolean> {
  try {
    const resp = await callTool("fusion_mcp_read", { queryType: "document", operation: "open" }, timeoutMs);
    parseFusionExec(resp);
    return true;
  } catch { return false; }
}

// ───────────────────────── Claude-written adsk script ─────────────────────────

const EXPORT_TAIL = (outPath: string) => `
    _des = adsk.fusion.Design.cast(adsk.core.Application.get().activeProduct)
    _root = _des.rootComponent
    _em = _des.exportManager
    _opts = _em.createSTLExportOptions(_root, ${JSON.stringify(outPath)})
    _opts.meshRefinement = adsk.fusion.MeshRefinementSettings.MeshRefinementMedium
    _opts.isBinaryFormat = False
    _em.execute(_opts)
    print('STL_OK ' + ${JSON.stringify(outPath)})
`;

/** Ask Claude to write a single adsk `run(_context)` that builds the part. `primer` = skills guidance. */
export async function claudeFusionScript(prompt: string, outPath: string, primer = "", base?: string): Promise<string> {
  const editIntro = base
    ? `Here is the CURRENT model's Fusion script. MODIFY it to satisfy this change: "${prompt}". Keep what works.\n--- CURRENT ---\n${base}\n--- END ---\n\n`
    : "";
  const instruction =
    `You are an Autodesk Fusion 360 API (adsk) expert. Write ONE self-contained Python script that builds a ` +
    `3D-PRINTABLE model of: "${prompt}".\n` + editIntro + (primer ? primer + "\n" : "") +
    `Hard rules:\n` +
    `- Import ONLY: import adsk.core, adsk.fusion   (do NOT import adsk.cad — that module does not exist and crashes).\n` +
    `- Define exactly: def run(_context):  (this is the entry point).\n` +
    `- First line of run(): create a NEW design doc so it's isolated and the user can watch it build:\n` +
    `    app = adsk.core.Application.get(); app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)\n` +
    `- UNITS: the API is CENTIMETRES (1.0 = 10 mm). Build at real size using cm = mm/10 (a 40mm cube = 4.0).\n` +
    `- Use sketches + extrude/revolve/loft/fillet/shell/holes; prefer parametric features with real dimensions.\n` +
    `- Do NOT catch exceptions (let them surface). Do NOT add your own export — append the export block I give you.\n` +
    `- Output ONLY Python, beginning with "import adsk". No prose, no markdown, no backticks.\n` +
    `End the run() function's body with EXACTLY this export block (already correctly indented):` +
    EXPORT_TAIL(outPath);
  // A complex parametric part (patterns, ribs, fillets, bolt circles) makes Claude reason well past 120s →
  // the adsk script call ETIMEDOUT mid-write. Pin a faster model + surface an HONEST reason on timeout.
  let stdout: string;
  try {
    ({ stdout } = await execFileP(CLAUDE, ["--model", FUSION_MODEL, "-p", instruction], { timeout: FUSION_TIMEOUT_MS, maxBuffer: 8 << 20 }));
  } catch (e) {
    throw new Error(describeClaudeFailure(e as ExecErr));
  }
  let code = stdout.replace(/^```[a-z]*\s*/im, "").replace(/```\s*$/im, "").trim();
  code = code.replace(/\badsk\.cad\b/g, "adsk.fusion"); // adsk.cad doesn't exist → harmless valid module
  // safety net: if Claude forgot the export block, append it inside run() is impossible post-hoc, so
  // require it — but tolerate a trailing one it added itself (the STL_OK line is what we parse).
  if (!/def\s+run\s*\(/.test(code)) throw new Error("fusion script missing run() entry point");
  if (!/import\s+adsk/.test(code)) code = "import adsk.core, adsk.fusion\n" + code;
  return code;
}

/**
 * Ask Claude to FIX a failing adsk script given Fusion's own runtime traceback (the constitution's
 * inspect→fix loop). This targets the real single-shot ceiling: a syntactically-fine script that throws
 * at build time (e.g. ExtrudeFeatures.add() on a profile that isn't closed). Same hard rules + export block.
 */
export async function claudeFusionFixScript(
  prompt: string, broken: string, traceback: string, outPath: string, primer = "",
): Promise<string> {
  const instruction =
    `You are an Autodesk Fusion 360 API (adsk) expert. The Python script below FAILED AT RUNTIME inside ` +
    `Fusion with the traceback shown. Fix the bug so it builds a 3D-PRINTABLE model of: "${prompt}".\n` +
    (primer ? primer + "\n" : "") +
    `Likely causes to check: extruding a profile that doesn't exist or isn't a closed loop (verify ` +
    `sketch.profiles.count > 0 and pick the right profile before ExtrudeFeatures.add); wrong units (the API ` +
    `is CENTIMETRES, 1.0 = 10 mm); referencing a face/edge/body that was never created; fillet/shell/hole on ` +
    `missing geometry; collection vs single-item arguments. Keep the parts that work; change only what the ` +
    `error implies.\n` +
    `Same hard rules: import ONLY adsk.core, adsk.fusion; define def run(_context):; its first line creates a ` +
    `NEW design doc; do NOT catch exceptions; KEEP the existing STL export block at the end of run() (it prints ` +
    `STL_OK) — do not remove or change its path. Output ONLY the corrected Python, beginning with "import adsk". ` +
    `No prose, no markdown, no backticks.\n\n` +
    `--- TRACEBACK ---\n${traceback.slice(-1200)}\n--- SCRIPT ---\n${broken}\n--- END ---`;
  let stdout: string;
  try {
    ({ stdout } = await execFileP(CLAUDE, ["--model", FUSION_MODEL, "-p", instruction], { timeout: FUSION_TIMEOUT_MS, maxBuffer: 8 << 20 }));
  } catch (e) {
    throw new Error(describeClaudeFailure(e as ExecErr));
  }
  let code = stdout.replace(/^```[a-z]*\s*/im, "").replace(/```\s*$/im, "").trim();
  code = code.replace(/\badsk\.cad\b/g, "adsk.fusion");
  if (!/def\s+run\s*\(/.test(code)) throw new Error("fusion fix script missing run() entry point");
  if (!/import\s+adsk/.test(code)) code = "import adsk.core, adsk.fusion\n" + code;
  // If the fix dropped the export, re-append it (post-hoc append is safe — it's the tail of run()'s body).
  if (!/STL_OK/.test(code)) code = code.replace(/\s*$/, "\n") + EXPORT_TAIL(outPath);
  return code;
}

/**
 * Generate a model in Fusion: Claude writes the adsk script → run via MCP → copy the exported STL into
 * jobDir. On a runtime SCRIPT failure (adsk traceback), feed the traceback back to Claude and retry once
 * (bounded by FUSION_FIX_RETRIES, default 1) — the single-shot complex-part ceiling. Returns the print STL
 * path + the script as the editable `source` (so a refine edits the script).
 */
export async function generateFusion(
  req: { prompt: string; jobDir: string; primer?: string; base?: string; onStatus?: (msg: string) => void },
): Promise<{ stlPath: string; source: string }> {
  const jobId = path.basename(req.jobDir);
  const outTmp = path.join(os.tmpdir(), `fusion_${jobId}.stl`);
  const maxFix = Math.max(0, Number(process.env.FUSION_FIX_RETRIES ?? 1));

  let script = await claudeFusionScript(req.prompt, outTmp, req.primer, req.base);
  for (let attempt = 0; ; attempt++) {
    const resp = await callTool("fusion_mcp_execute", { featureType: "script", object: { script } }, 180_000);
    try {
      const { message } = parseFusionExec(resp);
      const exported = extractFusionStl(message);
      if (!existsSync(exported)) throw new Error("fusion reported STL_OK but the file is missing");
      const stlPath = path.join(req.jobDir, "model.stl");
      await copyFile(exported, stlPath);
      return { stlPath, source: script };
    } catch (e) {
      const msg = (e as Error).message;
      // Retry ONLY a runtime script-correctness failure (adsk traceback), never an MCP/connection error, and
      // only while fix budget remains — otherwise rethrow the honest failure.
      if (!/fusion script failed:/.test(msg) || attempt >= maxFix) throw e;
      req.onStatus?.(`Fusion hit a script error — feeding the traceback back to Claude to fix it (retry ${attempt + 1}/${maxFix})…`);
      const traceback = msg.replace(/^fusion script failed:\s*/, "");
      script = await claudeFusionFixScript(req.prompt, script, traceback, outTmp, req.primer);
    }
  }
}

// ───────────────────────── ASSEMBLY path (multi-component) ─────────────────────────

/** Shared adsk post-process: strip fences, fix the adsk.cad mistake, ensure run()+import, and make
 *  sure the assembly export tail is present (we always append it — Claude is told not to export). */
function finalizeAssemblyScript(stdout: string, outDir: string, label: string): string {
  let code = stdout.replace(/^```[a-z]*\s*/im, "").replace(/```\s*$/im, "").trim();
  code = code.replace(/\badsk\.cad\b/g, "adsk.fusion"); // adsk.cad doesn't exist
  if (!/def\s+run\s*\(/.test(code)) throw new Error(`fusion ${label} missing run() entry point`);
  if (!/import\s+adsk/.test(code)) code = "import adsk.core, adsk.fusion\n" + code;
  // run() is the last function in the file (we require it), so appending the 4-space-indented tail
  // continues run()'s body. Only append if Claude didn't already include an export (no PARTS_OK).
  if (!/PARTS_OK/.test(code)) code = code.replace(/\s*$/, "\n") + EXPORT_TAIL_ASSEMBLY(outDir);
  return code;
}

/** Ask Claude to write an adsk run() that builds a MULTI-COMPONENT printable assembly (each real part
 *  is its own named component) + print clearances. The multi-part export tail is appended for it. */
export async function claudeFusionAssemblyScript(prompt: string, outDir: string, primer = "", base?: string): Promise<string> {
  const editIntro = base
    ? `Here is the CURRENT assembly's Fusion script. MODIFY it to satisfy this change: "${prompt}". Keep what works.\n--- CURRENT ---\n${base}\n--- END ---\n\n`
    : "";
  // SPEED IS A PROMPT PROBLEM (measured): the verbose "model a working hinge + assembled positioning"
  // brief made Sonnet write ~170 lines and run 230s → past the 200s writer limit (Vraj's "hinged box"
  // failed at 03:20). A LEAN brief — 2–3 simple parts that just FIT together, no working mechanism, a
  // conciseness cap, no heavy primer — writes a valid assembly in ~26s (≈9× faster, well under the limit).
  // Matches the v1 scope (separate printable parts with clearances; articulation is deferred).
  const instruction =
    `You are an Autodesk Fusion 360 API (adsk) expert. Write ONE CONCISE Python script (aim for UNDER ~90 lines) ` +
    `that builds a 3D-PRINTABLE MULTI-PART ASSEMBLY of: "${prompt}".\n` + editIntro + (primer ? primer + "\n" : "") +
    `Keep it SIMPLE and FAST to write:\n` +
    `- Make 2–3 named printable parts as SEPARATE components. Do NOT model a real working mechanism — just make the ` +
    `parts SIT/FIT TOGETHER with ~0.3 mm (0.03 cm) clearance (e.g. a box body + a lid that sits on top; a peg that fits a hole).\n` +
    `- Use ONLY simple features: rectangles/circles → extrude, shell for a hollow box, at most one fillet. No loft/sweep/pattern.\n` +
    `- Printable: min wall >= 1.2 mm (0.12 cm); each part has a flat base.\n` +
    `Hard rules:\n` +
    `- Import ONLY: import adsk.core, adsk.fusion   (do NOT import adsk.cad — it does not exist and crashes).\n` +
    `- Define exactly: def run(_context):  and make run() the LAST thing in the file (no code after it).\n` +
    `- First lines of run():\n` +
    `    app = adsk.core.Application.get(); app.documents.add(adsk.core.DocumentTypes.FusionDesignDocumentType)\n` +
    `    des = adsk.fusion.Design.cast(app.activeProduct); rootComp = des.rootComponent\n` +
    `- UNITS: the API is CENTIMETRES (1.0 = 10 mm). Build at cm = mm/10 (a 40mm wall = 4.0).\n` +
    `- Each part is its OWN component: occ = rootComp.occurrences.addNewComponent(adsk.core.Matrix3D.create()); ` +
    `comp = occ.component; comp.name = 'lid'  — then build that part's geometry on comp.\n` +
    `- Position the components in their assembled pose. Do NOT catch exceptions. Do NOT add any STL export — it is appended for you.\n` +
    `- Output ONLY Python, beginning with "import adsk". No prose, no markdown, no backticks.`;
  let stdout: string;
  try {
    ({ stdout } = await execFileP(CLAUDE, ["--model", FUSION_MODEL, "-p", instruction], { timeout: FUSION_TIMEOUT_MS, maxBuffer: 8 << 20 }));
  } catch (e) {
    throw new Error(describeClaudeFailure(e as ExecErr));
  }
  return finalizeAssemblyScript(stdout, outDir, "assembly script");
}

/** Feed Fusion's runtime traceback back to Claude to fix a failing ASSEMBLY script (inspect→fix loop). */
export async function claudeFusionAssemblyFixScript(
  prompt: string, broken: string, traceback: string, outDir: string, primer = "",
): Promise<string> {
  const instruction =
    `You are an Autodesk Fusion 360 API (adsk) expert. The Python script below FAILED AT RUNTIME inside Fusion ` +
    `with the traceback shown. Fix the bug so it builds a 3D-PRINTABLE MULTI-PART ASSEMBLY of: "${prompt}".\n` +
    (primer ? primer + "\n" : "") +
    `Likely causes: building features on the wrong component (build each part on its own comp from ` +
    `occurrences.addNewComponent, not always rootComp); extruding a profile that doesn't exist / isn't closed ` +
    `(check sketch.profiles.count > 0); wrong units (API is CENTIMETRES, 1.0 = 10 mm); referencing geometry that ` +
    `was never created; collection vs single-item arguments.\n` +
    `Same hard rules: import ONLY adsk.core, adsk.fusion; def run(_context): is the LAST thing in the file; its ` +
    `first line creates a NEW design doc; build SEVERAL named components (one per printable part); do NOT catch ` +
    `exceptions; do NOT add any STL export (it is appended for you). Output ONLY the corrected Python, beginning ` +
    `with "import adsk". No prose, no markdown, no backticks.\n\n` +
    `--- TRACEBACK ---\n${traceback.slice(-1200)}\n--- SCRIPT ---\n${broken}\n--- END ---`;
  let stdout: string;
  try {
    ({ stdout } = await execFileP(CLAUDE, ["--model", FUSION_MODEL, "-p", instruction], { timeout: FUSION_TIMEOUT_MS, maxBuffer: 8 << 20 }));
  } catch (e) {
    throw new Error(describeClaudeFailure(e as ExecErr));
  }
  return finalizeAssemblyScript(stdout, outDir, "assembly fix script");
}

/**
 * Generate a MULTI-PART ASSEMBLY in Fusion: Claude writes a multi-component adsk script → run via MCP →
 * the export tail writes model.stl (combined preview) + part_<i>.stl (each component). Copies them into
 * jobDir and returns the combined STL + the part graph + the editable script. Same traceback→fix retry
 * as generateFusion. If Claude built a single component (no occurrences), `parts` is [] and the combined
 * model.stl is the only artifact (it degrades to a normal one-piece print).
 */
export async function generateFusionAssembly(
  req: { prompt: string; jobDir: string; primer?: string; base?: string; onStatus?: (msg: string) => void },
): Promise<{ stlPath: string; parts: { name: string; file: string; stlPath: string }[]; source: string }> {
  const jobId = path.basename(req.jobDir);
  const outDir = path.join(os.tmpdir(), `fusion_asm_${jobId}`);
  await mkdir(outDir, { recursive: true });
  const maxFix = Math.max(0, Number(process.env.FUSION_FIX_RETRIES ?? 1));

  let script = await claudeFusionAssemblyScript(req.prompt, outDir, req.primer, req.base);
  for (let attempt = 0; ; attempt++) {
    const resp = await callTool("fusion_mcp_execute", { featureType: "script", object: { script } }, 180_000);
    try {
      const { message } = parseFusionExec(resp);
      const exported = extractFusionStl(message); // combined model.stl in outDir
      if (!existsSync(exported)) throw new Error("fusion reported STL_OK but the file is missing");
      const stlPath = path.join(req.jobDir, "model.stl");
      await copyFile(exported, stlPath);
      const parts: { name: string; file: string; stlPath: string }[] = [];
      for (const p of extractFusionParts(message)) {
        const src = path.join(outDir, p.file);
        if (!existsSync(src)) continue; // a component that exported nothing → skip, don't fail the build
        const dst = path.join(req.jobDir, p.file);
        await copyFile(src, dst);
        parts.push({ name: p.name, file: p.file, stlPath: dst });
      }
      return { stlPath, parts, source: script };
    } catch (e) {
      const msg = (e as Error).message;
      if (!/fusion script failed:/.test(msg) || attempt >= maxFix) throw e;
      req.onStatus?.(`Fusion hit a script error — feeding the traceback back to Claude to fix it (retry ${attempt + 1}/${maxFix})…`);
      const traceback = msg.replace(/^fusion script failed:\s*/, "");
      script = await claudeFusionAssemblyFixScript(req.prompt, script, traceback, outDir, req.primer);
    }
  }
}
