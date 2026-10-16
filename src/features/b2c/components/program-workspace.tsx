"use client";

import { useState } from "react";
import { ClassOccupancyProgress } from "./class-occupancy-progress";
import { ClassStudentAddDialog } from "./class-student-add-dialog";
import { todayISO } from "@/lib/dates";
import Link from "next/link";
import {
  CalendarDays,
  ChevronRight,
  Eye,
  FileBarChart,
  Search,
  Users,
} from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { B2CClassFormDialog } from "@/features/b2c/components/class-form-dialog";
import { B2CClassDetailDialog } from "@/features/b2c/components/class-detail-dialog";
import { cn } from "@/lib/utils";
import { B2CStudentStatusDialog } from "@/features/b2c/components/student-status-dialog";
import { B2C_CUSTOMER_SOURCE_LABELS } from "@/features/b2c/domain/customer-source";
import { B2C_LEARNING_GOAL_LABELS } from "@/features/b2c/domain/learning-goal";
import { B2C_STUDENT_STATUS_LABELS, B2C_STUDENT_STATUS_COLORS, type B2CStudentStatus } from "@/features/b2c/domain/student-status";

type ProgramSummary = {
  slug: string;
  title: string;
  description: string;
};

export type ClassRow = {
  id: string;
  code: string;
  program_slug: string;
  name: string;
  capacity: number;
  enrolled_count: number;
  status: string;
  start_date: string | null;
  end_date: string | null;
  delivery_mode: string;
  campus: string | null;
  level_name: string | null;
  teacher_name: string | null;
  weekdays_text: string | null;
  time_text: string | null;
  notes: string | null;
};

export type StudentRow = {
  id: string;
  studentId: string;
  studentCode: string;
  customerSource: string | null;
  referrerName: string | null;
  learningGoal: string | null;
  certificateGoal: string | null;
  studentStatus: B2CStudentStatus;
  withdrawalReason: string | null;
  classCode: string;
  className: string;
  programSlug: string;
  fullName: string;
  dateOfBirth: string | null;
  birthYear: number | null;
  guardianName: string | null;
  email: string | null;
  address: string | null;
  phone: string | null;
  enrollmentDate: string | null;
  paymentDate: string | null;
  learningStartDate: string | null;
  tuitionEndDate: string | null;
  registeredSessions: number | null;
  sessionsPerWeek: number | null;
  salesperson: string | null;
  notes: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  planned: "Sắp khai giảng",
  active: "Đang học",
  paused: "Tạm dừng",
  completed: "Đã hoàn thành",
  cancelled: "Đã hủy",
};

const DELIVERY_LABELS: Record<string, string> = {
  offline: "Trực tiếp",
  online: "Trực tuyến",
  hybrid: "Kết hợp",
};

const tabs = [
  { id: "classes", label: "Danh sách lớp", icon: null },
  { id: "students", label: "Học viên", icon: Users },
  { id: "schedule", label: "Lịch học", icon: CalendarDays },
  { id: "reports", label: "Báo cáo", icon: FileBarChart },
] as const;

type TabId = (typeof tabs)[number]["id"];

