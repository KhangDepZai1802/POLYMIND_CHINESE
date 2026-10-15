"use client";
import NextLink from "next/link";
import { createContext, useContext, type ComponentProps } from "react";
import type { readClassWorkspaceAction } from "../server/class-workspace-read";
import { formatInTimeZone } from "date-fns-tz";
import { formatCurrency, formatDate, formatDateOnly } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CLASS_TABS,
  MEETING_STATUSES,
  ATTENDANCE_STATUSES,
  type ClassStudent,
  type ClassMeeting,
  type ClassComment,
} from "@/features/b2c/domain/class-workspace";
import { B2C_STUDENT_STATUS_LABELS } from "@/features/b2c/domain/student-status";
import { getB2CProgram } from "@/features/b2c/domain/programs";
import {
  ClassMeetingDialog,
  ClassAttendanceDialog,
  ClassCommentDialog,
} from "@/features/b2c/components/class-workspace-dialogs";
import {
  TuitionPackageDialog,
  TuitionReceiptsDialog,
} from "@/features/b2c/components/tuition-dialogs";
import { StructuredScheduleDialog } from "@/features/b2c/components/structured-schedule-dialog";
import { WEEKDAYS } from "@/features/b2c/domain/structured-schedule";
import type { B2CPermission } from "../domain/teacher-permissions";
import {
  TeacherClassManageDialog,
  TeacherStudentManageDialog,
} from "./teacher-management-dialogs";

