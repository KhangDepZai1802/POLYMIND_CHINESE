import { cn } from "@/lib/utils";

/**
 * Footer bản quyền — xuất hiện dưới MỌI trang (auth + dashboard).
 *
 * Năm lấy động để không phải sửa tay mỗi đầu năm.
 */
export function SiteFooter({
  className,
  variant = "default",
}: {
  className?: string;
  /** `onDark` dùng cho trang auth (nền gradient xanh đậm). */
  variant?: "default" | "onDark";
}) {
  const year = new Date().getFullYear();

  return (
    <footer
      className={cn(
        "px-4 py-6 text-center text-xs leading-relaxed",
        variant === "onDark" ? "text-white/70" : "text-muted-foreground",
        className,
      )}
    >
      <p>© {year} Bản quyền thuộc về POLYMIND</p>
      <p
        className={cn(
          "mt-0.5 font-medium",
          variant === "onDark" ? "text-white/80" : "text-foreground/70",
        )}
      >
        POLYMIND — Đồng Hành Cùng Bạn Vươn Xa
      </p>
    </footer>
  );
}
