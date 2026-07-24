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
  /**
   * Mốc phát tự động. Đổi sang một chuỗi mới ⇒ phát lại từ đầu; đổi về `null`
   * ⇒ dừng. Người gọi vì thế điều khiển được audio mà không cần cầm `ref`.
   *
   * Cố ý là "mốc" chứ không phải cờ `boolean`: cùng một trang có thể phải phát
   * lại nhiều lần (lật đi lật lại), mà `true → true` thì effect không chạy.
   * Vế `null` là chỗ thoả WCAG 2.2.2 — người dùng tắt phát tự động thì tiếng
   * đang đọc dở phải im ngay, không đọc nốt.
   */
  autoPlayToken?: string | null;
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
  autoPlayToken = null,
}: StudentAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const labelId = useId();
  const [rate, setRate] = useState<StudentAudioRate>(1);
  const [playing, setPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const lastAutoPlayToken = useRef<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) applyPlaybackSettings(audio, rate);
  }, [rate]);

  // Phát/dừng theo mốc của người gọi. Không đụng tới lượt phát THỦ CÔNG: khi
  // người gọi không truyền `autoPlayToken`, mốc luôn là `null` và nhánh dừng
  // chỉ chạy nếu trước đó chính effect này đã phát.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (autoPlayToken === null) {
      if (lastAutoPlayToken.current !== null) {
        lastAutoPlayToken.current = null;
        audio.pause();
      }
      return;
    }
    if (autoPlayToken === lastAutoPlayToken.current) return;

    lastAutoPlayToken.current = autoPlayToken;
    audio.currentTime = 0;
    applyPlaybackSettings(audio, rate);
    void audio.play().catch(() => {
      setPlaying(false);
      setHasError(true);
    });
  }, [autoPlayToken, rate]);

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

  /**
   * Dải tốc độ dựng theo lối SEGMENTED CONTROL: ba nút dính liền thành một khối
   * duy nhất, cùng chiều cao với mọi nút quanh nó.
   *
   * Ba chi tiết là CỐ Ý, không phải trang trí:
   * - **Không bọc `overflow-hidden`.** Khối liền thường được làm bằng cách bọc
   *   viền ngoài rồi cắt góc trong; làm vậy sẽ CẮT LUÔN vòng focus 3px của nút
   *   bên trong. Ở đây mỗi nút giữ viền của chính nó, chồng mép bằng `-ml-px`,
   *   và `focus-visible:z-10` nâng nút đang focus lên trên nút kế.
   * - **Không đặt chiều cao cố định cho khối bọc.** `globals.css` ép mọi
   *   `button` cao ≥44px trên cảm ứng; khối bọc có chiều cao cứng thì trên điện
   *   thoại nút sẽ tràn ra ngoài khối. Để khối tự co theo con là cách duy nhất
   *   giữ nó bằng đúng chiều cao các nút hàng xóm ở CẢ hai loại con trỏ.
   * - **Trạng thái chọn không chỉ báo bằng màu**: thêm `font-semibold`, để
   *   người mù màu vẫn phân biệt được (cùng lý do `StatusBadge` luôn có chữ).
   */
  const rateSelector = (
    <div className="flex items-center gap-2">
      <span className="text-text-secondary shrink-0 text-sm font-medium">
        Tốc độ
      </span>
      <div
        role="group"
        aria-label={"Tốc độ phát " + label}
        className="inline-flex items-center"
      >
        {STUDENT_AUDIO_RATES.map((candidate, index) => {
          const selected = candidate === rate;
          const first = index === 0;
          const last = index === STUDENT_AUDIO_RATES.length - 1;
          return (
            <Button
              key={candidate}
              type="button"
              variant="outline"
              aria-label={"Tốc độ " + formatRate(candidate)}
              aria-pressed={selected}
              className={cn(
                "relative min-w-16 px-3 tabular-nums focus-visible:z-10",
                !first && "-ml-px",
                !first && "rounded-l-none",
                !last && "rounded-r-none",
                selected
                  ? "border-primary-500 bg-primary-50 text-primary-700 z-10 font-semibold"
                  : "text-text-secondary",
              )}
              onClick={() => chooseRate(candidate)}
            >
              {formatRate(candidate)}
            </Button>
          );
        })}
      </div>
    </div>
  );

  const error = hasError ? (
    <div className="flex w-full flex-wrap items-center gap-2" role="alert">
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
          className="min-w-32"
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
          {/*
            Chữ trên nút CỐ TÌNH không còn là `label` (chữ Hán của thẻ).
            Hai lý do: (1) `label` dài ngắn tuỳ thẻ — 1 tới 4 chữ Hán rồi
            `truncate` — nên nút đổi bề rộng theo từng trang, đó chính là thứ
            làm hàng nút trông so le; (2) chữ Hán đã hiện ở mặt thẻ và ở dòng
            nhận dạng ngay trên nút, in lần thứ ba không thêm thông tin gì.
            Tên gọi cho trình đọc màn hình VẪN mang `label` qua `aria-label`,
            và chữ hiện ra là phần ĐẦU của tên gọi đó nên không phạm
            WCAG 2.5.3 (Label in Name).
          */}
          {playing ? "Dừng audio" : "Phát audio"}
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
