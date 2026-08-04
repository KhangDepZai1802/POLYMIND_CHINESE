import { formatDate } from "@/lib/dates";

/**
 * Khối tiêu đề CHỈ hiện trên bản in (AC4.1): tên báo cáo + kỳ + ngày xuất —
 * người nhận bản PDF không có URL để biết đang xem kỳ nào.
 * Màn hình không thấy khối này (`[data-printonly]` trong globals.css).
 */
export function ReportPrintHeader({
  title,
  periodLabel,
  scopeLabel,
}: {
  title: string;
  periodLabel: string;
  /** Ví dụ "LOP-02 — Tiếng Trung sơ cấp 2" ở bản in tầng lớp. */
  scopeLabel?: string;
}) {
  return (
    <div data-printonly className="mb-4 border-b pb-3">
      <p className="text-lg font-bold">POLYMIND CHINESE — {title}</p>
      {scopeLabel && <p className="text-sm">{scopeLabel}</p>}
      <p className="text-sm">
        Kỳ báo cáo: {periodLabel} · Xuất ngày {formatDate(new Date())}
      </p>
    </div>
  );
}
