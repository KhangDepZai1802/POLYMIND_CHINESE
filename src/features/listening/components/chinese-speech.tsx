"use client";

import { Square, Volume2 } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { extractSpeakableChinese } from "@/features/listening/chinese-text";
import { cn } from "@/lib/utils";

type SpeechState = {
  activeId: string | null;
  rate: number;
};

let currentSpeechState: SpeechState = {
  activeId: null,
  rate: 0.9,
};

let activeUtterance: SpeechSynthesisUtterance | null = null;
let sequenceCancelled = false;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function selectChineseVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return null;
  }
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  const zhVoices = voices.filter((voice) =>
    /^(zh|cmn)/i.test(voice.lang.replace("_", "-")),
  );
  if (!zhVoices.length) return null;

  const preferred =
    zhVoices.find(
      (v) =>
        /zh[-_]CN/i.test(v.lang) &&
        /(Natural|Neural|Xiaoxiao|Yunxi|Google|Tingting)/i.test(v.name),
    ) ??
    zhVoices.find((v) => /zh[-_]CN/i.test(v.lang)) ??
    zhVoices[0];

  return preferred ?? null;
}

function stopChineseSpeech() {
  sequenceCancelled = true;
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  activeUtterance = null;
  if (currentSpeechState.activeId !== null) {
    currentSpeechState = { ...currentSpeechState, activeId: null };
    notifyListeners();
  }
}

function setChineseSpeechRate(rate: number) {
  currentSpeechState = { ...currentSpeechState, rate };
  notifyListeners();
}

function speakChineseText(text: string, id: string, rateOverride?: number) {
  const speakable = extractSpeakableChinese(text) || text.trim();
  if (!speakable) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  if (currentSpeechState.activeId === id) {
    stopChineseSpeech();
    return;
  }

  sequenceCancelled = true;
  window.speechSynthesis.cancel();
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  const utterance = new SpeechSynthesisUtterance(speakable);
  utterance.lang = "zh-CN";
  utterance.rate = rateOverride ?? currentSpeechState.rate;

  const voice = selectChineseVoice();
  if (voice) {
    utterance.voice = voice;
  }

  activeUtterance = utterance;
  currentSpeechState = { ...currentSpeechState, activeId: id };
  notifyListeners();

  utterance.onend = () => {
    if (activeUtterance === utterance) {
      activeUtterance = null;
      currentSpeechState = { ...currentSpeechState, activeId: null };
      notifyListeners();
    }
  };

  utterance.onerror = () => {
    if (activeUtterance === utterance) {
      activeUtterance = null;
      currentSpeechState = { ...currentSpeechState, activeId: null };
      notifyListeners();
    }
  };

  window.speechSynthesis.speak(utterance);
}

