"use client";

import Link from "next/link";
import { TeacherAccountDialog } from "@/features/teachers/components/teacher-account-dialog";
import { useRef, useState } from "react";
import {
  Users,
  BookOpen,
  Clock3,
  ChartColumn,
  FileSpreadsheet,
  FileText,
  CalendarDays,
  Search,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { B2CTeacherDialog } from "@/features/b2c/components/teacher-dialog";
import type { getB2CTeacherMetrics } from "@/features/b2c/server/teacher-metrics";
import type { BikeForceSaleWorkRow } from "@/features/b2c/server/teacher-metrics";
import { formatCurrency } from "@/lib/dates";
import {
  TeacherSummaryDialog,
  type TeacherSummaryKind,
} from "@/features/b2c/components/teacher-summary-dialog";

export type Row =
  Awaited<ReturnType<typeof getB2CTeacherMetrics>> extends Map<string, infer R>
    ? R
    : never;
const colors = ["#48b98a", "#4596ff", "#ffac47", "#8b67d9", "#24b9c3"];
const number = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });
const percent = (value: number | null) =>
  value === null ? "—" : `${number.format(value)}%`;
const panel =
  "rounded-2xl border border-blue-100/60 bg-white p-5 shadow-[0_3px_16px_-8px_rgba(32,72,120,0.2)] dark:border-slate-800 dark:bg-slate-900";
const select =
  "h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300";
