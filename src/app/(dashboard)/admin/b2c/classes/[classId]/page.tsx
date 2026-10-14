import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { formatInTimeZone } from "date-fns-tz";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate, formatDateOnly, todayISO } from "@/lib/dates";
import { PageHeader } from "@/components/shared/page-header";
import { BackLink } from "@/components/shared/back-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CLASS_TABS,
  CLASS_WORKSPACE_PATH,
  MEETING_STATUSES,
  ATTENDANCE_STATUSES,
  classFiltersSchema,
  type ClassStudent,
  type ClassMeeting,
  type ClassComment,
  type ClassWorkspaceResult,
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
export const metadata = { title: "Chi tiết lớp B2C" };
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
const time = (v: string) =>
  formatInTimeZone(v, "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
export default async function ClassWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireManager(),
    { classId } = await params,
    query = await searchParams;
  if (!z.uuid().safeParse(classId).success) notFound();
  const parsed = classFiltersSchema.safeParse(query);
  if (!parsed.success)
    return (
      <>
        <PageHeader title="Chi tiết lớp" />
        <p role="alert">Bộ lọc không hợp lệ.</p>
        <Link href={`${CLASS_WORKSPACE_PATH}/${classId}`}>Xóa bộ lọc</Link>
      </>
    );
  const filters = parsed.data,
    client = await createClient(),
    base = `${CLASS_WORKSPACE_PATH}/${classId}`;
  const classResult = await client
    .from("b2c_classes")
    .select(
      "id,code,name,program_slug,teacher_name,weekdays_text,time_text,capacity,enrolled_count,start_date,campus,delivery_mode,notes",
    )
    .eq("id", classId)
    .maybeSingle();
  if (classResult.error) throw new Error("Không tải được lớp B2C.");
  if (!classResult.data) notFound();
  const cls = classResult.data;
  const schedules =
    filters.tab === "schedule"
      ? await client
          .from("b2c_class_schedules")
          .select("id,weekdays,start_time,end_time,room_name,date_from,date_to")
          .eq("class_id", classId)
          .order("date_from", { ascending: false })
          .limit(100)
      : null;
  if (schedules?.error) throw new Error("Không tải được lịch lặp.");
  const { data, error } = await client.rpc("read_b2c_class_workspace", {
    p_class_id: classId,
    p_tab: filters.tab,
    p_page: filters.page,
    p_query: filters.q,
    p_meeting_id: filters.meeting,
  });
  if (error)
    throw new Error(
      "Không tải được chi tiết lớp. Kiểm tra buổi học hoặc thử tải lại.",
    );
  const result = data as unknown as ClassWorkspaceResult<
      ClassStudent | ClassMeeting | ClassComment
    >,
    meeting = result.meeting ?? null,
    today = todayISO();
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
    <>
      <BackLink href={`/admin/b2c/${cls.program_slug}`} label={getB2CProgram(cls.program_slug)?.title ?? "Danh sách lớp"} />
      <PageHeader
        title={cls.name}
        description={`${cls.code} · ${cls.teacher_name ?? "Chưa phân công giáo viên"} · ${[cls.weekdays_text, cls.time_text].filter(Boolean).join(" · ") || "Chưa xếp lịch"}`}
      />
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
      <nav
        aria-label="Chi tiết lớp"
        className="mb-5 flex gap-2 overflow-x-auto pb-2"
      >
        {Object.entries(CLASS_TABS).map(([tab, label]) => (
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
      {["students", "attendance", "tuition"].includes(filters.tab) && (
        <form className="mb-4 flex gap-2">
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
          {!!schedules?.data?.length && (
            <section className="bg-card mb-5 rounded-xl border p-4">
              <h2 className="mb-3 font-semibold">Lịch lặp đã lưu</h2>
              <ul className="space-y-2 text-sm">
                {schedules.data.map((s) => (
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
                  <Button asChild variant="outline">
                    <Link href={href("attendance", 0, m.id)}>Mở điểm danh</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={href("comments", 0, m.id)}>Nhận xét buổi</Link>
                  </Button>
                  {!m.teaching_session_id && (
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
                          <TuitionPackageDialog
                            classId={classId}
                            row={{
                              ...s,
                              paid_amount: s.paid_amount ?? 0,
                              balance: s.balance ?? 0,
                            }}
                          />
                          <TuitionReceiptsDialog
                            classId={classId}
                            row={{
                              ...s,
                              paid_amount: s.paid_amount ?? 0,
                              balance: s.balance ?? 0,
                            }}
                            collector={actor.fullName}
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
                          <ClassCommentDialog
                            classId={classId}
                            student={s}
                            meeting={
                              meeting?.status !== "cancelled" ? meeting : null
                            }
                          />
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
            <Button asChild variant="outline">
              <Link
                href={href(meeting ? "attendance" : "students", 0, meeting?.id)}
              >
                Chọn học viên để thêm nhận xét
              </Link>
            </Button>
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
    </>
  );
}
