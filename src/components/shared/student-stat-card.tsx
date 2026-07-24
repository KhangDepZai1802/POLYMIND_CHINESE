import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Ô số liệu của lưới bento khu vực Học viên (`Learning Journey Bento`, `D-28`).
 *
 * Gom từ ba bản sao gần y hệt nhau ở `/student`, `/student/results` và
 * `student-tuition-overview.tsx` (`P15-T9`). Ba bản đó đã trôi khác nhau ở
 * những chỗ nhỏ mà người dùng nhìn thấy: một bản có `tabular-nums` còn hai bản
 * kia không, nên cùng một cỡ chữ mà cột số ở Học phí thẳng hàng còn ở Kết quả
 * thì không. Bản dùng chung này lấy hợp của cả ba — `tabular-nums` cho mọi ô,
 * `hint` tuỳ chọn — nên không màn nào mất tính năng.
 *
 * ⚠️ Chỉ trình bày. Không tự tính toán, không định dạng số/tiền/ngày — nơi gọi
 * truyền vào chuỗi đã định dạng sẵn theo đúng quy ước của màn đó.
 */
export type StudentStatTone = "sky" | "cyan" | "amber" | "coral";

const STUDENT_STAT_TONES: Record<
  StudentStatTone,
  { card: string; icon: string }
> = {
  sky: {
    card: "border-student-sky-border bg-student-sky-surface",
    icon: "bg-student-sky-ink text-primary-foreground",
  },
  cyan: {
    card: "border-student-cyan-border bg-student-cyan-surface",
    icon: "bg-student-cyan-ink text-primary-foreground",
  },
  amber: {
    card: "border-student-amber-border bg-student-amber-surface",
    icon: "bg-student-amber-ink text-primary-foreground",
  },
  coral: {
    card: "border-student-coral-border bg-student-coral-surface",
    icon: "bg-student-coral-ink text-primary-foreground",
  },
};

export function StudentStatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  /** Bỏ trống khi con số đã tự nói hết — không ép mọi ô phải có dòng phụ. */
  hint?: string;
  tone: StudentStatTone;
  className?: string;
}) {
  const toneClass = STUDENT_STAT_TONES[tone];

  return (
    <Card className={`${toneClass.card} gap-4 py-5 shadow-none ${className}`}>
      <CardContent className="flex items-start gap-3 px-5">
        <span
          className={`${toneClass.icon} flex size-10 shrink-0 items-center justify-center rounded-xl`}
        >
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-text-secondary text-sm font-medium">{label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums break-words">
            {value}
          </p>
          {hint && (
            <p className="text-text-secondary mt-1 text-sm leading-5">{hint}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
