"use client";

import { useActionState, useMemo, useState } from "react";
import { Banknote, BookOpenCheck, PiggyBank, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { B2C_PROGRAMS } from "@/features/b2c/domain/programs";
import { saveB2CMonthlyReportAction } from "@/features/b2c/server/actions";
import type { ActionState } from "@/lib/action-state";
import { monthlyTotalCost } from "@/features/b2c/domain/finance";

export type MonthlyReport = {
  id: string;
  report_year: number;
  report_month: number;
  revenue: number;
  electricity_cost: number;
  water_cost: number;
  internet_cost: number;
  payroll_cost: number;
  teacher_payroll_cost: number | null;
  office_payroll_cost: number | null;
  rent_cost: number;
  marketing_cost: number;
  advertising_cost: number;
  other_cost: number;
  notes: string | null;
  updated_at: string;
  metrics: Array<{
    report_id: string;
    program_slug: string;
    opening_students: number;
    new_students: number;
    departed_students: number;
    lessons_taught: number;
    lessons_paid: number;
  }>;
};

const INITIAL_STATE: ActionState = {};
const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

const COSTS = [
  ["electricity", "Điện", "electricity_cost"],
  ["water", "Nước", "water_cost"],
  ["internet", "Internet", "internet_cost"],
  ["teacher_payroll", "Lương giáo viên", "teacher_payroll_cost"],
  ["office_payroll", "Lương NV văn phòng", "office_payroll_cost"],
  ["rent", "Mặt bằng", "rent_cost"],
  ["marketing", "Marketing", "marketing_cost"],
  ["advertising", "Quảng cáo", "advertising_cost"],
  ["other", "Chi phí khác", "other_cost"],
] as const;

export function B2CMonthlyReportDashboard({
  reports,
  initialPeriod,
}: {
  reports: MonthlyReport[];
  initialPeriod?: { month: number; year: number };
}) {
  const [selectedId, setSelectedId] = useState(reports[0]?.id ?? "new");
  const report = reports.find((item) => item.id === selectedId) ?? null;
  const [state, formAction, pending] = useActionState(
    saveB2CMonthlyReportAction,
    INITIAL_STATE,
  );
  // Use the server snapshot; never read the browser clock during hydration.
  const period = initialPeriod ?? {
    month: reports[0]?.report_month,
    year: reports[0]?.report_year,
  };

  const summary = useMemo(() => summarize(report), [report]);
  const previous = report
    ? reports.find(
        (item) =>
          item.report_year * 12 + item.report_month ===
          report.report_year * 12 + report.report_month - 1,
      )
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <label className="grid gap-1.5 text-sm font-medium">
          Kỳ báo cáo
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="border-input bg-background h-10 min-w-56 rounded-md border px-3"
          >
            {reports.map((item) => (
              <option key={item.id} value={item.id}>
                Tháng {item.report_month}/{item.report_year}
              </option>
            ))}
            <option value="new">Tạo báo cáo tháng mới</option>
          </select>
        </label>
        {report && (
          <p className="text-muted-foreground text-sm">
            Cập nhật {new Date(report.updated_at).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
          </p>
        )}
      </div>

      {report ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Học viên cuối tháng"
              value={summary.students.toLocaleString("vi-VN")}
              note={`${signed(summary.netStudents)} học viên ròng`}
              icon={Users}
            />
            <StatCard
              label="Số tiết đã học"
              value={summary.lessonsTaught.toLocaleString("vi-VN")}
              note={`${summary.lessonsRemaining.toLocaleString("vi-VN")} tiết còn lại`}
              icon={BookOpenCheck}
            />
            <StatCard
              label="Doanh thu"
              value={money.format(report.revenue)}
              note={trend(report.revenue, previous?.revenue)}
              icon={Banknote}
            />
            <StatCard
              label="Lợi nhuận tạm tính"
              value={money.format(summary.profit)}
              note={`Chi phí ${money.format(summary.totalCost)}`}
              icon={PiggyBank}
              danger={summary.profit < 0}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <ProgramTable report={report} />
            <CostTable report={report} total={summary.totalCost} />
          </div>
          {report.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ghi chú</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">
                {report.notes}
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            Chọn tháng và nhập số liệu ở biểu mẫu bên dưới.
          </CardContent>
        </Card>
      )}

      <details className="group rounded-xl border bg-white" open={!report}>
        <summary className="cursor-pointer list-none px-5 py-4 font-semibold">
          {report ? "Chỉnh sửa số liệu tháng này" : "Nhập báo cáo tháng mới"}
        </summary>
        <form
          key={report?.id ?? "new"}
          action={formAction}
          className="space-y-6 border-t p-5"
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              name="report_month"
              label="Tháng"
              min={1}
              max={12}
              defaultValue={report?.report_month ?? period.month}
            />
            <NumberField
              name="report_year"
              label="Năm"
              min={2000}
              max={2100}
              defaultValue={report?.report_year ?? period.year}
            />
            <NumberField
              name="revenue"
              label="Doanh thu (VNĐ)"
              defaultValue={report?.revenue ?? 0}
            />
          </div>

          <section>
            <h2 className="mb-3 font-semibold">
              Học viên và số tiết theo chương trình
            </h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[60rem] text-sm">
                <thead className="bg-muted/60 text-left">
                  <tr>
                    <th className="px-3 py-2.5">Chương trình</th>
                    <th className="px-3 py-2.5">HV đầu tháng</th>
                    <th className="px-3 py-2.5">HV mới</th>
                    <th className="px-3 py-2.5">HV giảm</th>
                    <th className="px-3 py-2.5">Tiết đã học</th>
                    <th className="px-3 py-2.5">Tiết đã đóng tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {B2C_PROGRAMS.map((program) => {
                    const metric = report?.metrics.find(
                      (item) => item.program_slug === program.slug,
                    );
                    return (
                      <tr key={program.slug} className="border-t">
                        <th className="px-3 py-2 text-left font-medium">
                          {program.title}
                        </th>
                        {[
                          "opening_students",
                          "new_students",
                          "departed_students",
                          "lessons_taught",
                          "lessons_paid",
                        ].map((field) => (
                          <td key={field} className="px-2 py-2">
                            <Input
                              type="number"
                              min={0}
                              name={`${program.slug}_${field}`}
                              defaultValue={
                                metric?.[field as keyof typeof metric] ?? 0
                              }
                              className="min-w-28"
                              required
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="mb-3 font-semibold">Chi phí</h2>
            {report && report.teacher_payroll_cost === null && (
              <p className="mb-3 text-sm text-amber-700">
                Tổng lương cũ: {money.format(report.payroll_cost)}, chưa phân
                loại. Nhập rõ lương GV và NV văn phòng trước khi lưu; hệ thống
                không tự chia số tiền cũ.
              </p>
            )}
            <p className="text-muted-foreground mb-3 text-xs">
              Marketing bắt buộc nhập, có thể nhập 0 nếu tháng này không phát
              sinh. Lương GV và NV văn phòng được cộng đúng một lần vào tổng chi
              phí.
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {COSTS.map(([name, label, key]) => (
                <NumberField
                  key={name}
                  name={name}
                  label={`${label} (VNĐ)`}
                  defaultValue={
                    report
                      ? (report[key] ?? undefined)
                      : name === "marketing"
                        ? undefined
                        : 0
                  }
                />
              ))}
            </div>
          </section>

          <label className="grid gap-1.5 text-sm font-medium">
            Ghi chú
            <textarea
              name="notes"
              defaultValue={report?.notes ?? ""}
              className="border-input bg-background min-h-24 rounded-md border px-3 py-2 font-normal"
            />
          </label>

          {state.error && (
            <p className="text-destructive text-sm">{state.error}</p>
          )}
          {state.success && (
            <p className="text-sm text-emerald-700">{state.success}</p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu báo cáo"}
          </Button>
        </form>
      </details>
    </div>
  );
}

function summarize(report: MonthlyReport | null) {
  const metrics = report?.metrics ?? [];
  const totalCost = report ? monthlyTotalCost(report) : 0;
  return {
    students: metrics.reduce(
      (sum, item) =>
        sum +
        item.opening_students +
        item.new_students -
        item.departed_students,
      0,
    ),
    netStudents: metrics.reduce(
      (sum, item) => sum + item.new_students - item.departed_students,
      0,
    ),
    lessonsTaught: metrics.reduce((sum, item) => sum + item.lessons_taught, 0),
    lessonsRemaining: metrics.reduce(
      (sum, item) => sum + item.lessons_paid - item.lessons_taught,
      0,
    ),
    totalCost,
    profit: (report?.revenue ?? 0) - totalCost,
  };
}

function ProgramTable({ report }: { report: MonthlyReport }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Học viên và số tiết</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[42rem] text-sm">
          <thead className="text-muted-foreground text-left">
            <tr>
              <th className="pb-2">Chương trình</th>
              <th>Cuối tháng</th>
              <th>Tăng</th>
              <th>Giảm</th>
              <th>Đã học</th>
              <th>Còn lại</th>
            </tr>
          </thead>
          <tbody>
            {B2C_PROGRAMS.map((program) => {
              const item = report.metrics.find(
                (metric) => metric.program_slug === program.slug,
              );
              if (!item) return null;
              return (
                <tr key={program.slug} className="border-t">
                  <th className="py-3 text-left font-medium">
                    {program.title}
                  </th>
                  <td>
                    {item.opening_students +
                      item.new_students -
                      item.departed_students}
                  </td>
                  <td>{item.new_students}</td>
                  <td>{item.departed_students}</td>
                  <td>{item.lessons_taught}</td>
                  <td>{item.lessons_paid - item.lessons_taught}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function CostTable({
  report,
  total,
}: {
  report: MonthlyReport;
  total: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cơ cấu chi phí</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-2 text-sm">
          {COSTS.map(([, label, key]) => (
            <div key={key} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium tabular-nums">
                {report[key] === null
                  ? "Chưa phân loại"
                  : money.format(report[key])}
              </dd>
            </div>
          ))}
          {report.teacher_payroll_cost === null && (
            <div className="flex justify-between gap-4 text-amber-700">
              <dt>Lương gộp chưa phân loại (dữ liệu cũ)</dt>
              <dd>{money.format(report.payroll_cost)}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4 border-t pt-3 font-semibold">
            <dt>Tổng chi phí</dt>
            <dd>{money.format(total)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min = 0,
  max,
}: {
  name: string;
  label: string;
  defaultValue?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        min={min}
        max={max}
        defaultValue={defaultValue}
        required
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  note,
  icon: Icon,
  danger = false,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Users;
  danger?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-3">
        <div>
          <p className="text-muted-foreground text-sm">{label}</p>
          <p
            className={`mt-2 text-2xl font-bold ${danger ? "text-destructive" : ""}`}
          >
            {value}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{note}</p>
        </div>
        <span className="bg-primary/10 text-primary rounded-lg p-2">
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function trend(current: number, previous?: number) {
  if (!previous) return "Chưa có tháng trước để so sánh";
  const rate = ((current - previous) / previous) * 100;
  return `${rate >= 0 ? "+" : ""}${rate.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}% so với tháng trước`;
}

function signed(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("vi-VN")}`;
}
