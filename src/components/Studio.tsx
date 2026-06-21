"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/agentEvent";
import { initialViewModel, reduce, deriveStages, type ViewModel, type Mode, type FeedRow } from "@/lib/viewModel";
import type { Player } from "@/lib/mockStream";
import { playAgentStream, playImportStream, playMakeWithAiStream, playTransformStream, playPrepareStream, playSplitStream, type RequestEngine } from "@/lib/agentStream";
import { parseSizeEdit } from "@/server/sizeEdit";
import { playSearchStream } from "@/lib/searchStream";
import { fetchClarify, type Question } from "@/lib/clarify";
import type { ModelResult } from "@/server/modelSearch/types";
import { getActiveStore, newId, latest, type Project, type ProjectVersion, type ChatMsg, type AsyncProjectStore } from "@/lib/projects";
import { getCurrentUser, type AuthUser } from "@/lib/insforge";
import { useSpeechToText } from "@/lib/useSpeechToText";
import { TopBar } from "./TopBar";
import { ConversationPanel } from "./ConversationPanel";
import { ModelSearchPanel } from "./ModelSearchPanel";
import { AgentFeed } from "./AgentFeed";
import { PrintCenter } from "./PrintCenter";
import { PrintPlan } from "./PrintPlan";
import { PrintReadyPanel } from "./PrintReadyPanel";
import { PrintPartsPanel } from "./PrintPartsPanel";
import { VersionRail } from "./VersionRail";
import { RenderLoader } from "./RenderLoader";
import { ClarifyCard } from "./ClarifyCard";
import { Viewport } from "@/viewport/Viewport";

type Action = { type: "event"; event: AgentEvent } | { type: "reset"; vm: ViewModel };

function reducer(vm: ViewModel, a: Action): ViewModel {
  return a.type === "event" ? reduce(vm, a.event) : a.vm;
}

const baseVM = (mode: Mode, phase: ViewModel["phase"]): ViewModel => ({ ...initialViewModel, mode, phase });

// Engine selection is now its OWN concept (was conflated with `mode` → the stale-engine footgun that
// silently sent characters to OpenSCAD). `mode` stays only as the viewport/clarify aesthetic.
const displayMode = (e: RequestEngine): Mode => (e === "openscad" || e === "fusion") ? "parametric" : "figure";
const refineEngine = (en?: string): RequestEngine =>
  en === "openscad" ? "openscad" : en === "fusion" ? "fusion" : en === "blender" ? "blender" : "nvidia";