type Model = Awaited<ReturnType<typeof readClassWorkspaceAction>>;
type Navigate = (filters: Record<string, string>) => void;
const NavigationContext = createContext<Navigate | undefined>(undefined);
const time = (value: string) =>
  formatInTimeZone(value, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
function Link({ href, ...props }: ComponentProps<typeof NextLink>) {
  const navigate = useContext(NavigationContext);
  return (
    <NextLink
      {...props}
      href={href}
      onClick={
        navigate
          ? (event) => {
              if (
                event.button !== 0 ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey ||
                event.altKey
              )
                return;
              event.preventDefault();
              navigate(
                Object.fromEntries(
                  new URL(String(href), "http://localhost").searchParams,
                ),
              );
            }
          : props.onClick
      }
    />
  );
}
export function ClassWorkspaceContent({
  model,
  embedded = false,
  onNavigate,
  permissions,
}: {
  model: Model;
  embedded?: boolean;
  onNavigate?: (filters: Record<string, string>) => void;
  permissions?: B2CPermission[];
}) {
  const can = (permission: B2CPermission) =>
    !permissions || permissions.includes(permission);
  const tabPermission = {
    students: "view_students",
    schedule: "view_schedule",
    attendance: "mark_attendance",
    tuition: "view_tuition",
    comments: "view_comments",
  } as const;
  const {
    cls,
    schedules,
    result,
    meeting,
    today,
    filters,
    classId,
    base,
    collector,
  } = model;
  const studentRows = result.rows as ClassStudent[],
    scheduleRows = result.rows as ClassMeeting[],
    commentRows = result.rows as ClassComment[];
  const href = (tab: string, page = 0, meetingId?: string) =>
    `${base}?${new URLSearchParams({ tab, page: String(page), ...(filters.q ? { q: filters.q } : {}), ...(meetingId ? { meeting: meetingId } : {}) })}`;
  const canAttend =
    meeting &&
    meeting.status !== "cancelled" &&
    formatInTimeZone(meeting.starts_at, "Asia/Ho_Chi_Minh", "yyyy-MM-dd") <=
      today;
  return (
    <NavigationContext.Provider value={onNavigate}>
      {!embedded && (
        <BackLink
          href={
            permissions ? "/teacher/classes" : `/admin/b2c/${cls.program_slug}`
          }
          label={getB2CProgram(cls.program_slug)?.title ?? "Danh sách lớp"}
        />
      )}
      {!embedded && (
        <PageHeader
          title={cls.name}
          description={`${cls.code} · ${cls.teacher_name ?? "Chưa phân công giáo viên"} · ${[cls.weekdays_text, cls.time_text].filter(Boolean).join(" · ") || "Chưa xếp lịch"}`}
        />
      )}
      <div className="bg-card mb-5 grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-3">
        <p>
          Sĩ số ghi nhận:{" "}
          <strong>
            {cls.enrolled_count}/{cls.capacity}
          </strong>
        </p>
        <p>
          Khai giảng:{" "}
          {cls.start_date ? formatDate(cls.start_date) : "Chưa cập nhật"}
        </p>
        <p>
          Cơ sở:{" "}
          {cls.campus ??
            { offline: "Trực tiếp", online: "Trực tuyến", hybrid: "Kết hợp" }[
              cls.delivery_mode
            ] ??
            cls.delivery_mode}
        </p>
        {cls.notes && (
          <p className="break-words whitespace-pre-wrap sm:col-span-3">
            {cls.notes}
          </p>
        )}
      </div>
      {!embedded && (
        <nav
          aria-label="Chi tiết lớp"
          className="mb-5 flex gap-2 overflow-x-auto pb-2"
        >
          {Object.entries(CLASS_TABS)
            .filter(([tab]) =>
              can(tabPermission[tab as keyof typeof tabPermission]),
            )
            .map(([tab, label]) => (
              <Button
                asChild
                key={tab}
                variant={tab === filters.tab ? "default" : "outline"}
              >
                <Link
                  href={href(
                    tab,
                    0,
                    tab === "attendance" || tab === "comments"
                      ? filters.meeting
                      : undefined,
                  )}
                  aria-current={tab === filters.tab ? "page" : undefined}
                >
                  {label}
                </Link>
              </Button>
            ))}
        </nav>
      )}
      {permissions && can("edit_classes") && (
        <div className="mb-4">
          <TeacherClassManageDialog classId={classId} />
        </div>
      )}
      {["students", "attendance", "tuition"].includes(filters.tab) && (
        <form
          className="mb-4 flex gap-2"
          onSubmit={
            onNavigate
              ? (event) => {
                  event.preventDefault();
                  const values = new FormData(event.currentTarget);
                  const query = new URLSearchParams();
                  values.forEach((value, key) => query.set(key, String(value)));
                  onNavigate(Object.fromEntries(query));
                }
              : undefined
          }
        >
          <input type="hidden" name="tab" value={filters.tab} />
          {filters.meeting && (
            <input type="hidden" name="meeting" value={filters.meeting} />
          )}
          <Input
            name="q"
            aria-label="Tìm học viên của lớp"
            placeholder="Tìm mã, tên, số điện thoại…"
            maxLength={200}
            defaultValue={filters.q}
          />
          <Button>Tìm</Button>
        </form>
      )}
      {filters.tab === "schedule" && (
        <>
          {can("edit_schedule") && (
            <div className="mb-4 flex flex-wrap gap-3">
              <StructuredScheduleDialog
                classId={classId}
                today={today}
                openingDate={cls.start_date}
              />
              <ClassMeetingDialog
                classId={classId}
                teacherName={cls.teacher_name ?? ""}
                today={today}
              />
            </div>
          )}
          {!!schedules.length && (
            <section className="bg-card mb-5 rounded-xl border p-4">
              <h2 className="mb-3 font-semibold">Lịch lặp đã lưu</h2>
              <ul className="space-y-2 text-sm">
                {schedules.map((s) => (
                  <li key={s.id} className="bg-muted/40 rounded-lg p-3">
                    {WEEKDAYS.filter(([v]) => s.weekdays.includes(v))
                      .map(([, l]) => l)
                      .join(" · ")}{" "}
                    · {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)} ·{" "}
                    {s.room_name || "Chưa xếp phòng"}
                    <p className="text-muted-foreground text-xs">
                      {formatDateOnly(s.date_from)}–{formatDateOnly(s.date_to)}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="grid gap-3">
            {scheduleRows.map((m) => (
              <section key={m.id} className="bg-card rounded-xl border p-4">
                <h2 className="font-semibold">
                  {time(m.starts_at)} –{" "}
                  {formatInTimeZone(m.ends_at, "Asia/Ho_Chi_Minh", "HH:mm")}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {MEETING_STATUSES[m.status]} ·{" "}
                  {m.teacher_name || "Chưa phân công"}
                  {m.teaching_session_id ? " · Liên kết lịch dạy" : ""}
                  {m.schedule_id ? " · Sinh từ lịch lặp" : ""}
                  {` · ${m.room_name || "Chưa xếp phòng"}`}
                </p>
                {m.note && (
                  <p className="mt-2 text-sm break-words whitespace-pre-wrap">
                    {m.note}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {can("mark_attendance") && (
                    <Button asChild variant="outline">
                      <Link href={href("attendance", 0, m.id)}>
                        Mở điểm danh
                      </Link>
                    </Button>
                  )}
                  {can("view_comments") && (
                    <Button asChild variant="outline">
                      <Link href={href("comments", 0, m.id)}>
                        Nhận xét buổi
                      </Link>
                    </Button>
                  )}
                  {can("edit_schedule") && !m.teaching_session_id && (
                    <ClassMeetingDialog
                      classId={classId}
                      teacherName={cls.teacher_name ?? ""}
                      today={today}
                      meeting={m}
                    />
                  )}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
      {filters.tab === "attendance" && (
        <div className="bg-muted/40 mb-4 rounded-lg p-4 text-sm">
          {meeting ? (
            <>
              <strong>Buổi {time(meeting.starts_at)}</strong>
              <p>
                {MEETING_STATUSES[meeting.status]} ·{" "}
                {canAttend
                  ? "Chọn trạng thái từng học viên để lưu điểm danh."
                  : "Buổi đã hủy hoặc chưa đến ngày; chỉ xem."}
              </p>
            </>
          ) : (
            <p>
              Chọn một buổi trong{" "}
              <Link href={href("schedule")} className="text-primary underline">
                Lịch học
              </Link>{" "}
              để điểm danh.
            </p>
          )}
          {meeting && result.stats && (
            <p className="mt-2">
              {Object.entries(ATTENDANCE_STATUSES)
                .map(([v, l]) => `${l}: ${result.stats?.[v] ?? 0}`)
                .join(" · ")}{" "}
              · Chưa nhập không được tính là vắng.
            </p>
          )}
        </div>
      )}
      {filters.tab === "tuition" && result.stats && (
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          {[
            ["Phải thu", formatCurrency(result.stats.total_due)],
            ["Đã thu", formatCurrency(result.stats.paid_amount)],
            [
              "Còn nợ",
              formatCurrency(
                (result.stats.total_due ?? 0) - (result.stats.paid_amount ?? 0),
              ),
            ],
          ].map(([l, v]) => (
            <div key={l} className="bg-card rounded-xl border p-4">
              <p className="text-muted-foreground text-sm">{l}</p>
              <strong className="text-xl">{v}</strong>
            </div>
          ))}
          <p className="text-muted-foreground text-xs sm:col-span-3">
            Theo bộ lọc hiện tại · {result.stats.unconfigured} học viên chưa lập
            gói; không tính là miễn phí. Điểm danh không tự trừ học phí.
          </p>
        </div>
      )}
      {["students", "attendance", "tuition"].includes(filters.tab) && (
        <div className="bg-card overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-muted/60">
              <tr>
                {[
                  "Mã HV",
                  "Học viên",
                  ...(filters.tab === "students"
                    ? [
                        "Trạng thái",
                        "Phụ huynh",
                        "SĐT",
                        "Nhập học",
                        "Hết học phí",
                      ]
                    : filters.tab === "attendance"
                      ? ["Trạng thái điểm danh", "Ghi chú"]
                      : ["Phải thu", "Đã thu", "Còn nợ"]),
                  "Thao tác",
                ].map((l) => (
                  <th key={l} scope="col" className="p-3">
                    {l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {studentRows.map((s) => (
                <tr key={s.enrollment_id} className="border-t align-top">
                  <td className="p-3 font-mono text-xs">{s.student_code}</td>
                  <td className="p-3 font-medium">{s.full_name}</td>
                  {filters.tab === "students" ? (
                    <>
                      <td className="p-3">
                        {B2C_STUDENT_STATUS_LABELS[s.student_status]}
                      </td>
                      <td className="p-3">{s.guardian_name ?? "—"}</td>
                      <td className="p-3">{s.phone ?? "—"}</td>
                      <td className="p-3">
                        {s.enrollment_date
                          ? formatDate(s.enrollment_date)
                          : "—"}
                      </td>
                      <td className="p-3">
                        {s.tuition_end_date
                          ? formatDate(s.tuition_end_date)
                          : "—"}
                      </td>
                    </>
                  ) : filters.tab === "attendance" ? (
                    <>
                      <td className="p-3">
                        {s.attendance_status
                          ? ATTENDANCE_STATUSES[s.attendance_status]
                          : "Chưa điểm danh"}
                      </td>
                      <td className="max-w-64 p-3 break-words whitespace-pre-wrap">
                        {s.attendance_note ?? "—"}
                      </td>
                    </>
                  ) : (
                    <>
                      {[s.total_due, s.paid_amount, s.balance].map((v, i) => (
                        <td className="p-3 whitespace-nowrap" key={i}>
                          {v === null ? "Chưa lập gói" : formatCurrency(v)}
                        </td>
                      ))}
                    </>
                  )}
                  <td className="p-3">
                    <div className="flex flex-wrap gap-2">
                      {filters.tab === "tuition" ? (
                        <>
                          {can("edit_tuition") && (
                            <TuitionPackageDialog
                              classId={classId}
                              row={{
                                ...s,
                                paid_amount: s.paid_amount ?? 0,
                                balance: s.balance ?? 0,
                              }}
                            />
                          )}
                          <TuitionReceiptsDialog
                            canCollect={can("collect_tuition")}
                            classId={classId}
                            row={{
                              ...s,
                              paid_amount: s.paid_amount ?? 0,
                              balance: s.balance ?? 0,
                            }}
                            collector={collector}
                            today={today}
                          />
                        </>
                      ) : (
                        <>
                          {filters.tab === "attendance" &&
                            meeting &&
                            canAttend && (
                              <ClassAttendanceDialog
                                classId={classId}
                                meeting={meeting}
                                student={s}
                              />
                            )}
                          {can("write_comments") && (
                            <ClassCommentDialog
                              classId={classId}
                              student={s}
                              meeting={
                                meeting?.status !== "cancelled" ? meeting : null
                              }
                            />
                          )}
                          {permissions && can("edit_students") && (
                            <TeacherStudentManageDialog
                              classId={classId}
                              enrollmentId={s.enrollment_id}
                            />
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {filters.tab === "comments" && (
        <>
          <div className="mb-4 flex flex-wrap gap-3">
            {can("write_comments") && (
              <Button asChild variant="outline">
                <Link
                  href={href(
                    meeting && can("mark_attendance")
                      ? "attendance"
                      : "students",
                    0,
                    meeting?.id,
                  )}
                >
                  Chọn học viên để thêm nhận xét
                </Link>
              </Button>
            )}
            {meeting && (
              <>
                <p className="text-sm">
                  Nhận xét buổi {time(meeting.starts_at)}
                </p>
                <Link
                  href={href("comments")}
                  className="text-primary text-sm underline"
                >
                  Tất cả nhận xét
                </Link>
              </>
            )}
          </div>
          <div className="grid gap-3">
            {commentRows.map((n) => (
              <article key={n.id} className="bg-card rounded-xl border p-4">
                <h2 className="font-semibold">
                  {n.full_name} · {n.student_code}
                </h2>
                <p className="text-muted-foreground mt-1 text-xs">
                  {n.actor_name} · {time(n.created_at)}
                  {n.meeting_starts_at
                    ? ` · Buổi ${time(n.meeting_starts_at)}`
                    : " · Nhận xét chung"}
                </p>
                <p className="mt-3 text-sm break-words whitespace-pre-wrap">
                  {n.content}
                </p>
              </article>
            ))}
          </div>
        </>
      )}
      {!result.rows.length && (
        <p className="text-muted-foreground py-8 text-center">
          Chưa có dữ liệu phù hợp trong mục{" "}
          {CLASS_TABS[filters.tab].toLowerCase()}.
        </p>
      )}
      <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
        <p>
          {result.total} kết quả · Trang {filters.page + 1}/
          {Math.max(1, Math.ceil(result.total / 25))}
        </p>
        <div className="flex gap-3">
          {filters.page > 0 && (
            <Link href={href(filters.tab, filters.page - 1, filters.meeting)}>
              Trang trước
            </Link>
          )}
          {(filters.page + 1) * 25 < result.total && (
            <Link href={href(filters.tab, filters.page + 1, filters.meeting)}>
              Trang sau
            </Link>
          )}
        </div>
      </div>
    </NavigationContext.Provider>
  );
}
