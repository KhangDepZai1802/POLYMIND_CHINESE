"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import {
  Users,
  GraduationCap,
  Clock3,
  BookOpen,
  FileSpreadsheet,
  Bell,
  ChartColumn,
  UserPlus,
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
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  B2C_STUDENT_STATUSES,
  B2C_STUDENT_STATUS_LABELS,
} from "@/features/b2c/domain/student-status";
import {
  B2C_CUSTOMER_SOURCES,
  B2C_CUSTOMER_SOURCE_LABELS,
} from "@/features/b2c/domain/customer-source";
import {
  studentDashboardRows,
  summarizeStudentStatus,
  tuitionExpiring,
  STATUS_PRIORITY,
  type StudentDashboardData,
} from "@/features/b2c/domain/student-dashboard";
import {
  StudentDashboardTable,
  studentDate,
} from "@/features/b2c/components/student-dashboard-table";

const panel =
  "rounded-xl border border-slate-100 bg-white p-4 shadow-[0_3px_16px_-8px_rgba(32,72,120,0.2)] dark:border-slate-800 dark:bg-slate-900";
const control = "border-input bg-background h-9 rounded-md border px-3 text-xs";
const palette = [
  "#43bf99",
  "#f87584",
  "#60a5fa",
  "#fbbf24",
  "#94a3b8",
  "#a78bfa",
  "#cbd5e1",
];
type Group = "all" | "studying" | "expiring" | "classes";
const groupTitles = {
  all: "Tổng học viên",
  studying: "Học viên đang học",
  expiring: "Học viên sắp hết học phí",
  classes: "Lớp đang hoạt động",
};