export function Studio() {
  const [vm, dispatch] = useReducer(reducer, { ...initialViewModel, phase: "boot" });
  // `mode` = viewport/clarify aesthetic only (figure vs parametric). DEFAULT figure.
  const [mode, setMode] = useState<Mode>("figure");
  // ENGINE = how the model is generated. Auto (default) classifies the prompt server-side → the right
  // engine; or force OpenSCAD/Blender/Fusion/NVIDIA. Session state (no stale-engine persistence footgun).
  const [engineSel, setEngineSel] = useState<RequestEngine>("auto");
  const [cleanInBlender, setCleanInBlender] = useState(false); // post-step: clean any output in Blender
  const [modePopover, setModePopover] = useState(false);
  const [curVersion, setCurVersion] = useState(0);
  const [versionCount, setVersionCount] = useState(0);
  const [rippleKey, setRippleKey] = useState(0);
  const [miniFrame, setMiniFrame] = useState(0);
  const [booting, setBooting] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [preparing, setPreparing] = useState(false); // a "Prepare for print" (/api/prepare) run is in flight
  const [splitting, setSplitting] = useState(false); // a "Print in parts" (/api/split) run is in flight
  const [splitView, setSplitView] = useState<"whole" | "parts">("whole"); // viewport: whole model vs exploded parts
  const [userPrompt, setUserPrompt] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]); // the continuous conversation thread
  const [user, setUser] = useState<AuthUser | null>(null); // signed-in account → TopBar pill + /profile
  // Model search (reuse-before-regenerate, Browserbase): an overlay of existing-model results.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ModelResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hintPrompt, setHintPrompt] = useState<string | null>(null); // proactive "ready-made exists →" nudge
  const [clarify, setClarify] = useState<{ prompt: string; questions: Question[]; refImageUrl: string | null; loading?: boolean } | null>(null); // ask-first card
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null); // attached reference image (vision)
  const [thinking, setThinking] = useState(false); // chat-side word-cycling loader (preparing questions)
  const searchPlayerRef = useRef<Player | null>(null);

  const playerRef = useRef<Player | null>(null);
  const preparePlayer = useRef<Player | null>(null); // the in-flight "Prepare for print" stream
  const splitPlayer = useRef<Player | null>(null);   // the in-flight "Print in parts" stream
  const printTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // The AUTHORITATIVE current project — the single source of truth for persistence. Mutated
  // deliberately (append/update a version, sync messages) and saved via persist(); this replaces the
  // old re-read-merge effect that could race and drop a version slot (the v1/v2-loss bug).
  const projectRef = useRef<Project | null>(null);
  const storeRef = useRef<AsyncProjectStore | null>(null);   // resolved once: InsForge (signed in) or local
  const saveChain = useRef<Promise<unknown>>(Promise.resolve()); // serialize saves so upserts can't race
  const buildVersionIdx = useRef(0);          // which version slot the active build writes to
  const buildEngine = useRef<RequestEngine>("auto");
  const lastSource = useRef<string | undefined>(undefined);
  const clarifyToken = useRef(0);             // invalidates a pending clarify fetch when superseded
  const building = useRef(false);             // true only during an active generation
  const messagesRef = useRef<ChatMsg[]>([]);  // current thread, for use in effects/callbacks

  // append a chat turn (updates the ref SYNCHRONOUSLY so a save right after sees the latest thread).
  const pushMsg = useCallback((role: ChatMsg["role"], text: string) => {
    const next = [...messagesRef.current, { role, text, at: Date.now() }];
    messagesRef.current = next;
    setMessages(next);
  }, []);
  const resetMsgs = useCallback((msgs: ChatMsg[]) => { messagesRef.current = msgs; setMessages(msgs); }, []);

  // Resolve the active store once (InsForge DB when signed in, else localStorage), then cache it.
  const getStore = useCallback(async (): Promise<AsyncProjectStore> => {
    if (!storeRef.current) storeRef.current = await getActiveStore();
    return storeRef.current;
  }, []);

  // Save the authoritative project. Viewing/switching versions never calls this → can't clobber a slot.
  // Saves are SERIALIZED (saveChain) + snapshotted so rapid per-stage upserts can't race (the InsForge
  // adapter's select-then-insert/update would otherwise double-insert on the first two concurrent saves).
  const persist = useCallback(() => {
    const p = projectRef.current;
    if (!p) return;
    p.messages = messagesRef.current;
    p.updatedAt = Date.now();
    const snap: Project = JSON.parse(JSON.stringify(p));
    saveChain.current = saveChain.current
      .then(() => getStore())
      .then((s) => s.save(snap))
      .catch(() => { /* a failed save must never break the build loop */ });
  }, [getStore]);

  const stop = useCallback(() => {
    playerRef.current?.cancel();
    playerRef.current = null;
    preparePlayer.current?.cancel();
    preparePlayer.current = null;
    splitPlayer.current?.cancel();
    splitPlayer.current = null;
    if (printTimer.current) { clearInterval(printTimer.current); printTimer.current = null; }
    building.current = false;
    setRendering(false);
    setPreparing(false);
    setSplitting(false);
    setSplitView("whole");
  }, []);

  // Open a saved project (no regeneration) — shows its latest mesh + stats, ready to refine in place.
  const loadProject = useCallback((p: Project) => {
    stop();
    setBooting(false);
    projectRef.current = p;
    const v = latest(p);
    const m: Mode = (v?.engine === "openscad" || v?.engine === "fusion") ? "parametric" : "figure";
    setMode(m);
    setUserPrompt(p.title);
    buildVersionIdx.current = Math.max(0, p.versions.length - 1);
    buildEngine.current = refineEngine(v?.engine); // imported/nvidia → regenerates textured (NVIDIA)
    lastSource.current = v?.source ?? v?.scad;
    building.current = false;
    setVersionCount(p.versions.length);
    setCurVersion(Math.max(0, p.versions.length - 1));
    resetMsgs(p.messages?.length ? p.messages : [{ role: "user" as const, text: p.title, at: p.createdAt }]);
    dispatch({ type: "reset", vm: { ...baseVM(m, "complete"), meshUrl: v?.meshUrl ?? null, glbUrl: v?.glbUrl ?? null, textured: Boolean(v?.glbUrl), estimate: v?.estimate ?? null, printPlan: v?.printPlan ?? null, readiness: v?.readiness ?? null, totalStages: v?.stages ?? 0, rows: [] } });
  }, [stop, resetMsgs]);

  // mini-loader frame ticker for the feed's active row
  useEffect(() => {
    const id = setInterval(() => setMiniFrame((f) => (f + 1) % 4), 180);
    return () => clearInterval(id);
  }, []);

  // Resolve the signed-in account (null on the zero-key/dev-skip path) → TopBar account pill → /profile.
  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then((u) => { if (!cancelled) setUser(u); });
    return () => { cancelled = true; };
  }, []);

  // Boot: resolve the active store (so saves go to the right place), then open a project from
  // ?project=<id> if present, else brief self-test → empty state.
  useEffect(() => {
    const pid = new URLSearchParams(window.location.search).get("project");
    let cancelled = false;
    let t: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      const store = await getStore();
      if (cancelled) return;
      const p = pid ? await store.get(pid) : undefined;
      if (cancelled) return;
      if (p) { loadProject(p); return; }
      t = setTimeout(() => { if (!cancelled) { setBooting(false); dispatch({ type: "reset", vm: baseVM(mode, "empty") }); } }, 1500);
    })();
    return () => { cancelled = true; if (t) clearTimeout(t); stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // REAL generation: prompt → /api/generate (OpenSCAD/Blender) → streamed AgentEvents.
  // The PNG RenderLoader covers the wait until the first stage mesh arrives; then the
  // viewport swaps mesh per stage so you watch it build step-by-step.
  const runGenerate = useCallback((text: string, genOpts?: { prefs?: string[]; sizeMm?: number; refImageUrl?: string }) => {
    const prompt = text.trim();
    if (!prompt) return;
    stop();
    setBooting(false);
    clarifyToken.current++; // any generation supersedes a pending clarify fetch
    setClarify(null);
    setThinking(false);
    setRefImageUrl(null); // consumed by this generation
    // Clarify answers fold into the prompt sent to the engine; the chat/title keep the original.
    const apiPrompt = genOpts?.prefs?.length ? `${prompt}\nPreferences: ${genOpts.prefs.join("; ")}` : prompt;

    // REFINE-IN-PLACE: if a project is open, ANY currently-viewed version refines into a NEW version on
    // the SAME project (→ v2, continuous chat) — never a fresh "new chat". How depends on the version:
    //  • has a recipe (OpenSCAD/Blender script) → the route MODIFIES that recipe (true in-place edit).
    //  • meshgen/imported (no recipe) → re-run the engine, but re-send the ACCUMULATED subject + this
    //    change so it stays the SAME object ("lego mug" + "smaller, name on handle"), not a random blob.
    const open = projectRef.current;
    const baseVer: ProjectVersion | undefined = open?.versions[curVersion] ?? (open ? latest(open) : undefined);
    const baseRecipe = baseVer?.source ?? baseVer?.scad;
    const isEdit = !!open && !!baseVer;               // any open version → refine on the same project
    const isRecipeEdit = isEdit && !!baseRecipe;      // the route can do a real script edit
    // For a no-recipe refine, fold the prior subject into this prompt so the regeneration stays on-subject.
    const priorSubject = baseVer?.prompt ?? open?.title;
    const subjectPrompt = isEdit && !isRecipeEdit && priorSubject
      ? `${priorSubject}, ${prompt}` : apiPrompt;

    // Engine: a FRESH design uses the user's selection (Auto → server classifies the prompt). A refine
    // keeps the version's engine (recipe engines edit their script; imported/NVIDIA regenerate textured).
    const engine: RequestEngine = isEdit ? refineEngine(baseVer?.engine) : engineSel;
    buildEngine.current = engine;
    lastSource.current = undefined;

    let proj: Project;
    if (isEdit) {
      proj = open!;
    } else {
      proj = { id: newId(), title: prompt, createdAt: Date.now(), updatedAt: Date.now(), versions: [], messages: [] };
      projectRef.current = proj;
      resetMsgs([]); // fresh project → fresh thread
    }
    const idx = isEdit ? proj.versions.length : 0; // append a NEW slot on a refine
    buildVersionIdx.current = idx;
    building.current = true;

    pushMsg("user", prompt);   // CONTINUOUS chat: each prompt is a turn in the same conversation
    setUserPrompt(prompt);
    // SMART HINT (non-blocking): on a fresh design, ask if a ready-made model likely exists → nudge.
    setHintPrompt(null);
    if (!isEdit) {
      fetch("/api/classify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) })
        .then((r) => r.json()).then((d) => { if (d?.likely) setHintPrompt(prompt); }).catch(() => { /* hint is best-effort */ });
    }
    setVersionCount(Math.max(proj.versions.length, idx + 1));
    setCurVersion(idx);
    setRendering(true);
    dispatch({ type: "reset", vm: baseVM(displayMode(engine), "empty") });

    // Upsert the version slot in place (contiguous append; never a sparse hole) and persist.
    // `prompt` is the accumulated subject for THIS version so the next no-recipe refine stays on-subject.
    const versionSubject = isEdit && !isRecipeEdit ? subjectPrompt : prompt;
    // "auto" isn't a stored engine — the server resolves the concrete engine and returns it on `summary`.
    const versionEngine: ProjectVersion["engine"] = engine === "auto" ? undefined : engine;
    const upsertVersion = (patch: Partial<ProjectVersion>) => {
      const cur: ProjectVersion = proj.versions[idx] ?? { meshUrl: "", estimate: null, stages: 0, engine: versionEngine, prompt: versionSubject, createdAt: Date.now() };
      proj.versions[idx] = { ...cur, engine: versionEngine, ...patch }; // patch.engine (from summary) wins
      setVersionCount(proj.versions.length);
      persist();
    };

    // PURE SIZE EDIT on a no-recipe model ("make it smaller") → scale the existing mesh, don't
    // regenerate (TRELLIS would make a different object). Recipe models edit their script instead.
    const sizeEdit = isEdit && !isRecipeEdit ? parseSizeEdit(prompt) : null;
    const baseMesh = baseVer?.storageUrl || baseVer?.meshUrl;

    const handleEvent = (event: import("@/lib/agentEvent").AgentEvent) => {
      if (event.kind === "mesh" || event.kind === "summary") setRendering(false); // never leave the loader stuck
      if (event.kind === "mesh") {
        // The STORED glbUrl must match what the viewport shows on re-pick (it prefers glbUrl over the STL),
        // i.e. mirror vm.glbUrl. Only a pure SIZE EDIT reuses the same textured object scaled → keep the base
        // GLB. Any OTHER mesh mirrors the event: e.g. a "Clean in Blender" cleaned STL has NO texture, so we
        // must drop the GLB — otherwise re-picking v2 shows the stale colored GLB instead of the colorless
        // cleaned mesh the user just watched ("v2 reverted to colored / wasn't saved").
        const glbUrl = event.glbUrl ?? (sizeEdit ? baseVer?.glbUrl : undefined);
        upsertVersion({ meshUrl: event.url, glbUrl, stages: event.totalStages });
      } else if (event.kind === "estimate") {
        upsertVersion({ estimate: { grams: event.grams, minutes: event.minutes, layers: event.layers, material: event.material } });
      } else if (event.kind === "printplan") {
        upsertVersion({ printPlan: event.plan });
      } else if (event.kind === "summary") {
        if (event.source) lastSource.current = event.source;
        pushMsg("assistant", event.text); // assistant turn in the thread
        // save the final recipe (so the NEXT prompt refines THIS model) + the durable storage URL +
        // the engine the SERVER actually resolved (so an Auto pick stores its concrete engine).
        upsertVersion({ source: event.source ?? lastSource.current ?? baseVer?.source, storageUrl: event.meshUrl, ...(event.engine ? { engine: event.engine } : {}), ...(event.parts ? { parts: event.parts } : {}) });
        building.current = false;
      }
      dispatch({ type: "event", event });
    };

    playerRef.current = sizeEdit && baseMesh
      ? playTransformStream(baseMesh, sizeEdit, handleEvent)
      : playAgentStream(subjectPrompt, engine, handleEvent, {
          base: isRecipeEdit ? baseRecipe : undefined, sizeMm: genOpts?.sizeMm, refImageUrl: genOpts?.refImageUrl,
          postSteps: cleanInBlender ? { cleanInBlender: true } : undefined,
        });
  }, [stop, curVersion, engineSel, cleanInBlender, pushMsg, resetMsgs, persist]);

  // Public entry: ask clarifying questions on a FRESH prompt, then generate. Refine-edits skip
  // straight through (they edit the open model in place). Clarify never blocks — failures generate.
  const submitPrompt = useCallback((text: string) => {
    const prompt = text.trim();
    if (!prompt) return;
    const ref = refImageUrl; // capture the attached reference image (if any)
    const open = projectRef.current;
    const baseVer = open?.versions[curVersion] ?? (open ? latest(open) : undefined);
    const isEdit = !!open && !!baseVer; // any open version refines in place → skip the clarify card
    if (isEdit) { runGenerate(prompt, { refImageUrl: ref ?? undefined }); return; }
    // INSTANT feedback: show the clarify card immediately in a loading state (claude questions take ~15s),
    // then populate when they arrive. A guard token drops a late fetch if the user already Skipped/resubmitted.
    const myToken = ++clarifyToken.current;
    setUserPrompt(prompt);
    setThinking(true); // chat-side loader — never look frozen while questions are prepared (~15s)
    fetchClarify(prompt)
      .then((res) => {
        if (clarifyToken.current !== myToken) return; // superseded (skipped / new prompt)
        setThinking(false);
        if (res.questions.length) setClarify({ prompt, questions: res.questions, refImageUrl: ref, loading: false });
        else runGenerate(prompt, { refImageUrl: ref ?? undefined });
      })
      .catch(() => { if (clarifyToken.current === myToken) { setThinking(false); runGenerate(prompt, { refImageUrl: ref ?? undefined }); } });
  }, [runGenerate, curVersion, refImageUrl]);

  // Upload an attached reference image → its URL is passed to generation (Claude vision describes it).
  const attachImage = useCallback(async (file: File) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch("/api/upload", { method: "POST", body: fd });
      const d = await r.json();
      if (d?.url) setRefImageUrl(d.url as string);
    } catch { /* upload best-effort */ }
  }, []);

  // SEARCH existing models (Browserbase) → stream results into the overlay as each source returns.
  const runSearch = useCallback((q?: string) => {
    const query = (q ?? "").trim() || (userPrompt ?? "").trim();
    setHintPrompt(null);
    searchPlayerRef.current?.cancel();
    setSearchOpen(true);
    setSearchQuery(query);
    setSearchResults([]);
    setSearchError(null);
    if (!query) { setSearching(false); return; }
    setSearching(true);
    const acc: ModelResult[] = [];
    searchPlayerRef.current = playSearchStream(query, (e) => {
      if (e.kind === "result") { acc.push(e.model); setSearchResults([...acc]); }
      else if (e.kind === "searchdone") setSearching(false);
      else if (e.kind === "searcherror") { setSearchError(e.message); setSearching(false); }
    });
  }, [userPrompt]);

  // IMPORT a chosen model → fetch STL → SAME pipeline (estimate/print-plan/storage) → saved as an
  // `imported` version with attribution. Mirrors submitPrompt's machinery but streams from /api/import.
  const importModel = useCallback((result: ModelResult) => {
    searchPlayerRef.current?.cancel();
    setSearchOpen(false);
    setHintPrompt(null);
    stop();
    setBooting(false);

    const proj: Project = { id: newId(), title: result.title, createdAt: Date.now(), updatedAt: Date.now(), versions: [], messages: [] };
    projectRef.current = proj;
    resetMsgs([]);
    const idx = 0;
    buildVersionIdx.current = idx;
    buildEngine.current = "blender"; // imported has no recipe; a later refine regenerates fresh
    lastSource.current = undefined;
    building.current = true;

    pushMsg("user", `Import “${result.title}” from ${result.sourceSite}`);
    setUserPrompt(result.title);
    setVersionCount(1);
    setCurVersion(0);
    setRendering(true);
    dispatch({ type: "reset", vm: baseVM("figure", "empty") });

    const upsert = (patch: Partial<ProjectVersion>) => {
      const cur: ProjectVersion = proj.versions[idx] ?? { meshUrl: "", estimate: null, stages: 0, engine: "imported", createdAt: Date.now() };
      proj.versions[idx] = { ...cur, ...patch, engine: "imported", attribution: { author: result.author, license: result.license, sourceUrl: result.sourceUrl, sourceSite: result.sourceSite } };
      setVersionCount(proj.versions.length);
      persist();
    };

    playerRef.current = playImportStream(result, (event) => {
      if (event.kind === "mesh" || event.kind === "summary") setRendering(false);
      if (event.kind === "mesh") upsert({ meshUrl: event.url, glbUrl: event.glbUrl, stages: event.totalStages });
      else if (event.kind === "estimate") upsert({ estimate: { grams: event.grams, minutes: event.minutes, layers: event.layers, material: event.material } });
      else if (event.kind === "printplan") upsert({ printPlan: event.plan });
      else if (event.kind === "summary") { pushMsg("assistant", event.text); upsert({ storageUrl: event.meshUrl }); building.current = false; }
      dispatch({ type: "event", event });
    });
  }, [stop, pushMsg, resetMsgs, persist]);

  // MAKE WITH AI: a login-walled result can't be downloaded → regenerate a printable, textured version
  // from its thumbnail via image→3D meshgen. Mirrors importModel but streams from /api/generate.
  const makeWithAi = useCallback((result: ModelResult) => {
    searchPlayerRef.current?.cancel();
    setSearchOpen(false);
    setHintPrompt(null);
    stop();
    setBooting(false);

    const proj: Project = { id: newId(), title: result.title, createdAt: Date.now(), updatedAt: Date.now(), versions: [], messages: [] };
    projectRef.current = proj;
    resetMsgs([]);
    const idx = 0;
    buildVersionIdx.current = idx;
    buildEngine.current = "blender";
    lastSource.current = undefined;
    building.current = true;

    pushMsg("user", `Make “${result.title}” with AI (from ${result.sourceSite})`);
    setUserPrompt(result.title);
    setVersionCount(1);
    setCurVersion(0);
    setRendering(true);
    dispatch({ type: "reset", vm: baseVM("figure", "empty") });

    const upsert = (patch: Partial<ProjectVersion>) => {
      const cur: ProjectVersion = proj.versions[idx] ?? { meshUrl: "", estimate: null, stages: 0, engine: "imported", createdAt: Date.now() };
      proj.versions[idx] = { ...cur, ...patch, engine: "imported", attribution: { author: result.author, license: result.license, sourceUrl: result.sourceUrl, sourceSite: result.sourceSite } };
      setVersionCount(proj.versions.length);
      persist();
    };

    playerRef.current = playMakeWithAiStream(result, (event) => {
      if (event.kind === "mesh" || event.kind === "summary") setRendering(false);
      if (event.kind === "mesh") upsert({ meshUrl: event.url, glbUrl: event.glbUrl, stages: event.totalStages });
      else if (event.kind === "estimate") upsert({ estimate: { grams: event.grams, minutes: event.minutes, layers: event.layers, material: event.material } });
      else if (event.kind === "printplan") upsert({ printPlan: event.plan });
      else if (event.kind === "summary") { pushMsg("assistant", event.text); upsert({ storageUrl: event.meshUrl }); building.current = false; }
      dispatch({ type: "event", event });
    });
  }, [stop, pushMsg, resetMsgs, persist]);

  // VOICE: speak your idea. Web Speech now (Deepgram drops in behind this hook later).
  const voice = useSpeechToText(submitPrompt);
  const micActive = voice.listening;
  const toggleMic = useCallback(() => {
    if (voice.listening) voice.stop();
    else voice.start();
  }, [voice]);

  // New chat: drop the current project and return to the empty "describe anything" state.
  const newChat = useCallback(() => {
    stop();
    voice.stop();
    searchPlayerRef.current?.cancel();
    setSearchOpen(false);
    setHintPrompt(null);
    setBooting(false);
    setUserPrompt(null);
    setModePopover(false);
    projectRef.current = null;
    buildVersionIdx.current = 0;
    lastSource.current = undefined;
    building.current = false;
    resetMsgs([]);
    setVersionCount(0);
    setCurVersion(0);
    if (typeof window !== "undefined" && window.location.search) window.history.replaceState(null, "", "/app");
    dispatch({ type: "reset", vm: baseVM(mode, "empty") });
  }, [stop, voice, resetMsgs, mode]);

  // Click a version in the rail → show that version's mesh (no regeneration, no version mutation, chat
  // stays). The next prompt refines from whichever version is selected (curVersion feeds the base recipe).
  const pickVersion = useCallback((i: number) => {
    const p = projectRef.current;
    const v = p?.versions[i];
    if (!p || !v) return;
    stop();
    setCurVersion(i);
    const m: Mode = (v.engine === "openscad" || v.engine === "fusion") ? "parametric" : "figure";
    setMode(m);
    const row: FeedRow = { t: "00:00", glyph: "✓", label: `version v${i + 1}`, detail: p.title, kind: "ok" };
    dispatch({ type: "reset", vm: { ...baseVM(m, "complete"), meshUrl: v.meshUrl, glbUrl: v.glbUrl ?? null, textured: Boolean(v.glbUrl), estimate: v.estimate, printPlan: v.printPlan ?? null, readiness: v.readiness ?? null, totalStages: v.stages, rows: [row] } });
  }, [stop]);

  const sendPrint = useCallback(() => {
    setRippleKey((k) => k + 1);
    stop();
    let layer = 12;
    dispatch({ type: "event", event: { t: "00:20", kind: "print", printer: "BAMBU-A1", layer, totalLayers: 847, etaMin: 81 } });
    printTimer.current = setInterval(() => {
      layer = Math.min(847, layer + 7);
      const eta = Math.max(0, Math.round(((847 - layer) / 847) * 83));
      dispatch({ type: "event", event: { t: "00:20", kind: "print", printer: "BAMBU-A1", layer, totalLayers: 847, etaMin: eta } });
      if (layer >= 847 && printTimer.current) { clearInterval(printTimer.current); printTimer.current = null; }
    }, 260);
  }, [stop]);

  // PREPARE FOR PRINT (Print-Readiness v2): a deliberate per-version action → /api/prepare runs the
  // diagnose→orient→export pipeline; the tool chips stream into the feed and the `printready` package
  // is saved on THIS version (restored on reopen / version-switch). The STL is the print artifact.
  const prepareForPrint = useCallback(() => {
    const mesh = vm.meshUrl;
    if (!mesh || preparing) return;
    setPreparing(true);
    const idx = curVersion;
    preparePlayer.current?.cancel();
    preparePlayer.current = playPrepareStream(mesh, (event) => {
      if (event.kind === "printready") {
        const p = projectRef.current;
        if (p && p.versions[idx]) { p.versions[idx] = { ...p.versions[idx], readiness: event.readiness }; persist(); }
      } else if (event.kind === "summary") {
        setPreparing(false);
      }
      dispatch({ type: "event", event });
    });
  }, [vm.meshUrl, curVersion, preparing, persist]);

  // PRINT IN PARTS (/api/split): cut the finished mesh into push-fit pieces. The `split` package streams
  // back (per-part STLs + exact connector measurements + an exploded preview mesh) and the viewport flips
  // to the exploded preview so the user sees the print-in-parts version immediately.
  const splitForPrint = useCallback((parts: number) => {
    const mesh = vm.meshUrl;
    if (!mesh || splitting) return;
    setSplitting(true);
    splitPlayer.current?.cancel();
    splitPlayer.current = playSplitStream(mesh, { parts }, (event) => {
      if (event.kind === "split") setSplitView("parts");
      else if (event.kind === "summary") setSplitting(false);
      dispatch({ type: "event", event });
    });
  }, [vm.meshUrl, splitting]);

  // In PARTS view show the exploded preview mesh; otherwise the whole model. Pure selection — the reducer's
  // vm.meshUrl (the whole mesh) is never mutated, so toggling back to Whole is instant.
  const viewportMeshUrl = splitView === "parts" && vm.split?.previewUrl ? vm.split.previewUrl : vm.meshUrl;

  const stages = deriveStages(vm.phase);
  const showConvo = !!userPrompt || (vm.phase !== "boot" && vm.phase !== "empty");
  // Reference-image upload isn't built yet (future Novita photo→mesh path), so don't show the
  // placeholder chip just because Blender/figure is selected — it would look broken every time.
  const showRefImage = false;
  const buildStatus =
    vm.totalStages > 0 ? `building ${vm.stage}/${vm.totalStages}` : "rendering";
  // ASCII corner PrinterLoader status (in-viewport, during forming/printing waits)
  const loaderStatus =
    vm.phase === "printing" && vm.print
      ? `printing layer ${vm.print.layer}/${vm.print.totalLayers}`
      : vm.phase === "forming"
        ? buildStatus
        : null;

  return (
    <>
      <TopBar stages={stages} printerStatus="BAMBU-A1 online" onNewChat={newChat} user={user} />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <ConversationPanel
          mode={mode}
          showConvo={showConvo}
          micActive={micActive}
          showModePopover={modePopover}
          showRefImage={showRefImage}
          thinking={thinking}
          userPrompt={userPrompt ?? undefined}
          messages={messages}
          transcript={voice.transcript}
          voiceSupported={voice.supported}
          onToggleMic={toggleMic}
          onToggleMode={() => setModePopover((v) => !v)}
          onPickMode={(m) => { setMode(m); setModePopover(false); }}
          onRemoveRef={() => setRefImageUrl(null)}
          onAttachImage={attachImage}
          refImageUrl={refImageUrl}
          onSubmitPrompt={submitPrompt}
          onFindExisting={runSearch}
        />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#ECE7DC" }}>
          {hintPrompt && !searchOpen && (
            <div style={{ flex: "none", display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", background: "#F6ECE6", borderBottom: "1px solid #E6CFC2", fontSize: 13, color: "#232019" }}>
              <span style={{ fontSize: 14 }}>🔍</span>
              <span style={{ flex: 1, minWidth: 0 }}>Ready-made versions may already exist — skip the wait?</span>
              <button onClick={() => runSearch(hintPrompt)} style={{ flex: "none", height: 28, padding: "0 12px", borderRadius: 9999, border: "none", background: "#cc785c", color: "#fff", cursor: "pointer", fontFamily: "inherit", fontWeight: 700, fontSize: 12 }}>Find them →</button>
              <span onClick={() => setHintPrompt(null)} style={{ flex: "none", cursor: "pointer", color: "#A6A095", fontSize: 14, padding: "0 2px" }}>✕</span>
            </div>
          )}
          {booting ? (
            <BootOverlay onSkip={() => { setBooting(false); dispatch({ type: "reset", vm: baseVM(mode, "empty") }); }} />
          ) : clarify ? (
            <ClarifyCard
              prompt={clarify.prompt}
              questions={clarify.questions}
              loading={clarify.loading}
              onSubmit={(prefs, sizeMm) => { const c = clarify; setClarify(null); runGenerate(c.prompt, { prefs, sizeMm, refImageUrl: c.refImageUrl ?? undefined }); }}
              onSkip={() => { const c = clarify; setClarify(null); runGenerate(c.prompt, { refImageUrl: c.refImageUrl ?? undefined }); }}
            />
          ) : rendering ? (
            <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#ECE7DC" }}>
              <RenderLoader status={userPrompt ? "Designing your model" : "Rendering preview"} sub="generating geometry — this can take a moment" />
            </div>
          ) : (
            <Viewport phase={vm.phase} marker={vm.marker} gizmo={vm.phase === "complete" ? "translate" : null} loaderStatus={loaderStatus} meshUrl={viewportMeshUrl} glbUrl={splitView === "parts" ? null : vm.glbUrl} textured={splitView === "parts" ? false : vm.textured} supportsNeeded={splitView === "parts" ? false : (vm.printPlan?.supports.needed ?? false)} pillars={splitView === "parts" ? null : (vm.printPlan?.supports.pillars ?? null)} supportBaseZ={splitView === "parts" ? null : (vm.printPlan?.supports.baseZ ?? null)} />
          )}
          <VersionRail current={curVersion} count={versionCount} onPick={pickVersion} />
        </div>
        <div style={{ width: 340, flex: "none", borderLeft: "1px solid #DCD7CC", background: "#FBFAF6", display: "flex", flexDirection: "column", minHeight: 0, overflowY: "auto" }}>
          <AgentFeed rows={vm.rows} engine={engineSel} onPickEngine={(e) => { setEngineSel(e); setMode(displayMode(e)); }} cleanInBlender={cleanInBlender} onToggleClean={setCleanInBlender} miniFrame={miniFrame} />
          <PrintCenter print={vm.print} estimate={vm.estimate} rippleKey={rippleKey} onSend={sendPrint} />
          <PrintPlan plan={vm.printPlan} modelName={userPrompt} />
          <PrintPartsPanel
            split={vm.split}
            canSplit={vm.phase === "complete" && !!vm.meshUrl}
            splitting={splitting}
            view={splitView}
            onSplit={splitForPrint}
            onSetView={setSplitView}
            modelName={userPrompt}
          />
          <PrintReadyPanel
            readiness={vm.readiness}
            parts={projectRef.current?.versions[curVersion]?.parts ?? null}
            canPrepare={vm.phase === "complete" && !!vm.meshUrl}
            preparing={preparing}
            onPrepare={prepareForPrint}
            modelName={userPrompt}
          />
        </div>
      </div>
      <ModelSearchPanel
        open={searchOpen}
        query={searchQuery}
        results={searchResults}
        loading={searching}
        error={searchError}
        onUse={importModel}
        onMakeWithAi={makeWithAi}
        onClose={() => { searchPlayerRef.current?.cancel(); setSearchOpen(false); }}
        onDesignInstead={() => { searchPlayerRef.current?.cancel(); setSearchOpen(false); }}
      />
    </>
  );
}

function BootOverlay({ onSkip }: { onSkip: () => void }) {
  return (
    <div onClick={onSkip} style={{ flex: 1, position: "relative", minHeight: 0, overflow: "hidden", background: "#ECE7DC", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
      <RenderLoader status="Warming up the printer" sub="openscad · mesh · blender" />
    </div>
  );
}
