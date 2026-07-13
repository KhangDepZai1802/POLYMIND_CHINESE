import Image from "next/image";

import { cn } from "@/lib/utils";

type LogoProps = {
  size?: number;
  className?: string;
  /** Bo góc — mặc định `rounded-xl`. Truyền `rounded-full` nếu muốn tròn. */
  radius?: string;
  priority?: boolean;
};

/**
 * Logo PolyMind.
 *
 * File gốc là ảnh vuông nền trắng, nên component tự bọc trong một tile trắng bo
 * góc — như vậy đặt lên nền tối (gradient trang đăng nhập) vẫn ra hình khối gọn
 * gàng thay vì một mảng trắng lởm chởm.
 */
export function Logo({
  size = 40,
  className,
  radius = "rounded-xl",
  priority = false,
}: LogoProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden bg-white shadow-sm ring-1 ring-black/5",
        radius,
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/polymind-logo.png"
        alt="PolyMind"
        width={size}
        height={size}
        priority={priority}
        className="size-full object-contain p-[6%]"
      />
    </span>
  );
}