function speakChineseSequence(items: string[], id: string) {
  const cleaned = items
    .map((item) => extractSpeakableChinese(item) || item.trim())
    .filter(Boolean);
  if (cleaned.length === 0) return;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

  if (currentSpeechState.activeId === id) {
    stopChineseSpeech();
    return;
  }

  sequenceCancelled = false;
  window.speechSynthesis.cancel();
  if (window.speechSynthesis.paused) {
    window.speechSynthesis.resume();
  }

  currentSpeechState = { ...currentSpeechState, activeId: id };
  notifyListeners();

  let index = 0;

  const speakNext = () => {
    const currentText = cleaned[index];
    if (sequenceCancelled || !currentText) {
      activeUtterance = null;
      if (currentSpeechState.activeId === id) {
        currentSpeechState = { ...currentSpeechState, activeId: null };
        notifyListeners();
      }
      return;
    }

    const utterance = new SpeechSynthesisUtterance(currentText);
    utterance.lang = "zh-CN";
    utterance.rate = currentSpeechState.rate;

    const voice = selectChineseVoice();
    if (voice) {
      utterance.voice = voice;
    }

    activeUtterance = utterance;
    index += 1;

    utterance.onend = () => {
      if (!sequenceCancelled) {
        speakNext();
      }
    };

    utterance.onerror = () => {
      if (!sequenceCancelled) {
        speakNext();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  speakNext();
}

function useSpeechState() {
  const [, setTick] = useState(0);

  useEffect(() => {
    const listener = () => setTick((t) => t + 1);
    listeners.add(listener);

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.getVoices();
    }

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return currentSpeechState;
}

export function ChineseSpeakButton({
  text,
  label,
  variant = "icon",
  size = "md",
  className,
}: {
  text: string;
  label?: string;
  variant?: "icon" | "pill" | "header";
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  const { activeId } = useSpeechState();
  const isPlaying = activeId === id;
  const speakable = extractSpeakableChinese(text);

  if (!speakable) return null;

  const ariaLabel = label ?? `Nghe phát âm: ${speakable}`;

  if (variant === "header") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          speakChineseText(speakable, id);
        }}
        aria-label={ariaLabel}
        aria-pressed={isPlaying}
        title={`Nghe phát âm: ${speakable}`}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-white",
          isPlaying
            ? "border-white bg-white text-[#0d3f78] shadow-sm"
            : "border-white/35 bg-white/15 text-white hover:bg-white/25",
          className,
        )}
      >
        {isPlaying ? (
          <Square className="size-3.5 fill-current" aria-hidden />
        ) : (
          <Volume2 className="size-4" aria-hidden />
        )}
        <span>{isPlaying ? "Đang phát..." : "Nghe tiêu đề"}</span>
      </button>
    );
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          speakChineseText(speakable, id);
        }}
        aria-label={ariaLabel}
        aria-pressed={isPlaying}
        title={`Nghe phát âm: ${speakable}`}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-[#1a5fa8]",
          isPlaying
            ? "border-[#0d3f78] bg-[#0d3f78] text-white shadow-xs"
            : "border-[#bdd6f2] bg-[#eef5fc] text-[#0d3f78] hover:border-[#1a5fa8] hover:bg-[#dceafb]",
          className,
        )}
      >
        {isPlaying ? (
          <Square className="size-3 fill-current" aria-hidden />
        ) : (
          <Volume2 className="size-3.5" aria-hidden />
        )}
        <span>{label ?? "Nghe"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        speakChineseText(speakable, id);
      }}
      aria-label={ariaLabel}
      aria-pressed={isPlaying}
      title={`Nghe phát âm: ${speakable}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-2 focus-visible:outline-[#1a5fa8]",
        size === "sm" ? "size-7" : "size-8",
        isPlaying
          ? "border-[#0d3f78] bg-[#0d3f78] text-white shadow-xs"
          : "border-[#bdd6f2] bg-[#eef5fc] text-[#1a5fa8] hover:border-[#1a5fa8] hover:bg-[#dceafb] hover:text-[#0d3f78]",
        className,
      )}
    >
      {isPlaying ? (
        <Square className="size-3 fill-current" aria-hidden />
      ) : (
        <Volume2
          className={size === "sm" ? "size-3.5" : "size-4"}
          aria-hidden
        />
      )}
    </button>
  );
}

export function ChineseSequenceButton({
  items,
  label = "Nghe toàn bộ",
  className,
}: {
  items: string[];
  label?: string;
  className?: string;
}) {
  const id = useId();
  const { activeId } = useSpeechState();
  const isPlaying = activeId === id;

  if (items.length === 0) return null;

  return (
    <button
      type="button"
      onClick={() => speakChineseSequence(items, id)}
      aria-pressed={isPlaying}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-[#1a5fa8]",
        isPlaying
          ? "border-[#0d3f78] bg-[#0d3f78] text-white shadow-xs"
          : "border-[#bdd6f2] bg-white text-[#0d3f78] hover:border-[#1a5fa8] hover:bg-[#eef5fc]",
        className,
      )}
    >
      {isPlaying ? (
        <Square className="size-3.5 fill-current" aria-hidden />
      ) : (
        <Volume2 className="size-4 text-[#1a5fa8]" aria-hidden />
      )}
      <span>{isPlaying ? "Dừng phát" : label}</span>
    </button>
  );
}

export function ChineseSpeechSpeedControl() {
  const { rate } = useSpeechState();

  useEffect(() => {
    return () => {
      stopChineseSpeech();
    };
  }, []);

  const speeds = [
    { value: 0.75, label: "Chậm (0.75x)" },
    { value: 0.9, label: "Chuẩn (0.9x)" },
    { value: 1, label: "Bình thường (1x)" },
  ];

  return (
    <section
      aria-label="Điều khiển giọng đọc tiếng Trung"
      className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#c3dbf4] bg-[#f4f8fd] px-4 py-3 text-sm"
    >
      <span className="flex items-center gap-2 font-medium text-[#0d3f78]">
        <Volume2 className="size-4 shrink-0 text-[#1a5fa8]" aria-hidden />
        <span>
          Bấm vào biểu tượng loa bên cạnh bất kỳ từ vựng hoặc câu nào để nghe
          phát âm tiếng Trung.
        </span>
      </span>
      <span
        className="flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Tốc độ đọc phát âm"
      >
        <span className="mr-1 text-xs font-semibold text-[#5b6b80]">
          Tốc độ đọc:
        </span>
        {speeds.map((item) => {
          const active = Math.abs(rate - item.value) < 0.01;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setChineseSpeechRate(item.value)}
              aria-pressed={active}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-semibold transition",
                active
                  ? "border-[#0d3f78] bg-[#0d3f78] text-white"
                  : "border-[#c3dbf4] bg-white text-[#0d3f78] hover:bg-blue-50",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </span>
    </section>
  );
}