export function B2CProgramWorkspace({
  program,
  classes,
  students,
}: {
  program: ProgramSummary;
  classes: ClassRow[];
  students: StudentRow[];
}) {
  const [activeTab, setActiveTab] = useState<TabId>("classes");
  const [query, setQuery] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassRow | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const visibleClasses = normalizedQuery
    ? classes.filter((item) =>
        [item.code, item.name, item.level_name, item.teacher_name]
          .filter(Boolean)
          .some((value) =>
            value!.toLocaleLowerCase("vi").includes(normalizedQuery),
          ),
      )
    : classes;

  return (
    <>
      <nav
        aria-label="Đường dẫn"
        className="text-muted-foreground mb-3 flex flex-wrap items-center gap-1 text-sm"
      >
        <Link
          href="/admin/b2c"
          className="hover:text-foreground hover:underline"
        >
          Lớp trung tâm (B2C)
        </Link>
        <ChevronRight className="size-4" aria-hidden />
        <span className="text-foreground">{program.title}</span>
      </nav>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{program.title}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {program.description}
          </p>
        </div>
        <B2CClassFormDialog
          programSlug={program.slug}
          programTitle={program.title}
        />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="overflow-x-auto border-b px-4">
          <div
            role="tablist"
            aria-label={`Quản lý ${program.title}`}
            className="flex min-w-max gap-6"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "relative flex h-12 items-center gap-2 border-b-2 px-1 text-sm font-medium transition-colors",
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "text-muted-foreground hover:text-foreground border-transparent",
                )}
              >
                {tab.label}
                {tab.id === "classes" && (
                  <span className="bg-muted rounded-full px-2 py-0.5 text-xs tabular-nums">
                    {classes.length}
                  </span>
                )}
                {tab.id === "students" && (
                  <span className="bg-muted rounded-full px-2 py-0.5 text-xs tabular-nums">
                    {students.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <CardContent className="p-4">
          {activeTab === "classes" ? (
            <ClassList
              programTitle={program.title}
              classes={visibleClasses}
              query={query}
              onQueryChange={setQuery}
              onSelectClass={setSelectedClass}
            />
          ) : activeTab === "students" ? (
            <B2CStudentsTable students={students} />
          ) : (
            <EmptyTab activeTab={activeTab} programTitle={program.title} />
          )}
        </CardContent>
      </Card>
      {selectedClass && <B2CClassDetailDialog key={selectedClass.id} classRow={classes.find((c) => c.id === selectedClass.id) ?? selectedClass} programTitle={program.title} students={students.filter(student => student.classCode === selectedClass.code)} onClose={() => setSelectedClass(null)} />}
    </>
  );
}

export function B2CStudentsTable({ students }: { students: StudentRow[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const visibleStudents = normalizedQuery
    ? students.filter((item) =>
        [
          item.fullName,
          item.studentCode,
          item.guardianName,
          item.phone,
          item.email,
          item.className,
        ]
          .filter(Boolean)
          .some((value) =>
            value!.toLocaleLowerCase("vi").includes(normalizedQuery),
          ),
      )
    : students;

  return (
    <>
      <label className="relative mb-4 block max-w-2xl">
        <span className="sr-only">Tìm học viên</span>
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm mã, tên học viên, phụ huynh, số điện thoại, email hoặc lớp..."
          className="border-input bg-background h-10 w-full rounded-md border pr-3 pl-9 text-sm"
        />
      </label>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[112rem] border-collapse text-sm">
          <thead className="bg-muted/60 text-left">
            <tr>
              {[
                "#",
                "Mã học viên",
                "Học viên",
                "Trạng thái HV",
                "Lý do nghỉ",
                "Lớp",
                "Ngày sinh",
                "Phụ huynh",
                "Điện thoại",
                "Email",
                "Địa chỉ",
                "Ngày nhập học",
                "Ngày đóng tiền",
                "Bắt đầu học",
                "Hết học phí",
                "Số buổi",
                "Người chốt",
                "Ghi chú",
                "Nguồn khách",
                "Người giới thiệu",
                "Mục tiêu học",
                "Chứng chỉ mục tiêu",
                "Thao tác",
              ].map((heading) => (
                <th key={heading} className={cn("border-b px-3 py-2.5 font-medium", heading === "Thao tác" && "bg-muted sticky right-0 z-20 w-16 text-right shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.2)]")}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleStudents.length === 0 ? (
              <tr>
                <td
                  colSpan={23}
                  className="text-muted-foreground px-4 py-12 text-center"
                >
                  {query
                    ? "Không tìm thấy học viên phù hợp."
                    : "Chưa có dữ liệu học viên."}
                </td>
              </tr>
            ) : (
              visibleStudents.map((item, index) => (
                <tr
                  key={item.id}
                  className="border-b align-top last:border-b-0"
                >
                  <td className="px-3 py-3">{index + 1}</td>
                  <td className="px-3 py-3 font-mono whitespace-nowrap">{item.studentCode}</td>
                  <td className="px-3 py-3 font-medium">{item.fullName}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={cn("inline-flex rounded-full px-2 py-1 text-xs font-medium", B2C_STUDENT_STATUS_COLORS[item.studentStatus])}>
                      {B2C_STUDENT_STATUS_LABELS[item.studentStatus]}
                    </span>
                  </td>
                  <td className="max-w-64 px-3 py-3 whitespace-pre-wrap break-words">{item.withdrawalReason ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span className="font-medium">{item.className}</span>
                    <div className="text-muted-foreground font-mono text-xs">
                      {item.classCode}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {formatDate(item.dateOfBirth) ?? item.birthYear ?? "—"}
                  </td>
                  <td className="px-3 py-3">{item.guardianName ?? "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {item.phone ?? "—"}
                  </td>
                  <td className="px-3 py-3">{item.email ?? "—"}</td>
                  <td className="max-w-72 px-3 py-3 whitespace-normal">
                    {item.address ?? "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatDate(item.enrollmentDate) ?? "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatDate(item.paymentDate) ?? "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatDate(item.learningStartDate) ?? "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    {formatDate(item.tuitionEndDate) ?? "—"}
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {item.registeredSessions ?? "—"}
                  </td>
                  <td className="px-3 py-3">{item.salesperson ?? "—"}</td>
                  <td className="max-w-80 px-3 py-3 whitespace-normal">
                    {item.notes ?? "—"}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{item.customerSource ? B2C_CUSTOMER_SOURCE_LABELS[item.customerSource] : "Chưa xác định"}</td>
                  <td className="px-3 py-3">{item.referrerName ?? "—"}</td>
                  <td className="px-3 py-3">{item.learningGoal ? B2C_LEARNING_GOAL_LABELS[item.learningGoal] : "Chưa xác định"}</td>
                  <td className="px-3 py-3">{item.certificateGoal ?? "—"}</td>
                  <td className="bg-card sticky right-0 z-10 px-3 py-3 text-right shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.2)]">
                    <B2CStudentStatusDialog enrollmentId={item.id} fullName={item.fullName} className={item.className} status={item.studentStatus} reason={item.withdrawalReason}
                      programSlug={item.programSlug} phone={item.phone} salesperson={item.salesperson} enrollmentDate={item.enrollmentDate}
                      learningStartDate={item.learningStartDate} tuitionEndDate={item.tuitionEndDate} customerSource={item.customerSource} referrerName={item.referrerName} learningGoal={item.learningGoal} certificateGoal={item.certificateGoal} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mt-3 text-sm">
        Hiển thị {visibleStudents.length}/{students.length} lượt đăng ký
      </p>
    </>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function ClassList({
  programTitle,
  classes,
  query,
  onQueryChange,
  onSelectClass,
}: {
  programTitle: string;
  classes: ClassRow[];
  query: string;
  onQueryChange: (value: string) => void;
  onSelectClass: (value: ClassRow) => void;
}) {
  return (
    <>
      <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_repeat(3,minmax(9rem,12rem))]">
        <label className="relative block">
          <span className="sr-only">Tìm lớp</span>
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Tìm tên lớp, mã lớp, giáo viên..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="border-input bg-background h-10 w-full rounded-md border pr-3 pl-9 text-sm"
          />
        </label>
        <Filter label="Trạng thái" />
        <Filter label="Cơ sở" />
        <Filter label="Khung lớp" />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[64rem] border-collapse text-sm">
          <caption className="sr-only">Danh sách lớp {programTitle}</caption>
          <thead className="bg-muted/60 text-left">
            <tr>
              {[
                "#",
                "Mã lớp",
                "Tên lớp",
                "Cấp độ",
                "Giáo viên",
                "Lịch học",
                "Sĩ số",
                "Cơ sở",
                "Trạng thái",
                "Thao tác",
              ].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className={cn("border-b px-3 py-2.5 font-medium", heading === "Thao tác" && "bg-muted sticky right-0 z-20 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.2)]")}
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {classes.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-14 text-center">
                  <div className="mx-auto flex max-w-md flex-col items-center">
                    <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                      <Users className="size-5" aria-hidden />
                    </span>
                    <p className="mt-3 font-medium">
                      {query
                        ? "Không tìm thấy lớp phù hợp"
                        : `Chưa có lớp ${programTitle}`}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {query
                        ? "Thử tìm bằng mã lớp, tên lớp, khóa học hoặc giáo viên."
                        : "Nhấn “Thêm lớp mới” để quản trị viên nhập dữ liệu."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              classes.map((item, index) => {
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-muted/50 focus-within:bg-muted/50 cursor-pointer border-b transition-colors last:border-b-0"
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return;
                      onSelectClass(item);
                    }}
                  >
                    <td className="px-3 py-3">{index + 1}</td>
                    <td className="px-3 py-3 font-mono text-xs">{item.code}</td>
                    <td className="px-3 py-3 font-medium"><button type="button" onClick={() => onSelectClass(item)} className="text-primary rounded text-left underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4">{item.name}</button></td>
                    <td className="px-3 py-3">{item.level_name ?? "—"}</td>
                    <td className="px-3 py-3">
                      {item.teacher_name ?? "Chưa phân công"}
                    </td>
                    <td className="px-3 py-3">
                      {formatSchedule(item.weekdays_text, item.time_text)}
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      {item.enrolled_count}/{item.capacity}
                      <ClassOccupancyProgress count={item.enrolled_count} capacity={item.capacity} />
                    </td>
                    <td className="px-3 py-3">
                      {item.campus ??
                        DELIVERY_LABELS[item.delivery_mode] ??
                        item.delivery_mode}
                    </td>
                    <td className="px-3 py-3">
                      {STATUS_LABELS[item.status] ?? item.status}
                    </td>
                    <td className="bg-card sticky right-0 z-10 px-3 py-3 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.2)]" onClick={(event) => event.stopPropagation()}>
                      <div className="flex items-center gap-2 whitespace-nowrap">
                      {!["completed", "cancelled"].includes(item.status) && <ClassStudentAddDialog classId={item.id} className={item.name} today={todayISO()} />}
                      <button
                        type="button"
                        onClick={() => onSelectClass(item)}
                        className="text-primary hover:bg-primary/10 inline-flex size-10 items-center justify-center rounded focus-visible:outline-2"
                        aria-label={`Xem chi tiết lớp ${item.name}`}
                      >
                        <Eye className="size-4 text-blue-600 dark:text-blue-400" aria-hidden />
                      </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <p className="text-muted-foreground mt-3 text-sm">
        Hiển thị {classes.length} lớp
      </p>
    </>
  );
}

function formatSchedule(weekdays: string | null, time: string | null) {
  if (!weekdays && !time) return "Chưa xếp lịch";
  return [weekdays, time].filter(Boolean).join(" · ");
}

function Filter({ label }: { label: string }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-muted-foreground shrink-0 text-sm">{label}</span>
      <select
        disabled
        className="border-input bg-background h-10 min-w-0 flex-1 rounded-md border px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <option>Tất cả</option>
      </select>
    </label>
  );
}

function EmptyTab({
  activeTab,
  programTitle,
}: {
  activeTab: Exclude<TabId, "classes">;
  programTitle: string;
}) {
  const tab = tabs.find((item) => item.id === activeTab)!;
  const Icon = tab.icon!;
  return (
    <div
      role="tabpanel"
      className="flex min-h-64 flex-col items-center justify-center text-center"
    >
      <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-3 font-medium">
        Chưa có dữ liệu {tab.label.toLowerCase()}
      </p>
      <p className="text-muted-foreground mt-1 max-w-md text-sm">
        Dữ liệu {programTitle} sẽ được hiển thị tại đây sau khi hoàn tất bước
        nhập danh sách B2C.
      </p>
    </div>
  );
}
