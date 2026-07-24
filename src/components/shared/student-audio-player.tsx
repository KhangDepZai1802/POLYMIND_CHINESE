"use client";

import { Pause, Volume2 } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const STUDENT_AUDIO_RATES = [0.5, 0.75, 1] as const;

type StudentAudioRate = (typeof STUDENT_AUDIO_RATES)[number];
type PitchPreservingAudio = HTMLAudioElement & {
  mozPreservesPitch?: boolean;
  webkitPreservesPitch?: boolean;
};
type StudentAudioPlayerProps = {
  src: string;
  label: string;
  appearance?: "controls" | "button";
  className?: string;
};

function formatRate(rate: StudentAudioRate) {
  return String(rate) + "×";
}

function applyPlaybackSettings(
  audio: HTMLAudioElement,
  rate: StudentAudioRate,
) {
  audio.playbackRate = rate;

  const pitchAudio = audio as PitchPreservingAudio;
  if ("preservesPitch" in pitchAudio) pitchAudio.preservesPitch = true;
  if ("mozPreservesPitch" in pitchAudio) pitchAudio.mozPreservesPitch = true;
  if ("webkitPreservesPitch" in pitchAudio) {
    pitchAudio.webkitPreservesPitch = true;
  }
}

export function StudentAudioPlayer(props: StudentAudioPlayerProps) {
  return <StudentAudioPlayerSource key={props.src} {...props} />;
}

function StudentAudioPlayerSource({
  src,
  label,
  appearance = "controls",
  className,
}: StudentAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const labelId = useId();
  const [rate, setRate] = useState<StudentAudioRate>(1);
  const [playing, setPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) applyPlaybackSettings(audio, rate);
  }, [rate]);

  const chooseRate = (nextRate: StudentAudioRate) => {
    setRate(nextRate);
    const audio = audioRef.current;
    if (audio) applyPlaybackSettings(audio, nextRate);
  };

  const retry = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setHasError(false);
    audio.load();
    applyPlaybackSettings(audio, rate);
  };

  const audio = (
    <audio
      key={src}
      ref={audioRef}
      src={src}
      preload="metadata"
      controls={appearance === "controls"}
      aria-labelledby={labelId}
      className={appearance === "controls" ? "w-full" : "hidden"}
      onLoadedMetadata={(event) =>
        applyPlaybackSettings(event.currentTarget, rate)
      }
      onPlay={() => setPlaying(true)}
      onPause={() => setPlaying(false)}
      onEnded={() => setPlaying(false)}
      onError={() => {
        setPlaying(false);
        setHasError(true);
      }}
    >
      <track kind="captions" />
    </audio>
  );

  const rateSelector = (
    <div
      role="group"
      aria-label={"Tốc độ phát " + label}
      className="flex flex-wrap items-center gap-2"
    >
      <span className="text-text-secondary text-sm font-medium">Tốc độ</span>
      {STUDENT_AUDIO_RATES.map((candidate) => {
        const selected = candidate === rate;
        return (
          <Button
            key={candidate}
            type="button"
            size="sm"
            variant="outline"
            aria-label={"Tốc độ " + formatRate(candidate)}
            aria-pressed={selected}
            className={cn(
              "min-w-16 tabular-nums",
              selected &&
                "border-primary-500 bg-primary-50 text-primary-700 ring-primary-500 font-semibold ring-1",
            )}
            onClick={() => chooseRate(candidate)}
          >
            <span
              className={cn(
                "size-1.5 rounded-full",
                selected ? "bg-primary" : "bg-transparent",
              )}
              aria-hidden
            />
            {formatRate(candidate)}
          </Button>
        );
      })}
    </div>
  );

  const error = hasError ? (
    <div className="flex flex-wrap items-center gap-2" role="alert">
      <p className="text-destructive text-sm">
        Không phát được audio. Vui lòng thử tải lại.
      </p>
      <Button type="button" size="sm" variant="outline" onClick={retry}>
        Thử lại
      </Button>
    </div>
  ) : null;

  if (appearance === "button") {
    return (
      <div className={cn("flex flex-wrap items-center gap-2", className)}>
        <span id={labelId} className="sr-only">
          {label}
        </span>
        <Button
          type="button"
          aria-label={playing ? "Dừng audio " + label : "Phát audio " + label}
          onClick={() => {
            const element = audioRef.current;
            if (!element) return;
            if (element.paused) {
              element.currentTime = 0;
              void element.play().catch(() => {
                setPlaying(false);
                setHasError(true);
              });
            } else {
              element.pause();
            }
          }}
        >
          {playing ? (
            <Pause className="size-4" aria-hidden />
          ) : (
            <Volume2 className="size-4" aria-hidden />
          )}
          <span className="font-hanzi max-w-40 truncate">{label}</span>
        </Button>
        {rateSelector}
        {audio}
        {error}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-primary-200 bg-primary-50 space-y-3 rounded-xl border p-3",
        className,
      )}
    >
      <p id={labelId} className="text-sm font-medium">
        {label}
      </p>
      {audio}
      {rateSelector}
      {error}
    </div>
  );
}
