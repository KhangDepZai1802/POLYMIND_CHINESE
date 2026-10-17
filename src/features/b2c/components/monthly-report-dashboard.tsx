"use client";

import { useActionState, useMemo, useState } from "react";
import { Banknote, BookOpenCheck, ChartColumn, Users, CalendarDays, ChevronRight, Pencil, Settings, Zap, Droplet, Wifi, User, House, Megaphone, Target, Ellipsis, Database, Calculator, ArrowUpDown } from "lucide-react";

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
const COST_ICONS = [Zap, Droplet, Wifi, User, Users, House, Megaphone, Target, Ellipsis];
const programTones: Record<string, { initials: string; color: string }> = {
  "tieng-anh": { initials: "TA", color: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200" },
  "tieng-trung": { initials: "TT", color: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-200" },
  "tieng-viet": { initials: "TV", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200" },
  "lop-ve": { initials: "VẼ", color: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200" },
  "kem-1-1": { initials: "1–1", color: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200" },
};

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
        <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">
          Kỳ báo cáo
          <span className="flex items-center gap-2 rounded-xl border border-blue-100 bg-card px-3 dark:border-border"><CalendarDays className="size-4 text-blue-600" aria-hidden />
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="h-11 min-w-44 bg-transparent pr-3 text-sm font-normal"
          >
            {reports.map((item) => (
              <option key={item.id} value={item.id}>
                Tháng {item.report_month}/{item.report_year}
              </option>
            ))}
            <option value="new">Tạo báo cáo tháng mới</option>
          </select>
          </span>
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
              tone="green"
            />
            <StatCard
              label="Số tiết đã học"
              value={summary.lessonsTaught.toLocaleString("vi-VN")}
              note={`${summary.lessonsRemaining.toLocaleString("vi-VN")} tiết còn lại`}
              icon={BookOpenCheck}
              tone="blue"
            />
            <StatCard
              label="Doanh thu"
              value={money.format(report.revenue)}
              note={trend(report.revenue, previous?.revenue)}
              icon={Banknote}
              tone="orange"
            />
            <StatCard
              label="Lợi nhuận tạm tính"
              value={money.format(summary.profit)}
              note={`Chi phí ${money.format(summary.totalCost)}`}
              icon={ChartColumn}
              tone="rose"
              danger={summary.profit < 0}
            />
          </div>

          <div className="grid items-stretch gap-4 xl:grid-cols-[1.28fr_1fr]">
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

      <details className="group rounded-2xl border border-blue-100 bg-card shadow-sm dark:border-border" open={!report}>
        <summary className="flex cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-4 font-semibold focus-visible:ring-2 focus-visible:ring-ring">
          <span className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><Pencil className="size-5" aria-hidden /></span><span>{report ? "Chỉnh sửa số liệu tháng này" : "Nhập báo cáo tháng mới"}</span><ChevronRight className="ml-auto size-5 transition-transform group-open:rotate-90" aria-hidden />
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
  const [sort, setSort] = useState<number | null>(null), [descending, setDescending] = useState(false);
  const programs = B2C_PROGRAMS.flatMap(program => {
    const item = report.metrics.find(m => m.program_slug === program.slug);
    return item ? [{ program, values: [program.title, item.opening_students + item.new_students - item.departed_students, item.new_students, item.departed_students, item.lessons_taught, item.lessons_paid - item.lessons_taught] }] : [];
  }).sort((a, b) => {
    if (sort === null) return 0;
    return (descending ? -1 : 1) * (sort === 0 ? a.program.title.localeCompare(b.program.title, "vi") : Number(a.values[sort]) - Number(b.values[sort]));
  });
  return (
    <Card className="gap-4 rounded-2xl border-blue-100 py-5 shadow-sm dark:border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg"><span className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><Users className="size-5" aria-hidden /></span>Học viên và số tiết</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <div className="min-w-[35rem] overflow-hidden rounded-xl border border-blue-50 dark:border-border"><table className="w-full text-sm"><caption className="sr-only">Học viên và số tiết theo chương trình</caption>
          <thead className="bg-blue-50/70 text-left dark:bg-blue-950/30">
            <tr>
              {["Chương trình", "Cuối tháng", "Tăng", "Giảm", "Đã học", "Còn lại"].map((label, index) => <th key={label} scope="col" aria-sort={sort === index ? descending ? "descending" : "ascending" : "none"} className={`px-3 py-3 font-semibold ${index === 2 ? "text-emerald-600 dark:text-emerald-300" : index === 3 ? "text-rose-600 dark:text-rose-300" : index === 4 ? "text-blue-600 dark:text-blue-300" : index === 5 ? "text-violet-600 dark:text-violet-300" : ""}`}><button type="button" className="inline-flex items-center gap-1 whitespace-nowrap rounded focus-visible:ring-2 focus-visible:ring-ring" onClick={() => { if (sort === index) setDescending(!descending); else { setSort(index); setDescending(false); } }}>{label}<ArrowUpDown className="size-3" aria-hidden /></button></th>)}
            </tr>
          </thead>
          <tbody>
            {programs.map(({ program, values }) => {
              const badge = programTones[program.slug];
              return (
                <tr key={program.slug} className="border-t border-blue-50 hover:bg-blue-50/20 dark:border-border dark:hover:bg-blue-950/10">
                  <th scope="row" className="px-3 py-3 text-left font-medium">
                    <span className="inline-flex items-center gap-3"><span aria-hidden className={`flex size-10 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badge?.color ?? "bg-slate-100 text-slate-700"}`}>{badge?.initials ?? "CT"}</span>{program.title}</span>
                  </th>
                  {values.slice(1).map((value, index) => <td key={index} className="px-3 py-3 text-center tabular-nums">{value}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table></div>
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
    <Card className="gap-4 rounded-2xl border-blue-100 py-5 shadow-sm dark:border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg"><span className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950 dark:text-blue-300"><Settings className="size-5" aria-hidden /></span>Cơ cấu chi phí</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="text-sm">
          {COSTS.map(([, label, key], index) => {
            const Icon = COST_ICONS[index] ?? Ellipsis;
            return <div key={key} className="flex justify-between gap-4 border-b border-blue-50 py-2 dark:border-border">
              <dt className="flex items-center gap-3 text-muted-foreground"><Icon className="size-4 shrink-0" aria-hidden />{label}</dt>
              <dd className="font-medium tabular-nums">
                {report[key] === null
                  ? "Chưa phân loại"
                  : money.format(report[key])}
              </dd>
            </div>;
          })}
          {report.teacher_payroll_cost === null && (
            <div className="flex justify-between gap-4 py-2 text-orange-600 dark:text-orange-300">
              <dt className="flex items-center gap-3"><Database className="size-4 shrink-0" aria-hidden />Lương gộp chưa phân loại (dữ liệu cũ)</dt>
              <dd>{money.format(report.payroll_cost)}</dd>
            </div>
          )}
          <div className="mt-1 flex justify-between gap-4 rounded-xl bg-blue-50 px-3 py-3 font-semibold dark:bg-blue-950/30">
            <dt className="flex items-center gap-3"><Calculator className="size-5 text-blue-600 dark:text-blue-300" aria-hidden />Tổng chi phí</dt>
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
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Users;
  danger?: boolean;
  tone: "green" | "blue" | "orange" | "rose";
}) {
  const surface = { green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300", blue: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300", orange: "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-300", rose: "bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-300" }[tone];
  const wave = { green: "text-emerald-200 dark:text-emerald-900", blue: "text-blue-200 dark:text-blue-900", orange: "text-orange-200 dark:text-orange-900", rose: "text-rose-200 dark:text-rose-900" }[tone];
  return (
    <Card className="relative isolate overflow-hidden rounded-2xl border-blue-100 py-5 shadow-sm dark:border-border">
      <svg aria-hidden focusable="false" viewBox="0 0 160 80" className={`pointer-events-none absolute right-0 bottom-0 -z-10 h-20 w-36 opacity-50 ${wave}`}><path fill="currentColor" d="M0 80 Q30 25 58 42 T105 28 T160 20 V80Z" /></svg>
      <CardContent className="flex items-start gap-4 px-5">
        <span className={`shrink-0 rounded-2xl p-3.5 ${surface}`}><Icon className="size-7" aria-hidden /></span>
        <div className="min-w-0">
          <p className="text-muted-foreground text-sm">{label}</p>
          <p
            className={`mt-2 text-2xl font-bold tabular-nums ${danger ? "text-red-600 dark:text-red-400" : ""}`}
          >
            {value}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">{note}</p>
        </div>
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