export function StudentDashboard({ data }: { data: StudentDashboardData }) {
  const allRows = studentDashboardRows(data);
  const byStudent = new Map(
    data.students.map((s) => [
      s.id,
      allRows.filter((r) => r.student.id === s.id),
    ]),
  );
  const studyingIds = new Set(
    data.enrollments
      .filter((e) => e.status === "studying")
      .map((e) => e.student_id),
  );
  const expiringRows = allRows.filter(
    (r) => r.enrollment && tuitionExpiring(r.enrollment, data.today),
  );
  const expiringIds = new Set(expiringRows.map((r) => r.student.id));
  const activeClasses = data.classes.filter(
    (c) =>
      c.status === "active" &&
      data.enrollments.some(
        (e) => e.class_id === c.id && e.status === "studying",
      ),
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState("");
  const [source, setSource] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(new Set<string>());
  const [year, setYear] = useState("");
  const [group, setGroup] = useState<Group | null>(null);
  const [popupQuery, setPopupQuery] = useState("");
  const [popupPage, setPopupPage] = useState(0);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const reset = () => {
    setPage(0);
    setSelected(new Set());
  };
  const openGroup = (kind: Group, button?: HTMLButtonElement) => {
    trigger.current = button ?? null;
    setPopupQuery("");
    setPopupPage(0);
    setGroup(kind);
  };
  const filtered = allRows.filter(
    (r) =>
      (!status || (r.enrollment?.status ?? "unassigned") === status) &&
      (!classId || r.classInfo?.id === classId) &&
      (!source || (r.student.customer_source ?? "unknown") === source) &&
      (!from ||
        (!!r.enrollment?.enrollment_date &&
          r.enrollment.enrollment_date >= from)) &&
      (!to ||
        (!!r.enrollment?.enrollment_date &&
          r.enrollment.enrollment_date <= to)) &&
      [
        r.student.code,
        r.student.full_name,
        r.student.guardianName,
        r.student.phone,
        r.student.email,
        r.classInfo?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(query.trim().toLocaleLowerCase("vi")),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, (current + 1) * pageSize);
  const statusData = STATUS_PRIORITY.map((value, i) => ({
    name:
      value === "unassigned"
        ? "Chưa ghi danh"
        : B2C_STUDENT_STATUS_LABELS[value],
    value: data.students.filter(
      (s) =>
        summarizeStudentStatus(
          (byStudent.get(s.id) ?? []).flatMap((r) =>
            r.enrollment ? [r.enrollment] : [],
          ),
        ) === value,
    ).length,
    color: palette[i],
  })).filter((s) => s.value);
  const years = [
    ...new Set(
      data.enrollments.flatMap((e) =>
        e.enrollment_date ? [e.enrollment_date.slice(0, 4)] : [],
      ),
    ),
  ]
    .sort()
    .reverse();
  const yearStudents = data.students.filter(
    (s) =>
      !year ||
      (byStudent.get(s.id) ?? []).some((r) =>
        r.enrollment?.enrollment_date?.startsWith(year),
      ),
  );
  const sourceData = [...B2C_CUSTOMER_SOURCES, "unknown"].map((value) => ({
    name:
      value === "unknown" ? "Chưa xác định" : B2C_CUSTOMER_SOURCE_LABELS[value],
    value: yearStudents.filter(
      (s) => (s.customer_source ?? "unknown") === value,
    ).length,
  }));
  const popupStudents = data.students
    .filter((s) =>
      group === "studying"
        ? studyingIds.has(s.id)
        : group === "expiring"
          ? expiringIds.has(s.id)
          : true,
    )
    .map((s) => {
      const rows = byStudent.get(s.id) ?? [];
      return (
        group === "expiring"
          ? expiringRows.find((r) => r.student.id === s.id)
          : group === "studying"
            ? rows.find((r) => r.enrollment?.status === "studying")
            : rows[0]
      )!;
    })
    .filter((r) =>
      [r.student.code, r.student.full_name, r.student.phone, r.classInfo?.name]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("vi")
        .includes(popupQuery.trim().toLocaleLowerCase("vi")),
    );
  const popupClasses = activeClasses.filter((c) =>
    `${c.code} ${c.name}`
      .toLocaleLowerCase("vi")
      .includes(popupQuery.trim().toLocaleLowerCase("vi")),
  );
  const popupCount =
    group === "classes" ? popupClasses.length : popupStudents.length;
  const popupPages = Math.max(1, Math.ceil(popupCount / 20));
  const popupCurrent = Math.min(popupPage, popupPages - 1);
  async function exportExcel() {
    setExporting(true);
    setError("");
    try {
      const { default: ExcelJS } = await import("exceljs");
      const book = new ExcelJS.Workbook();
      const sheet = book.addWorksheet("Học viên B2C");
      sheet.addRow([
        "Mã học viên",
        "Học viên",
        "Trạng thái",
        "Lớp",
        "Phụ huynh",
        "Điện thoại",
        "Ngày nhập học",
        "Hết học phí",
        "Số buổi",
        "Người chốt",
        "Nguồn khách",
      ]);
      const selectedRows = filtered.filter((r) => selected.has(r.id));
      (selectedRows.length ? selectedRows : filtered).forEach((r) =>
        sheet.addRow([
          r.student.code,
          r.student.full_name,
          r.enrollment
            ? B2C_STUDENT_STATUS_LABELS[r.enrollment.status]
            : "Chưa ghi danh",
          r.classInfo?.name,
          r.student.guardianName,
          r.student.phone,
          studentDate(r.enrollment?.enrollment_date ?? null),
          studentDate(r.enrollment?.tuition_end_date ?? null),
          r.enrollment?.registered_sessions,
          r.enrollment?.salesperson,
          r.student.customer_source
            ? B2C_CUSTOMER_SOURCE_LABELS[r.student.customer_source]
            : "Chưa xác định",
        ]),
      );
      sheet.getRow(1).font = { bold: true };
      sheet.columns.forEach((c) => {
        c.width = 24;
      });
      const buffer = await book.xlsx.writeBuffer();
      const url = URL.createObjectURL(
        new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `hoc-vien-b2c-${data.today}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Không xuất được Excel. Vui lòng thử lại.");
    } finally {
      setExporting(false);
    }
  }
  const pageButtons = (
    currentPage: number,
    totalPages: number,
    change: (next: number) => void,
    suffix = "",
  ) => (
    <div className="flex items-center gap-2">
      <button
        aria-label={`Trang trước${suffix}`}
        disabled={currentPage === 0}
        onClick={() => change(currentPage - 1)}
        className="rounded-md border p-2 disabled:opacity-30"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="rounded-md bg-blue-600 px-3 py-2 text-white">
        {currentPage + 1}
      </span>
      <span>/ {totalPages}</span>
      <button
        aria-label={`Trang sau${suffix}`}
        disabled={currentPage + 1 >= totalPages}
        onClick={() => change(currentPage + 1)}
        className="rounded-md border p-2 disabled:opacity-30"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
  return (
    <div className="-m-4 min-h-full space-y-4 bg-gradient-to-br from-blue-50/80 via-slate-50/60 to-sky-50/70 p-4 text-slate-700 md:-m-6 md:p-6 dark:from-slate-950 dark:to-slate-900 dark:text-slate-200">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-[#102752] dark:text-white">
          Học viên trung tâm (B2C)
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Quản lý toàn bộ học viên thuộc các lớp Anh, Trung, Việt, Vẽ và Kèm 1-1
          tại trung tâm.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            kind: "all" as const,
            label: "Tổng học viên",
            value: data.students.length,
            note: "Học viên duy nhất trong hệ thống",
            icon: Users,
            color: "bg-blue-50 text-blue-500",
          },
          {
            kind: "studying" as const,
            label: "Đang học",
            value: studyingIds.size,
            note: `Chiếm ${data.students.length ? Math.round((studyingIds.size / data.students.length) * 100) : 0}% tổng học viên`,
            icon: GraduationCap,
            color: "bg-emerald-50 text-emerald-500",
          },
          {
            kind: "expiring" as const,
            label: "Sắp hết học phí",
            value: expiringIds.size,
            note: "Trong 30 ngày tới, kể cả hôm nay",
            icon: Clock3,
            color: "bg-orange-50 text-orange-500",
          },
          {
            kind: "classes" as const,
            label: "Lớp đang hoạt động",
            value: activeClasses.length,
            note: "Lớp hoạt động có học viên đang học",
            icon: BookOpen,
            color: "bg-violet-50 text-violet-500",
          },
        ].map(({ kind, label, value, note, icon: Icon, color }) => (
          <button
            type="button"
            key={kind}
            aria-label={`Xem ${label.toLocaleLowerCase("vi")}`}
            aria-haspopup="dialog"
            onClick={(e) => openGroup(kind, e.currentTarget)}
            className={`${panel} flex items-center gap-4 text-left transition hover:border-blue-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-blue-500`}
          >
            <span
              className={`flex size-16 shrink-0 items-center justify-center rounded-2xl ${color}`}
            >
              <Icon className="size-8" />
            </span>
            <span>
              <span className="block text-sm font-medium">{label}</span>
              <strong className="mt-1 block text-3xl text-[#102752] dark:text-white">
                {value}
              </strong>
              <span className="mt-1 block text-[11px] text-slate-500">
                {note}
              </span>
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.1fr_1.1fr_1fr]">
        <section className={panel}>
          <h2 className="font-semibold text-[#102752] dark:text-white">
            Tình trạng học viên
          </h2>
          <div className="flex min-h-52 items-center gap-3">
            <div
              className="relative h-48 min-w-0 flex-1"
              role="img"
              aria-label={
                statusData.map((s) => `${s.name}: ${s.value}`).join(", ") ||
                "Chưa có học viên"
              }
            >
              {data.students.length ? (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="value"
                        innerRadius="65%"
                        outerRadius="90%"
                        stroke="none"
                        isAnimationActive={false}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {statusData.map((s) => (
                          <Cell key={s.name} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <strong className="text-2xl text-[#102752] dark:text-white">
                      {data.students.length}
                    </strong>
                    <span className="text-[11px]">Học viên</span>
                  </div>
                </>
              ) : (
                <p className="pt-16 text-center text-xs text-slate-400">
                  Chưa có học viên
                </p>
              )}
            </div>
            <div className="space-y-2 text-[11px]">
              {statusData.map((s) => (
                <div key={s.name} className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ background: s.color }}
                  />
                  <span className="flex-1">{s.name}</span>
                  <strong>{s.value}</strong>
                  <span className="text-slate-400">
                    {Math.round((s.value / data.students.length) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className={panel}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-[#102752] dark:text-white">
                Nguồn khách hàng
              </h2>
              <p className="mt-1 text-[11px] text-slate-500">
                Học viên duy nhất theo nguồn đăng ký
              </p>
            </div>
            <select
              aria-label="Năm thống kê nguồn khách"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className={control}
            >
              <option value="">Tất cả năm</option>
              {years.map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </div>
          <div
            className="mt-4 h-44"
            role="img"
            aria-label={sourceData
              .map((s) => `${s.name}: ${s.value}`)
              .join(", ")}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={sourceData}
                margin={{ left: -25, right: 5, top: 15, bottom: 18 }}
              >
                <CartesianGrid vertical={false} stroke="#e9eff7" />
                <XAxis dataKey="name" interval={0} tick={{ fontSize: 9 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar
                  dataKey="value"
                  name="Học viên"
                  fill="#3589ff"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={38}
                  isAnimationActive={false}
                  label={{ position: "top", fontSize: 10 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className={panel}>
          <h2 className="mb-3 font-semibold text-[#102752] dark:text-white">
            Thao tác nhanh
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <button
              disabled={exporting}
              onClick={exportExcel}
              className="flex items-center gap-3 rounded-lg bg-blue-50 p-3 text-left text-blue-600 disabled:opacity-50 dark:bg-blue-950"
            >
              <FileSpreadsheet className="size-6 shrink-0" />
              <span>
                <strong className="block text-xs">
                  {exporting ? "Đang xuất…" : "Xuất Excel"}
                </strong>
                <span className="mt-1 block text-[10px] text-slate-500">
                  Dòng đã chọn hoặc kết quả lọc
                </span>
              </span>
            </button>
            <button
              onClick={(e) => openGroup("expiring", e.currentTarget)}
              className="flex items-center gap-3 rounded-lg bg-orange-50 p-3 text-left text-orange-500 dark:bg-orange-950"
            >
              <Bell className="size-6 shrink-0" />
              <span>
                <strong className="block text-xs">Nhắc học phí</strong>
                <span className="mt-1 block text-[10px] text-slate-500">
                  Xem danh sách cần liên hệ
                </span>
              </span>
            </button>
            <a
              href="#student-list"
              className="flex items-center gap-3 rounded-lg bg-emerald-50 p-3 text-emerald-600 dark:bg-emerald-950"
            >
              <ChartColumn className="size-6 shrink-0" />
              <span>
                <strong className="block text-xs">Báo cáo học viên</strong>
                <span className="mt-1 block text-[10px] text-slate-500">
                  Danh sách và thông tin chi tiết
                </span>
              </span>
            </a>
            <Link
              href="/admin/b2c/admissions"
              className="flex items-center gap-3 rounded-lg bg-violet-50 p-3 text-violet-600 dark:bg-violet-950"
            >
              <UserPlus className="size-6 shrink-0" />
              <span>
                <strong className="block text-xs">Tuyển sinh</strong>
                <span className="mt-1 block text-[10px] text-slate-500">
                  Tiếp nhận học viên mới
                </span>
              </span>
            </Link>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {error}
            </p>
          )}
        </section>
      </div>
      <section id="student-list" className={`${panel} scroll-mt-4`}>
        <h2 className="mb-3 font-semibold text-[#102752] dark:text-white">
          Danh sách học viên
        </h2>
        <div className="mb-3 flex flex-wrap items-end gap-3">
          <label className="relative min-w-52 flex-1">
            <Search className="absolute top-2.5 left-3 size-4 text-slate-400" />
            <input
              aria-label="Tìm học viên"
              placeholder="Tìm mã, tên học viên, phụ huynh, số điện thoại…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                reset();
              }}
              className={`${control} w-full pl-9`}
            />
          </label>
          <select
            aria-label="Trạng thái học viên"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              reset();
            }}
            className={control}
          >
            <option value="">Trạng thái: Tất cả</option>
            {B2C_STUDENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {B2C_STUDENT_STATUS_LABELS[s]}
              </option>
            ))}
            <option value="unassigned">Chưa ghi danh</option>
          </select>
          <select
            aria-label="Lọc lớp học viên"
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              reset();
            }}
            className={`${control} max-w-52`}
          >
            <option value="">Lớp: Tất cả</option>
            {data.classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.code}
              </option>
            ))}
          </select>
          <select
            aria-label="Nguồn khách học viên"
            value={source}
            onChange={(e) => {
              setSource(e.target.value);
              reset();
            }}
            className={control}
          >
            <option value="">Nguồn khách: Tất cả</option>
            {B2C_CUSTOMER_SOURCES.map((s) => (
              <option key={s} value={s}>
                {B2C_CUSTOMER_SOURCE_LABELS[s]}
              </option>
            ))}
            <option value="unknown">Chưa xác định</option>
          </select>
          <label className="text-[10px] text-slate-500">
            Nhập học từ
            <input
              type="date"
              aria-label="Ngày nhập học từ"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                reset();
              }}
              className={`${control} mt-1 block`}
            />
          </label>
          <label className="text-[10px] text-slate-500">
            Đến ngày
            <input
              type="date"
              aria-label="Ngày nhập học đến"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                reset();
              }}
              className={`${control} mt-1 block`}
            />
          </label>
        </div>
        <StudentDashboardTable
          rows={visible}
          offset={current * pageSize}
          selected={selected}
          onSelect={(id) =>
            setSelected((old) => {
              const next = new Set(old);
              if (next.has(id)) next.delete(id);
              else next.add(id);
              return next;
            })
          }
          onSelectAll={() =>
            setSelected((old) => {
              const next = new Set(old);
              const all = visible.every((r) => next.has(r.id));
              visible.forEach((r) => {
                if (all) next.delete(r.id);
                else next.add(r.id);
              });
              return next;
            })
          }
        />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            Hiển thị {filtered.length ? current * pageSize + 1 : 0}–
            {Math.min((current + 1) * pageSize, filtered.length)} /{" "}
            {filtered.length} dòng ·{" "}
            {new Set(filtered.map((r) => r.student.id)).size} học viên
            {selected.size ? ` · Đã chọn ${selected.size} dòng` : ""}
          </span>
          <div className="flex items-center gap-3">
            {pageButtons(current, pages, setPage)}
            <select
              aria-label="Số dòng mỗi trang"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className={control}
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n} / trang
                </option>
              ))}
            </select>
          </div>
        </div>
        <details className="mt-4 text-xs leading-relaxed text-slate-500">
          <summary className="cursor-pointer">
            Cách tính tổng và trạng thái
          </summary>
          <p className="mt-2">
            Các thẻ và biểu đồ tính theo học viên duy nhất; bảng hiển thị từng
            lượt ghi danh và cả hồ sơ chưa ghi danh. Đang học nghĩa là có ít
            nhất một ghi danh đang học. Biểu đồ tình trạng ưu tiên Đang học → Nợ
            phí → Chờ tái phí → Bảo lưu → Nghỉ → Hoàn thành để mỗi người chỉ
            thuộc một nhóm. Sắp hết phí tính từ hôm nay đến 30 ngày sau, loại
            ghi danh Nghỉ/Hoàn thành. Lớp đang hoạt động phải có trạng thái hoạt
            động và có học viên đang học. Biểu đồ nguồn theo năm nhập học, đếm
            mỗi người một lần trong năm. Bộ lọc bảng không thay đổi thẻ tổng
            quan. Nhắc học phí mở danh sách để liên hệ, chưa gửi tin nhắn.
          </p>
        </details>
      </section>
      <Dialog
        open={group !== null}
        onOpenChange={(open) => {
          if (!open) setGroup(null);
        }}
      >
        <DialogContent
          className="max-h-[85dvh] overflow-y-auto sm:max-w-5xl"
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            trigger.current?.focus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{group ? groupTitles[group] : ""}</DialogTitle>
            <DialogDescription>
              {group === "expiring"
                ? "Học viên có ghi danh hết hạn trong 30 ngày tới. Mỗi học viên xuất hiện một lần; chưa gửi tin nhắn."
                : "Danh sách theo đúng nhóm tổng quan, độc lập bộ lọc bảng."}
            </DialogDescription>
          </DialogHeader>
          <input
            aria-label="Tìm trong popup học viên"
            placeholder="Tìm mã, tên, điện thoại hoặc lớp…"
            value={popupQuery}
            onChange={(e) => {
              setPopupQuery(e.target.value);
              setPopupPage(0);
            }}
            className={control}
          />
          {group === "classes" ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[450px] text-left text-sm">
                <thead className="bg-muted">
                  <tr>
                    {["Mã lớp", "Lớp học", "Học viên đang học"].map((h) => (
                      <th key={h} className="p-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {popupClasses
                    .slice(popupCurrent * 20, popupCurrent * 20 + 20)
                    .map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="p-3">{c.code}</td>
                        <td className="p-3">{c.name}</td>
                        <td className="p-3">
                          {
                            new Set(
                              data.enrollments
                                .filter(
                                  (e) =>
                                    e.class_id === c.id &&
                                    e.status === "studying",
                                )
                                .map((e) => e.student_id),
                            ).size
                          }
                        </td>
                      </tr>
                    ))}
                  {!popupClasses.length && (
                    <tr>
                      <td
                        colSpan={3}
                        className="p-8 text-center text-slate-400"
                      >
                        Không có lớp phù hợp.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <StudentDashboardTable
              compact
              rows={popupStudents.slice(
                popupCurrent * 20,
                popupCurrent * 20 + 20,
              )}
            />
          )}
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {popupCount} {group === "classes" ? "lớp" : "học viên"}
            </span>
            {pageButtons(
              popupCurrent,
              popupPages,
              setPopupPage,
              " trong popup",
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
