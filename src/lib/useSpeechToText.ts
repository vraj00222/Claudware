"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Speak-your-idea voice input. Uses the browser-native Web Speech API (zero keys, offline-ish)
 * as the default engine. This hook is the SEAM: a Deepgram streaming engine drops in behind the
 * same {supported, listening, transcript, start, stop} shape when DEEPGRAM_API_KEY is present
 * (real Deepgram needs a backend WS proxy — see docs/ROADMAP.md). The UI never changes.
 */
export interface SpeechToText {
  supported: boolean;
  listening: boolean;
  transcript: string; // live interim transcript while listening
  start: () => void;
  stop: () => void;
}

// minimal typing for the non-standard SpeechRecognition API
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function useSpeechToText(onFinal: (text: string) => void): SpeechToText {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Must start `false` so the server render and the client's FIRST render agree (window-dependent
  // values diverge → React hydration mismatch). We flip it to the real value after mount.
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- legit: read window capability post-mount
    setSupported("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  }, []);

  const start = useCallback(() => {
    if (!supported) return;
    const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const t = res[0].transcript;
        if (res.isFinal) finalText += t;
        else interim += t;
      }
      setTranscript((finalText + interim).trim());
    };
    rec.onend = () => {
      setListening(false);
      const t = finalText.trim();
      setTranscript("");
      if (t) onFinal(t);
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setTranscript("");
    setListening(true);
    rec.start();
  }, [supported, onFinal]);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  useEffect(() => () => recRef.current?.stop(), []);

  return { supported, listening, transcript, start, stop };
}
