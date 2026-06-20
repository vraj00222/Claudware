import type { AgentEvent } from "./agentEvent";
import type { Player } from "./mockStream";
import type { ModelResult } from "@/server/modelSearch/types";
import type { SizeEdit } from "@/server/sizeEdit";

/**
 * The REAL stream: POST a prompt to /api/generate and parse the Server-Sent-Events
 * back into `AgentEvent`s — the exact same events `mockStream` emits, so the UI
 * consumes either one identically. Returns a `Player` whose cancel() aborts the request.
 */
/** Engine the user can request. "auto" lets the server classify the prompt → the right engine. */
export type RequestEngine = "auto" | "openscad" | "blender" | "fusion" | "nvidia";

export function playAgentStream(
  prompt: string,
  engine: RequestEngine,
  onEvent: (e: AgentEvent) => void,
  /** refine-in-place: pass the current version's recipe to EDIT it instead of regenerating.
   *  sizeMm = scale the result to a real-world height; refImageUrl = image→3D (make-with-AI);
   *  postSteps = optional pipeline combos (e.g. Clean in Blender). */
  opts?: { base?: string; sizeMm?: number; refImageUrl?: string; postSteps?: { cleanInBlender?: boolean } },
): Player {
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, engine, base: opts?.base, sizeMm: opts?.sizeMm, refImageUrl: opts?.refImageUrl, postSteps: opts?.postSteps }),
        signal: ctrl.signal,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const data = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!data) continue;
          try {
            onEvent(JSON.parse(data.slice(5).trim()) as AgentEvent);
          } catch {
            /* skip malformed frame */
          }
        }
      }
    } catch {
      /* aborted or network error — surfaced via the absence of further events */
    }
  })();

  return {
    cancel() {
      ctrl.abort();
    },
  };
}

/**
 * MAKE-WITH-AI: a login-walled search result can't be downloaded, so we regenerate a printable
 * version from its thumbnail via image→3D meshgen (routes through /api/generate's blender path
 * with refImageUrl). Same AgentEvents → the studio reuses its generation handler.
 */
export function playMakeWithAiStream(result: ModelResult, onEvent: (e: AgentEvent) => void): Player {
  return playAgentStream(result.title, "blender", onEvent, { refImageUrl: result.thumbUrl });
}

/**
 * TRANSFORM stream: a pure size change ("make it smaller") scales the EXISTING mesh via /api/transform
 * instead of regenerating — instant + perfectly faithful (TRELLIS would otherwise make a new object).
 * Emits the SAME AgentEvents → the studio's generation handler saves it as a v2.
 */
export function playTransformStream(meshUrl: string, edit: SizeEdit, onEvent: (e: AgentEvent) => void): Player {
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await fetch("/api/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meshUrl, edit }),
        signal: ctrl.signal,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const data = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!data) continue;
          try { onEvent(JSON.parse(data.slice(5).trim()) as AgentEvent); } catch { /* skip */ }
        }
      }
    } catch { /* aborted or network error */ }
  })();
  return { cancel() { ctrl.abort(); } };
}

/**
 * PREPARE-FOR-PRINT stream: POST a finished mesh to /api/prepare → Print-Readiness v2 pipeline
 * (diagnose → orient → export OBJ/3MF → `printready` + narrative). Same SSE shape; the studio feeds
 * the events into its reducer (tool chips + the printready package).
 */
export function playPrepareStream(meshUrl: string, onEvent: (e: AgentEvent) => void): Player {
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await fetch("/api/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meshUrl }),
        signal: ctrl.signal,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const data = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!data) continue;
          try { onEvent(JSON.parse(data.slice(5).trim()) as AgentEvent); } catch { /* skip */ }
        }
      }
    } catch { /* aborted */ }
  })();
  return { cancel() { ctrl.abort(); } };
}

/**
 * IMPORT stream: POST a chosen search result to /api/import and parse the SSE back into the SAME
 * `AgentEvent`s the generate stream emits (mesh/estimate/printplan/summary) — so the studio reuses
 * its existing event handler to show + save an imported model exactly like a generated one.
 */
export function playImportStream(result: ModelResult, onEvent: (e: AgentEvent) => void): Player {
  const ctrl = new AbortController();
  (async () => {
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
        signal: ctrl.signal,
      });
      if (!res.body) return;
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const data = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!data) continue;
          try { onEvent(JSON.parse(data.slice(5).trim()) as AgentEvent); } catch { /* skip */ }
        }
      }
    } catch { /* aborted */ }
  })();
  return { cancel() { ctrl.abort(); } };
}
