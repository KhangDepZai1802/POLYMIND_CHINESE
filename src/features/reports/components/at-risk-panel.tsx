import Link from "next/link";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPercent, formatScore } from "@/lib/dates";

import type { AtRiskStudent } from "../server/learning-queries";

/**
 * Danh sách "Học viên cần chú ý" (AC1.4) — dùng chung cho tầng trung tâm
 * (hiện kèm lớp) và tầng lớp (kèm nút hành động của giáo viên).
 *
 * Ngưỡng do view `v_at_risk_assessment_students` quyết theo cấu hình từng khóa
 * học (D5) — component chỉ HIỂN THỊ, không tự đặt lại ngưỡng nào.
 *
 * Không có em nào → khối vẫn đứng đó với trạng thái tích cực, không biến mất:
 * "danh sách rỗng" là thông tin đáng giá đúng bằng "danh sách có 8 em".
 */
export function AtRiskPanel({
  students,
  studentHref,
  action,
  showClass = false,
}: {
  students: AtRiskStudent[];
  studentHref?: (student: AtRiskStudent) => string;
  action?: (student: AtRiskStudent) => { href: string; label: string } | null;
  showClass?: boolean;
}) {
  if (students.length === 0) {
    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle asChild className="text-base">
            <h2 className="flex items-center gap-2">
              <CheckCircle2 className="text-success size-4 shrink-0" aria-hidden />
              Học viên cần chú ý (0)
            </h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Không có học viên nào dưới ngưỡng của khóa học — chuyên cần, điểm số
            và bài tập đều đang trong vùng an toàn.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-warning/40 bg-warning/5 mt-4">
      <CardHeader>
        <CardTitle asChild className="text-base">
          <h2 className="flex items-center gap-2">
            <AlertTriangle className="text-warning size-4 shrink-0" aria-hidden />
            Học viên cần chú ý ({students.length})
          </h2>
        </CardTitle>
        <p className="text-muted-foreground mt-1 text-sm">
          Xếp nặng lên trước. Ngưỡng cảnh báo lấy theo cấu hình của từng khóa
          học, trùng khớp với báo cáo phía giáo viên.
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {students.map((student) => {
            const href = studentHref?.(student);
            const studentAction = action?.(student) ?? null;
            return (
              <li
                key={student.enrollment_id}
                className="flex flex-wrap items-center gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  {href ? (
                    <Link
                      href={href}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {student.full_name}
                    </Link>
                  ) : (
                    <p className="truncate text-sm font-medium">
                      {student.full_name}
                    </p>
                  )}
                  {/* Số liệu để RA QUYẾT ĐỊNH can thiệp, không phải chú thích
                      trang trí — giữ 14px như trang giáo viên đã chốt. */}
                  <p className="text-muted-foreground text-sm tabular-nums">
                    {student.student_code}
                    {showClass && student.class_name
                      ? ` · ${student.class_name}`
                      : ""}
                    {" · Tỉ lệ chuyên cần "}
                    {formatPercent(student.attendance_rate)}
                    {student.avg_score !== null
                      ? ` · Điểm TB ${formatScore(student.avg_score)}`
                      : ""}
                    {student.missing_exercises
                      ? ` · Thiếu ${student.missing_exercises} bài`
                      : ""}
                  </p>
                  {student.risk_reasons.length > 0 && (
                    <p className="text-warning mt-1 text-sm">
                      {student.risk_reasons.join(" · ")}
                    </p>
                  )}
                </div>
                {studentAction && (
                  <Button asChild size="sm" variant="outline" data-noprint>
                    <Link
                      href={studentAction.href}
                      aria-label={`${studentAction.label} ${student.full_name}`}
                    >
                      {studentAction.label}
                    </Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