const avatarTones = ["bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-200", "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-200", "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200", "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-200", "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-200"];
const specialtyLabel = (value: string | null | undefined) => !value?.trim() || value.trim().toUpperCase() === "B2C" ? "Chưa cập nhật" : value.trim();
const duration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours} giờ ${minutes} phút` : `${minutes} phút`;
};

export function TeacherDashboard({
  rows,
  initialMonth,
  canManageAccounts = false,
  saleWorkRows = [],
}: {
  rows: Row[];
  initialMonth: string;
  canManageAccounts?: boolean;
  saleWorkRows?: BikeForceSaleWorkRow[];
}) {
  const [month, setMonth] = useState(initialMonth);
  const [specialization, setSpecialization] = useState("");
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [detail, setDetail] = useState<TeacherSummaryKind | null>(null);
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  const specialties = [
    ...new Set(
      rows.map((r) => specialtyLabel(r.teacher.specialization)),
    ),
  ].sort((a, b) => a.localeCompare(b, "vi"));
  const base = rows.filter(
    (r) =>
      !specialization ||
      specialtyLabel(r.teacher.specialization) === specialization,
  );
  const scheduled = (r: Row) => r.teachingMonths.includes(month);
  const teaching = base.filter(scheduled).length;
  const waiting = base.length - teaching;
  const totalClasses = base.reduce((sum, r) => sum + (r.classCount ?? 0), 0);
  const distribution = specialties
    .map((name) => ({
      name,
      count: base.filter(
        (r) => specialtyLabel(r.teacher.specialization) === name,
      ).length,
    }))
    .filter((r) => r.count);
  const filtered = base.filter(
    (r) =>
      (!status || (status === "teaching" ? scheduled(r) : !scheduled(r))) &&
      `${r.teacher.full_name} ${r.teacher.phone ?? ""} ${r.teacher.email ?? ""}`
        .toLocaleLowerCase("vi")
        .includes(query.trim().toLocaleLowerCase("vi")),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages - 1);
  const reset = () => setPage(0);
  const headings = [
    "#",
    "Giáo viên",
    "Liên hệ",
    "Chuyên môn",
    "Hình thức",
    "Đơn giá / giờ",
    "Số lớp",
    "Sĩ số TB",
    "Tỷ lệ chuyên cần",
    "Hết hạn rồi đóng tiếp",
    "Đóng từ 2 lần",
    "Chi phí GV / doanh thu lớp",
  ];
  const values = (r: Row, index: number) => [
    index + 1,
    r.teacher.full_name,
    [r.teacher.phone, r.teacher.email].filter(Boolean).join(" · ") || "—",
    specialtyLabel(r.teacher.specialization),
    r.teacher.employment_type === "full_time"
      ? "Fulltime"
      : r.teacher.employment_type === "part_time"
        ? "Part-time"
        : "Chưa cập nhật",
    r.teacher.hourly_rate === null
      ? "Chưa cập nhật"
      : formatCurrency(r.teacher.hourly_rate),
    r.classCount ?? "—",
    r.averageSize === null ? "—" : number.format(r.averageSize),
    "—",
    percent(r.renewalAfterExpiryRate),
    percent(r.repeatPaymentRate),
    percent(r.costRatio),
  ];
  async function exportExcel() {
    setExporting(true);
    setExportError("");
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Giáo viên");
      sheet.addRow([
        `Giáo viên — tình trạng lịch tháng ${month}; chỉ số lũy kế`,
      ]);
      sheet.addRow(headings);
      filtered.forEach((r, i) => sheet.addRow(values(r, i)));
      sheet.getRow(2).font = { bold: true, color: { argb: "FFFFFFFF" } };
      sheet.getRow(2).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF185ABC" },
      };
      sheet.columns.forEach((c, i) => {
        c.width = i === 0 ? 6 : 25;
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `giao-vien-${month}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setExportError("Không xuất được Excel. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  }
  return (
    <div className="-m-4 min-h-full space-y-5 bg-gradient-to-br from-blue-50/80 via-slate-50/60 to-sky-50/70 p-4 text-slate-700 md:-m-6 md:p-6 dark:from-slate-950 dark:to-slate-900 dark:text-slate-200 print:m-0 print:bg-white print:p-0">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#102752] dark:text-white">
            Giáo viên
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý, theo dõi tình trạng giáo viên tại trung tâm.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <Link href="/admin/b2c/timetable" className={`${select} inline-flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200`}><CalendarDays className="size-4" aria-hidden />Xem thời khóa biểu giáo viên</Link>
          <label className={`${select} flex items-center gap-2`}>
            <CalendarDays className="size-4" />
            <input
              aria-label="Tháng theo dõi lịch dạy"
              type="month"
              value={month}
              onChange={(e) => {
                if (e.target.value) setMonth(e.target.value);
                reset();
              }}
              className="bg-transparent"
            />
          </label>
          <select
            aria-label="Lọc chuyên môn"
            className={select}
            value={specialization}
            onChange={(e) => {
              setSpecialization(e.target.value);
              reset();
            }}
          >
            <option value="">Chuyên môn: Tất cả</option>
            {specialties.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <B2CTeacherDialog />
        </div>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            kind: "all" as const,
            label: "Tổng giáo viên",
            value: base.length,
            note: "Hồ sơ trong danh sách",
            icon: Users,
            color: "text-emerald-600 bg-emerald-50",
            wave: "bg-emerald-100/60 dark:bg-emerald-900/25",
          },
          {
            kind: "teaching" as const,
            label: "Có lịch dạy",
            value: teaching,
            note: `${base.length ? number.format((teaching / base.length) * 100) : 0}% giáo viên · tháng ${month.slice(5)}/${month.slice(0, 4)}`,
            icon: BookOpen,
            color: "text-blue-500 bg-blue-50",
            wave: "bg-blue-100/60 dark:bg-blue-900/25",
          },
          {
            kind: "waiting" as const,
            label: "Chưa có lịch dạy",
            value: waiting,
            note: `${base.length ? number.format((waiting / base.length) * 100) : 0}% giáo viên trong tháng`,
            icon: Clock3,
            color: "text-amber-500 bg-amber-50",
            wave: "bg-orange-100/60 dark:bg-orange-900/25",
          },
          {
            kind: "classes" as const,
            label: "Tổng số lớp phụ trách",
            value: totalClasses,
            note: "Lũy kế các lớp đã liên kết",
            icon: ChartColumn,
            color: "text-violet-500 bg-violet-50",
            wave: "bg-violet-100/60 dark:bg-violet-900/25",
          },
        ].map(({ kind, label, value, note, icon: Icon, color, wave }) => (
          <button
            type="button"
            key={label}
            aria-label={`Xem ${label.toLocaleLowerCase("vi")}`}
            aria-haspopup="dialog"
            onClick={(event) => {
              detailTrigger.current = event.currentTarget;
              setDetail(kind);
            }}
            className={`${panel} relative isolate flex gap-5 overflow-hidden py-6 text-left transition hover:border-blue-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500`}
          >
            <span aria-hidden className={`absolute -right-6 -bottom-11 -z-10 h-24 w-48 -rotate-12 rounded-[50%] ${wave}`} />
            <div
              className={`flex size-14 shrink-0 items-center justify-center rounded-xl ${color}`}
            >
              <Icon className="size-7" />
            </div>
            <div>
              <p className="text-sm">{label}</p>
              <p className="mt-1 text-3xl font-bold text-[#102752] dark:text-white">
                {value}
              </p>
              <p className="mt-2 text-xs text-slate-500">{note}</p>
            </div>
          </button>
        ))}
      </div>
      {detail && (
        <TeacherSummaryDialog
          kind={detail}
          rows={base}
          month={month}
          onClose={() => setDetail(null)}
          restoreFocus={() => detailTrigger.current?.focus()}
        />
      )}
      <section className={panel} aria-labelledby="salework-title">
        <div className="mb-4">
          <h2 id="salework-title" className="font-semibold text-[#102752] dark:text-white">SaleWork từ BikeForce</h2>
          <Link href="/admin/b2c/salework" className="mt-2 inline-block text-sm font-medium text-blue-600 underline">Báo cáo</Link>
          <p className="mt-1 text-xs text-slate-500">Snapshot mới nhất của Cô Lê và Cô Thy; đồng bộ lại cùng ngày sẽ thay thế số cũ.</p>
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {(["co-le", "co-thy"] as const).map((person) => {
            const row = saleWorkRows.find((item) => item.person === person);
            const displayName = person === "co-le" ? "Cô Lê" : "Cô Thy";
            return (
            <article key={person} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-[#183764] dark:text-slate-100">{displayName}</h3>
                <span className="text-xs text-slate-500">{row ? `Ngày ${row.workDate.split("-").reverse().join("/")}` : "Chưa đồng bộ"}</span>
              </div>
              {row ? <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
                {[
                  ["Hội thoại", number.format(row.snapshot.conversations)],
                  ["Tin đã gửi", number.format(row.snapshot.sentMessages)],
                  ["Tin đã nhận", number.format(row.snapshot.receivedMessages)],
                  ["Cuộc gọi đến", number.format(row.snapshot.incomingCalls)],
                  ["Cuộc gọi đi", number.format(row.snapshot.outgoingCalls)],
                  ["Cuộc gọi nhỡ", number.format(row.snapshot.missedCalls)],
                  ["Thời lượng gọi", duration(row.snapshot.callDurationSeconds)],
                  ["BikeForce đồng bộ", new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" }).format(new Date(row.snapshot.syncedAt))],
                ].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 font-semibold tabular-nums text-slate-800 dark:text-slate-100">{value}</dd></div>)}
              </dl> : <p className="text-sm text-slate-500">BikeForce chưa gửi snapshot cho giáo viên này.</p>}
            </article>);
          })}
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <section className={panel}>
          <h2 className="font-semibold text-[#102752] dark:text-white">
            Tỷ lệ giáo viên theo lịch dạy
          </h2>
          <div className="flex min-h-52 items-center gap-3">
            <div
              className="relative h-52 min-w-0 flex-1"
              role="img"
              aria-label={`${teaching} giáo viên có lịch dạy, ${waiting} chưa có lịch trong tháng ${month}`}
            >
              {base.length ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Có lịch dạy", value: teaching },
                        { name: "Chưa có lịch", value: waiting },
                      ]}
                      dataKey="value"
                      isAnimationActive={false}
                      innerRadius="60%"
                      outerRadius="85%"
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                    >
                      <Cell fill="#3589ff" />
                      <Cell fill="#ffae2a" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  Chưa có giáo viên
                </div>
              )}
              {base.length > 0 && (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <strong className="text-2xl text-[#102752] dark:text-white">
                    {base.length}
                  </strong>
                  <span className="text-xs">Giáo viên</span>
                </div>
              )}
            </div>
            <div className="space-y-3 text-xs">
              <p>
                <span className="mr-2 inline-block size-2.5 rounded bg-blue-500" />
                Có lịch ({teaching})
              </p>
              <p>
                <span className="mr-2 inline-block size-2.5 rounded bg-amber-400" />
                Chưa có lịch ({waiting})
              </p>
            </div>
          </div>
        </section>
        <section className={panel}>
          <h2 className="mb-3 font-semibold text-[#102752] dark:text-white">
            Phân bố theo chuyên môn
          </h2>
          <div
            className="h-52"
            role="img"
            aria-label={
              distribution.map((d) => `${d.name}: ${d.count}`).join(", ") ||
              "Chưa có dữ liệu"
            }
          >
            {distribution.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={distribution}
                  margin={{ left: -25, right: 8, top: 15, bottom: 15 }}
                >
                  <CartesianGrid
                    strokeDasharray="0"
                    vertical={false}
                    stroke="#e9eff7"
                  />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip cursor={{ fill: "#f1f5f9" }} />
                  <Bar
                    dataKey="count"
                    isAnimationActive={false}
                    name="Giáo viên"
                    maxBarSize={55}
                    radius={[4, 4, 0, 0]}
                    label={{ position: "top", fontSize: 12 }}
                  >
                    {distribution.map((d, i) => (
                      <Cell key={d.name} fill={colors[i % colors.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="pt-16 text-center text-sm text-slate-400">
                Chưa có dữ liệu chuyên môn
              </p>
            )}
          </div>
        </section>
        <section className={`${panel} print:hidden`}>
          <h2 className="mb-4 font-semibold text-[#102752] dark:text-white">
            Tải nhanh
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <button
              onClick={exportExcel}
              disabled={exporting}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:bg-emerald-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span className="rounded-lg bg-emerald-600 p-2 text-white">
                <FileSpreadsheet className="size-5" />
              </span>
              <span>
                <strong className="block text-xs">
                  {exporting ? "Đang xuất…" : "Xuất Excel"}
                </strong>
                <span className="text-[11px] text-slate-500">
                  Danh sách đang lọc
                </span>
              </span>
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-left transition hover:bg-red-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span className="rounded-lg bg-red-500 p-2 text-white">
                <FileText className="size-5" />
              </span>
              <span>
                <strong className="block text-xs">In / Lưu PDF</strong>
                <span className="text-[11px] text-slate-500">
                  Qua hộp thoại in
                </span>
              </span>
            </button>
            <a
              href="#teacher-list"
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span className="rounded-lg bg-blue-500 p-2 text-white">
                <ChartColumn className="size-5" />
              </span>
              <span>
                <strong className="block text-xs">Báo cáo giáo viên</strong>
                <span className="text-[11px] text-slate-500">
                  Chỉ số từng giáo viên
                </span>
              </span>
            </a>
            <Link
              href={`/admin/b2c/teaching?month=${month}`}
              className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-violet-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <span className="rounded-lg bg-violet-500 p-2 text-white">
                <CalendarDays className="size-5" />
              </span>
              <span>
                <strong className="block text-xs">Lịch dạy</strong>
                <span className="text-[11px] text-slate-500">
                  Giờ dạy & Lương
                </span>
              </span>
            </Link>
          </div>
          {exportError && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {exportError}
            </p>
          )}
        </section>
      </div>
      <section id="teacher-list" className={`${panel} scroll-mt-5`}>
        <h2 className="mb-3 font-semibold text-[#102752] dark:text-white">
          Danh sách giáo viên
        </h2>
        <div className="mb-3 flex flex-wrap justify-between gap-3 print:hidden">
          <label className="relative w-full max-w-sm">
            <Search className="absolute top-2.5 left-3 size-4 text-blue-600 dark:text-blue-400" />
            <input
              aria-label="Tìm giáo viên"
              placeholder="Tìm giáo viên…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                reset();
              }}
              className={`${select} w-full pl-9`}
            />
          </label>
          <select
            aria-label="Lọc tình trạng lịch dạy"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              reset();
            }}
            className={`${select} min-w-48`}
          >
            <option value="">Tất cả tình trạng</option>
            <option value="teaching">Có lịch dạy trong tháng</option>
            <option value="waiting">Chưa có lịch trong tháng</option>
          </select>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-100 dark:border-slate-800 print:overflow-visible">
          <table className="w-full min-w-[1150px] text-left text-[11px] print:min-w-0">
            <caption className="sr-only">
              Giáo viên và các chỉ số lũy kế
            </caption>
            <thead className="bg-[#edf3fb] text-[#4c638a] dark:bg-slate-800 dark:text-slate-300">
              <tr>
                {headings.map((h) => (
                  <th key={h} className="px-2 py-2.5 font-semibold">
                    {h}
                  </th>
                ))}
                <th className="px-2 py-2.5 print:hidden">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.teacher.id}
                  className={`${i < currentPage * 20 || i >= (currentPage + 1) * 20 ? "hidden print:table-row" : ""} border-t border-slate-100 odd:bg-slate-50/40 hover:bg-blue-50/60 dark:border-slate-800 dark:odd:bg-slate-800/20`}
                >
                  {values(r, i).map((v, j) => (
                    <td
                      key={j}
                      className={`px-2 py-1.5 ${j === 1 ? "font-medium whitespace-nowrap text-[#183764] dark:text-slate-100" : ""}`}
                    >
                      {j === 1 ? <span className="inline-flex items-center gap-2"><span aria-hidden className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${avatarTones[Array.from(r.teacher.id).reduce((n, c) => n + c.charCodeAt(0), 0) % avatarTones.length]}`}>{r.teacher.full_name.trim().split(/\s+/).slice(-2).map(w => w[0]).join("").toUpperCase()}</span><span>{v}</span></span> : v}
                    </td>
                  ))}
                  <td className="px-2 print:hidden">
                    <div className="flex items-center gap-1 whitespace-nowrap">
                    <B2CTeacherDialog teacher={r.teacher} />
                    {canManageAccounts && (
                      <TeacherAccountDialog
                        target={{ kind: "b2c", id: r.teacher.id }}
                      />
                    )}
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr>
                  <td
                    colSpan={13}
                    className="py-12 text-center text-sm text-slate-400"
                  >
                    Không có giáo viên phù hợp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500 print:hidden">
          <span>
            Hiển thị {filtered.length ? currentPage * 20 + 1 : 0}–
            {Math.min((currentPage + 1) * 20, filtered.length)} của{" "}
            {filtered.length} giáo viên
          </span>
          <div className="flex items-center gap-2">
            <button
              aria-label="Trang trước"
              disabled={currentPage === 0}
              onClick={() => setPage(currentPage - 1)}
              className="rounded-md border p-2 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-blue-600">
              {currentPage + 1}
            </span>
            <button
              aria-label="Trang sau"
              disabled={currentPage + 1 >= pages}
              onClick={() => setPage(currentPage + 1)}
              className="rounded-md border p-2 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
        <details className="mt-4 text-xs leading-relaxed text-slate-500">
          <summary className="cursor-pointer">
            Cách tính chỉ số và dữ liệu chưa cập nhật
          </summary>
          <p className="mt-2">
            Tháng chỉ lọc tình trạng có lịch dạy. Số lớp, sĩ số và tỷ lệ trong
            bảng là lũy kế. Sĩ số TB theo ghi danh từng lớp, dùng sĩ số đã nhập
            khi chưa có ghi danh. Chi phí GV / doanh thu = tiền công đủ chấm
            công / học phí thực thu các lớp phụ trách. Hết hạn rồi đóng tiếp đối
            chiếu hạn hiện tại, chưa có lịch sử đổi hạn. Đóng từ 2 lần bao gồm
            đóng nhiều đợt. Chuyên cần chưa có điểm danh học viên; mẫu số
            rỗng và dữ liệu thiếu hiển thị —. Lớp được đối chiếu tên giáo viên
            duy nhất, hồ sơ trùng tên không tự gán chỉ số.
          </p>
        </details>
      </section>
    </div>
  );
}
