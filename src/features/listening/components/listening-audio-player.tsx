"use client";

import { Gauge, Headphones } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { ListeningTrack } from "@/features/listening/data";
import { cn } from "@/lib/utils";

const PLAYBACK_RATES = [0.75, 1, 1.25] as const;
type PlaybackRate = (typeof PLAYBACK_RATES)[number];

function rateLabel(rate: PlaybackRate) {
  return `${rate}x`;
}

export function ListeningAudioPlayer({ track }: { track: ListeningTrack }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [rate, setRate] = useState<PlaybackRate>(1);

  const selectRate = (nextRate: PlaybackRate) => {
    setRate(nextRate);
    if (audioRef.current) audioRef.current.playbackRate = nextRate;
  };

  return (
    <article className="rounded-2xl border border-[#c3dbf4] bg-white p-4 shadow-[0_10px_30px_rgba(13,63,120,0.07)] sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#e6effa] text-[#1a5fa8]">
          <Headphones className="size-5" aria-hidden />
        </span>
        <h2 className="pt-1.5 text-base leading-6 font-bold text-[#0d3f78] sm:text-lg">
          {track.title}
        </h2>
      </div>

      <audio
        ref={audioRef}
        data-listening-audio
        className="mt-4 w-full"
        controls
        preload="metadata"
        src={track.src}
        aria-label={track.title}
        onLoadedMetadata={(event) => {
          event.currentTarget.playbackRate = rate;
        }}
        onPlay={(event) => {
          document
            .querySelectorAll<HTMLAudioElement>("audio[data-listening-audio]")
            .forEach((audio) => {
              if (audio !== event.currentTarget) audio.pause();
            });
        }}
      >
        Trình duyệt của bạn không hỗ trợ phát audio.
      </audio>

      <div
        className="mt-4 flex flex-wrap items-center gap-2"
        role="group"
        aria-label={`Tốc độ phát ${track.title}`}
      >
        <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-semibold text-[#43536b]">
          <Gauge className="size-4" aria-hidden /> Tốc độ
        </span>
        {PLAYBACK_RATES.map((candidate) => (
          <Button
            key={candidate}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={candidate === rate}
            aria-label={`Tốc độ ${rateLabel(candidate)}`}
            className={cn(
              "min-w-14 rounded-full tabular-nums",
              candidate === rate &&
                "border-[#1a5fa8] bg-[#e6effa] font-bold text-[#134b86]",
            )}
            onClick={() => selectRate(candidate)}
          >
            {rateLabel(candidate)}
          </Button>
        ))}
      </div>

      {track.image ? (
        <figure className="mt-5 overflow-hidden rounded-xl border border-[#dde5ee] bg-[#f6f8fb]">
          <Image
            src={track.image.src}
            width={track.image.width}
            height={track.image.height}
            sizes="(max-width: 768px) calc(100vw - 3rem), 44rem"
            alt={`Nội dung minh họa cho ${track.title}`}
            className="h-auto w-full"
          />
          <figcaption className="border-t border-[#dde5ee] bg-white px-3 py-2 text-sm leading-5 font-medium text-[#43536b]">
            Hình minh họa – {track.title}
          </figcaption>
        </figure>
      ) : null}
    </article>
  );
}
