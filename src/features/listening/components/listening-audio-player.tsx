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
    <article className="rounded-2xl border border-[#c3dbf4] bg-white p-3.5 shadow-[0_10px_30px_rgba(13,63,120,0.07)] sm:p-5">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#e6effa] text-[#1a5fa8] sm:size-10">
          <Headphones className="size-4 sm:size-5" aria-hidden />
        </span>
        <h2 className="pt-0.5 text-sm leading-snug font-bold text-[#0d3f78] sm:pt-1.5 sm:text-lg sm:leading-6">
          {track.title}
        </h2>
      </div>

      <audio
        ref={audioRef}
        data-listening-audio
        className="mt-3 w-full sm:mt-4"
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
        className="mt-3 flex flex-wrap items-center gap-1.5 sm:mt-4 sm:gap-2"
        role="group"
        aria-label={`Tốc độ phát ${track.title}`}
      >
        <span className="mr-1 inline-flex items-center gap-1 text-xs font-semibold text-[#43536b] sm:text-sm">
          <Gauge className="size-3.5 sm:size-4" aria-hidden /> Tốc độ
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
              "h-8 min-w-12 rounded-full px-2.5 text-xs tabular-nums sm:min-w-14 sm:text-sm",
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
        <figure className="mt-4 overflow-hidden rounded-xl border border-[#dde5ee] bg-[#f6f8fb] sm:mt-5">
          <a
            href={track.image.src}
            target="_blank"
            rel="noopener noreferrer"
            title="Nhấn để phóng to ảnh"
            className="block cursor-zoom-in"
          >
            <Image
              src={track.image.src}
              width={track.image.width}
              height={track.image.height}
              sizes="(max-width: 768px) calc(100vw - 2.5rem), 44rem"
              alt={`Nội dung minh họa cho ${track.title}`}
              className="h-auto w-full transition hover:opacity-95"
            />
          </a>
          <figcaption className="flex items-center justify-between gap-2 border-t border-[#dde5ee] bg-white px-3 py-2 text-xs font-medium text-[#43536b] sm:text-sm">
            <span className="truncate">Hình minh họa – {track.title}</span>
            <a
              href={track.image.src}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 font-semibold text-[#1a5fa8] hover:underline"
            >
              Phóng to ↗
            </a>
          </figcaption>
        </figure>
      ) : null}
    </article>
  );
}
