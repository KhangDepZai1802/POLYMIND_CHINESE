import { Badge } from "@/components/ui/badge";
import type { BadgeTone } from "@/lib/domain/labels";
import { cn } from "@/lib/utils";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  success: "bg-success/12 text-success border-success/25",
  warning: "bg-warning/12 text-warning border-warning/25",
  danger: "bg-destructive/12 text-destructive border-destructive/25",
  info: "bg-primary/10 text-primary border-primary/25",
};

/**
 * Badge trạng thái.
 *
 * Màu chỉ là phụ trợ — nhãn CHỮ luôn có mặt. Người mù màu (khoảng 8% nam giới)
 * vẫn phải đọc được trạng thái mà không cần phân biệt xanh/đỏ.
 */
export function StatusBadge({
  label,
  tone = "neutral",
  className,
}: {
  label: string;
  tone?: BadgeTone;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", TONE_CLASS[tone], className)}
    >
      {label}
    </Badge>
  );
}
