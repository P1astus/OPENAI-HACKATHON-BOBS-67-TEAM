"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, Loader2, AudioLines } from "lucide-react";

type Engine = "elevenlabs" | "browser";
type PlayState = "idle" | "loading" | "playing" | "paused";

const BARS = 28;

export default function VoiceBriefingPlayer({ text, demoMode }: { text: string; demoMode: boolean }) {
  const [state, setState] = useState<PlayState>("idle");
  const [engine, setEngine] = useState<Engine | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const engineRef = useRef<Engine | null>(null);

  const stopAll = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  // Reset whenever the briefing text changes (new run / different history entry) and on unmount.
  useEffect(() => {
    return () => {
      stopAll();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
      engineRef.current = null;
    };
  }, [text]);

  const speakWithBrowser = () => {
    if (!("speechSynthesis" in window)) {
      setState("idle");
      return;
    }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    const voices = window.speechSynthesis.getVoices();
    const en = voices.find((v) => v.lang.startsWith("en") && /(Samantha|Daniel|Google|Natural)/i.test(v.name)) ?? voices.find((v) => v.lang.startsWith("en"));
    if (en) u.voice = en;
    u.onend = () => setState("idle");
    u.onerror = () => setState("idle");
    engineRef.current = "browser";
    setEngine("browser");
    setState("playing");
    window.speechSynthesis.speak(u);
  };

  const playUrl = (url: string) => {
    const a = new Audio(url);
    audioRef.current = a;
    a.onended = () => setState("idle");
    a.onerror = () => {
      audioRef.current = null;
      speakWithBrowser();
    };
    engineRef.current = "elevenlabs";
    setEngine("elevenlabs");
    a.play().then(
      () => setState("playing"),
      () => {
        audioRef.current = null;
        speakWithBrowser();
      },
    );
  };

  const toggle = async () => {
    if (state === "loading") return;
    if (state === "playing") {
      if (engineRef.current === "elevenlabs") audioRef.current?.pause();
      else window.speechSynthesis.pause();
      setState("paused");
      return;
    }
    if (state === "paused") {
      if (engineRef.current === "elevenlabs") void audioRef.current?.play();
      else window.speechSynthesis.resume();
      setState("playing");
      return;
    }

    // idle -> start
    if (urlRef.current) return playUrl(urlRef.current);
    if (engineRef.current === "browser") return speakWithBrowser();

    setState("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, demoMode }),
      });
      const type = res.headers.get("content-type") ?? "";
      if (res.ok && type.includes("audio")) {
        const blob = await res.blob();
        urlRef.current = URL.createObjectURL(blob);
        playUrl(urlRef.current);
      } else {
        speakWithBrowser();
      }
    } catch {
      speakWithBrowser();
    }
  };

  const playing = state === "playing";

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause voice briefing" : "Play voice briefing"}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-60"
      >
        {state === "loading" ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : playing ? (
          <Pause className="h-6 w-6" />
        ) : (
          <Play className="h-6 w-6 translate-x-0.5" />
        )}
      </button>

      <div className="flex h-12 min-w-40 flex-1 items-center gap-[3px]" aria-hidden>
        {Array.from({ length: BARS }).map((_, i) => (
          <span
            key={i}
            className={`w-1.5 flex-1 rounded-full ${playing ? "wave-bar bg-emerald-400" : "bg-zinc-700"}`}
            style={{
              height: `${30 + ((i * 37) % 70)}%`,
              animationDelay: `${(i * 83) % 700}ms`,
              animationDuration: `${650 + ((i * 53) % 500)}ms`,
              transform: playing ? undefined : "scaleY(0.6)",
            }}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <AudioLines className="h-4 w-4 text-zinc-500" />
        <span
          className={`rounded-full border px-3 py-1 text-xs font-bold tracking-wide ${
            engine === "elevenlabs"
              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
              : engine === "browser"
                ? "border-amber-500/50 bg-amber-500/10 text-amber-300"
                : "border-zinc-700 text-zinc-400"
          }`}
        >
          {engine === "elevenlabs" ? "ELEVENLABS HD" : engine === "browser" ? "BROWSER FALLBACK" : "VOICE BRIEFING"}
        </span>
      </div>
    </div>
  );
}
