import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Tỉ lệ THẬT của file logo (640×292 sau khi cắt hết lề trắng thừa).
 *
 * Phải giữ đúng con số này: bản trước gọi logo theo `size` vuông, nên chữ ký
 * thương hiệu vốn nằm ngang bị `object-contain` thu về đúng 1/2,19 chiều cao ô
 * — ô 40px chỉ vẽ ra chữ cao ~16px. Sinh bề rộng từ chiều cao là cách duy nhất
 * để mọi bề mặt gọi cùng một chiều cao mà không ai phải tự tính lại.
 */
const LOGO_ASPECT = 640 / 292;

/** Lề trắng quanh logo khi dùng `plate`, tính theo phần chiều cao logo. */
const PLATE_PADDING_RATIO = 0.22;

type LogoProps = {
  /**
   * Chiều cao THẬT của chữ ký thương hiệu (px) — bề rộng tự suy ra.
   *
   * Gọi theo chiều cao vì đó là chiều mắt đem so với chữ đứng cạnh; gọi theo
   * bề rộng thì mỗi bề mặt lại ra một cỡ chữ khác nhau.
   */
  height?: number;
  /**
   * `bare` — đặt thẳng lên nền sáng (sidebar, header, drawer). Nền của file đã
   * là trắng tuyệt đối nên trùng khít `--card`/`--background` (#ffffff).
   *
   * `plate` — bọc trong tile trắng bo góc, dùng khi nền TỐI (trang đăng nhập),
   * để logo ra hình khối gọn thay vì một mảng trắng lởm chởm.
   */
  variant?: "bare" | "plate";
  /**
   * Để `""` khi ngay cạnh logo đã có chữ nói đúng tên thương hiệu — nếu không
   * trình đọc màn hình sẽ đọc "POLYMIND" hai lần.
   */
  alt?: string;
  className?: string;
  /** Bo góc của tile — chỉ có tác dụng với `variant="plate"`. */
  radius?: string;
  priority?: boolean;
};

export function Logo({
  height = 32,
  variant = "bare",
  alt = "POLYMIND",
  className,
  radius = "rounded-xl",
  priority = false,
}: LogoProps) {
  const width = Math.round(height * LOGO_ASPECT);
  const plated = variant === "plate";

  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center justify-center",
        plated && ["bg-white shadow-sm ring-1 ring-black/5", radius],
        className,
      )}
      style={plated ? { padding: Math.round(height * PLATE_PADDING_RATIO) } : undefined}
    >
      <Image
        src="/polymind-lockup.png"
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        style={{ width, height }}
      />
    </span>
  );
}
