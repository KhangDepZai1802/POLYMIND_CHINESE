import "server-only";

import { OPEN_ENROLLMENT_STATUSES } from "@/lib/domain/enrollment";
import { formatDate, formatTime } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/supabase/signed-urls";

import {
  emptySessionReportForm,
  getReportCompletion,
  type ReportStudentEntry,
  type SessionReportForm,
} from "../domain/completion";
import {
  EVIDENCE_BUCKET,
  EVIDENCE_URL_TTL_SECONDS,
  evidenceFileName,
} from "../domain/evidence";
import type { ReportForRender } from "../domain/render";
import type { TeacherReportFilters } from "../schema";

/**
 * Buổi được coi là ĐÃ DẠY khi đã qua giờ bắt đầu và không bị huỷ.
 *
 * Dùng chung cho hàng đợi của giáo viên và bảng của giáo vụ — hai bên phải đếm
 * cùng một tập buổi, nếu không giáo vụ đòi báo cáo một buổi mà giáo viên không
 * hề thấy trong danh sách của mình.
 */
function taughtSessionFilter() {
  return { before: new Date().toISOString() };
}

export type ReportQueueItem = {
  sessionId: string;
  sessionNumber: number;
  startsAt: string;
  endsAt: string;
  classId: string;
  classCode: string;
  className: string;
  /** Đã điểm danh mấy trên tổng bao nhiêu. */
  marked: number;
  expected: number;
  attendanceDone: boolean;
  reportStatus: "none" | "draft" | "submitted";
  /** Số mục đã xong của bản nháp — null khi chưa có bản nháp. */
  draftDone: number | null;
  /** Số ngày kể từ lúc dạy xong; dùng để tô "quá hạn". */
  daysSince: number;
  /**
   * Giáo vụ đã đánh dấu buổi này KHÔNG CẦN báo cáo (`TEACHER-REPORT-5`).
   *
   * Nút bấm chỉ ở trang giáo vụ, nhưng cờ phải tới ĐƯỢC hàng đợi của giáo viên:
   * không thì ba buổi user vừa miễn vẫn nằm đó với nhãn *"quá hạn 13 ngày"*, tức
   * cái nút không làm được đúng việc nó nói.
   */
  reportWaived: boolean;
  /** Lý do miễn, để giáo viên biết vì sao buổi rời khỏi việc phải làm. */
  waiveReason: string | null;
};

const OVERDUE_DAYS = 2;

export function isOverdue(item: ReportQueueItem): boolean {
  return (
    item.reportStatus !== "submitted" &&
    // Buổi đã miễn KHÔNG bao giờ quá hạn — không còn hạn nào để quá.
    !item.reportWaived &&
    item.daysSince >= OVERDUE_DAYS
  );
}

/**
 * Hàng đợi báo cáo của GIÁO VIÊN đang đăng nhập.
 *
 * Không kiểm "lớp này có phải của tôi không" ở đây — RLS lo. Giáo viên chỉ đọc
 * được `class_sessions` của lớp mình dạy, nên câu truy vấn này tự thu hẹp.
 */
export async function getTeacherReportQueue(): Promise<ReportQueueItem[]> {
  const supabase = await createClient();
  const { before } = taughtSessionFilter();

  const { data: sessions, error } = await supabase
    .from("class_sessions")
    .select(
      `id, session_number, starts_at, ends_at, class_id,
       report_waived_at, report_waive_reason,
       class:classes (id, code, name)`,
    )
    .lt("starts_at", before)
    .neq("status", "cancelled")
    .order("starts_at", { ascending: false })
    .limit(60);

  if (error) {
    throw new Error(`Không tải được danh sách buổi cần báo cáo: ${error.message}`);
  }
  if (!sessions?.length) return [];

  return buildQueue(supabase, sessions);
}

type RawSession = {
  id: string;
  session_number: number;
  starts_at: string;
  ends_at: string;
  class_id: string;
  /** `TEACHER-REPORT-5` — null = vẫn cần báo cáo. */
  report_waived_at?: string | null;
  report_waive_reason?: string | null;
  class: { id: string; code: string; name: string } | null;
};

async function buildQueue(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessions: RawSession[],
): Promise<ReportQueueItem[]> {
  const sessionIds = sessions.map((s) => s.id);
  const classIds = [...new Set(sessions.map((s) => s.class_id))];

  const [enrollments, records, reports] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id, class_id")
      .in("class_id", classIds)
      .in("status", [...OPEN_ENROLLMENT_STATUSES]),
    supabase
      .from("attendance_records")
      .select("session_id, enrollment_id")
      .in("session_id", sessionIds),
    supabase
      .from("session_reports")
      .select("session_id, status")
      .in("session_id", sessionIds),
  ]);

  if (enrollments.error || records.error || reports.error) {
    // 🔴 KHÔNG nuốt lỗi thành "không có buổi nào". Một sự cố vận hành đội lốt
    // trạng thái rỗng hợp lệ là đúng cái bẫy đã dính ở `VIDEO-1`.
    throw new Error(
      `Không tải được tiến độ báo cáo: ${
        enrollments.error?.message ?? records.error?.message ?? reports.error?.message
      }`,
    );
  }

  const expectedByClass = new Map<string, number>();
  for (const row of enrollments.data ?? []) {
    expectedByClass.set(row.class_id, (expectedByClass.get(row.class_id) ?? 0) + 1);
  }

  const markedBySession = new Map<string, number>();
  for (const row of records.data ?? []) {
    markedBySession.set(row.session_id, (markedBySession.get(row.session_id) ?? 0) + 1);
  }

  const reportBySession = new Map(
    (reports.data ?? []).map((row) => [row.session_id, row.status]),
  );

  const now = Date.now();

  return sessions.map((session) => {
    const expected = expectedByClass.get(session.class_id) ?? 0;
    const marked = markedBySession.get(session.id) ?? 0;
    const status = reportBySession.get(session.id);

    return {
      sessionId: session.id,
      sessionNumber: session.session_number,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      classId: session.class_id,
      classCode: session.class?.code ?? "—",
      className: session.class?.name ?? "Lớp",
      marked,
      expected,
      // Lớp rỗng (0 ghi danh mở) KHÔNG được coi là đã điểm danh xong — cùng
      // luật với `app.session_attendance_complete()` dưới DB.
      attendanceDone: expected > 0 && marked >= expected,
      reportStatus: status === "submitted" ? "submitted" : status === "draft" ? "draft" : "none",
      draftDone: null,
      daysSince: Math.floor((now - new Date(session.ends_at).getTime()) / 86_400_000),
      reportWaived: Boolean(session.report_waived_at),
      waiveReason: session.report_waive_reason ?? null,
    };
  });
}

// =============================================================================
// Dữ liệu cho biểu mẫu
// =============================================================================

export type AttendanceLine = {
  enrollmentId: string;
  studentCode: string;
  fullName: string;
  status: "present" | "late" | "absent" | "excused";
  note: string;
};

export type SessionReportEditorData = {
  session: {
    id: string;
    sessionNumber: number;
    startsAt: string;
    endsAt: string;
    classId: string;
    classCode: string;
    className: string;
    courseId: string;
    teacherName: string;
    lessonId: string | null;
    lessonLog: string;
    teacherNote: string;
  };
  attendance: {
    rosterSize: number;
    present: number;
    late: number;
    absent: number;
    excused: number;
    marked: number;
    /** Chỉ những người KHÔNG có mặt đầy đủ — đó là những dòng cần lý do. */
    lines: AttendanceLine[];
    complete: boolean;
  };
  roster: { enrollmentId: string; studentCode: string; fullName: string }[];
  report: {
    id: string | null;
    status: "draft" | "submitted";
    form: SessionReportForm;
    students: ReportStudentEntry[];
    evidence: { id: string; storagePath: string; bytes: number }[];
    submittedAt: string | null;
  };
};

/** `null` khi RLS không cho đọc ⇒ trang trả 404. Không có lớp kiểm quyền ở app. */
export async function getSessionReportEditorData(
  sessionId: string,
): Promise<SessionReportEditorData | null> {
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("class_sessions")
    .select(
      `id, session_number, starts_at, ends_at, class_id, lesson_id, lesson_log, teacher_note,
       class:classes (id, code, name, course_id)`,
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw new Error(`Không tải được buổi học: ${error.message}`);
  if (!session?.class) return null;

  const [enrollmentsRes, recordsRes, reportRes, teacherRes] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id, student:students (id, student_code, full_name)")
      .eq("class_id", session.class_id)
      .in("status", [...OPEN_ENROLLMENT_STATUSES]),
    supabase
      .from("attendance_records")
      .select("enrollment_id, status, note")
      .eq("session_id", sessionId),
    supabase
      .from("session_reports")
      .select(
        `*, students:session_report_students (category, enrollment_id, note),
         evidence:session_report_evidence (id, storage_path, bytes)`,
      )
      .eq("session_id", sessionId)
      .maybeSingle(),
    supabase
      .from("class_teachers")
      .select("teacher:teachers (profile:profiles (full_name))")
      .eq("class_id", session.class_id)
      .limit(1)
      .maybeSingle(),
  ]);

  if (enrollmentsRes.error || recordsRes.error || reportRes.error) {
    throw new Error(
      `Không tải được dữ liệu báo cáo: ${
        enrollmentsRes.error?.message ??
        recordsRes.error?.message ??
        reportRes.error?.message
      }`,
    );
  }

  const recordByEnrollment = new Map(
    (recordsRes.data ?? []).map((row) => [row.enrollment_id, row]),
  );

  const roster = (enrollmentsRes.data ?? [])
    .map((row) => ({
      enrollmentId: row.id,
      studentCode: row.student?.student_code ?? "—",
      fullName: row.student?.full_name ?? "Học viên",
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "vi"));

  const lines: AttendanceLine[] = [];
  let present = 0;
  let late = 0;
  let absent = 0;
  let excused = 0;

  for (const person of roster) {
    const record = recordByEnrollment.get(person.enrollmentId);
    if (!record?.status) continue;

    if (record.status === "present") present += 1;
    else if (record.status === "late") late += 1;
    else if (record.status === "absent") absent += 1;
    else if (record.status === "excused") excused += 1;

    // Chỉ người KHÔNG "có mặt" mới cần một dòng lý do. 15 người đi đủ không cần
    // dòng nào — bắt giáo viên cuộn qua 20 ô trống là thiết kế tồi.
    if (record.status !== "present") {
      lines.push({
        enrollmentId: person.enrollmentId,
        studentCode: person.studentCode,
        fullName: person.fullName,
        status: record.status,
        note: record.note ?? "",
      });
    }
  }

  const marked = present + late + absent + excused;
  const row = reportRes.data;

  return {
    session: {
      id: session.id,
      sessionNumber: session.session_number,
      startsAt: session.starts_at,
      endsAt: session.ends_at,
      classId: session.class_id,
      classCode: session.class.code,
      className: session.class.name,
      courseId: session.class.course_id,
      teacherName: teacherRes.data?.teacher?.profile?.full_name ?? "—",
      lessonId: session.lesson_id,
      lessonLog: session.lesson_log ?? "",
      teacherNote: session.teacher_note ?? "",
    },
    attendance: {
      rosterSize: roster.length,
      present,
      late,
      absent,
      excused,
      marked,
      lines,
      complete: roster.length > 0 && marked >= roster.length,
    },
    roster,
    report: {
      id: row?.id ?? null,
      status: row?.status === "submitted" ? "submitted" : "draft",
      form: rowToForm(row),
      students: (row?.students ?? []).map((item) => ({
        category: item.category,
        enrollment_id: item.enrollment_id,
        note: item.note ?? "",
      })) as ReportStudentEntry[],
      evidence: (row?.evidence ?? []).map((item) => ({
        id: item.id,
        storagePath: item.storage_path,
        bytes: item.bytes,
      })),
      submittedAt: row?.submitted_at ?? null,
    },
  };
}

type ReportRow = Record<string, unknown> | null | undefined;

/** Hàng DB → hình dạng biểu mẫu. Thiếu hàng ⇒ biểu mẫu rỗng. */
function rowToForm(row: ReportRow): SessionReportForm {
  const base = emptySessionReportForm();
  if (!row) return base;

  const pick = <T>(key: string, fallback: T): T =>
    (row[key] ?? fallback) as T;

  return {
    ...base,
    mode: pick("mode", null),
    topic: pick("topic", "") ?? "",
    lesson_title: pick("lesson_title", "") ?? "",
    plan_completion: pick("plan_completion", null),
    has_unfinished: pick("has_unfinished", false) ?? false,
    unfinished_content: pick("unfinished_content", "") ?? "",
    unfinished_reason: pick("unfinished_reason", "") ?? "",
    has_homework: pick("has_homework", false) ?? false,
    homework_assigned: pick("homework_assigned", "") ?? "",
    comprehension_level: pick("comprehension_level", null),
    interaction_level: pick("interaction_level", null),
    focus_level: pick("focus_level", null),
    homework_completion: pick("homework_completion", null),
    no_students_of_note: pick("no_students_of_note", false) ?? false,
    has_issue: pick("has_issue", null),
    issue_categories: pick("issue_categories", []) ?? [],
    issue_other: pick("issue_other", "") ?? "",
    issue_description: pick("issue_description", "") ?? "",
    issue_impact: pick("issue_impact", null),
    issue_severity: pick("issue_severity", null),
    next_content: pick("next_content", "") ?? "",
    review_content: pick("review_content", "") ?? "",
    teacher_watch_note: pick("teacher_watch_note", "") ?? "",
    needs_support: pick("needs_support", false) ?? false,
    support_request: pick("support_request", "") ?? "",
    evidence_kinds: pick("evidence_kinds", []) ?? [],
    overall_rating: pick("overall_rating", null),
    closing_note: pick("closing_note", "") ?? "",
    confirmed: pick("confirmed", false) ?? false,
  };
}

/** Tính tiến độ 9 mục từ dữ liệu đã tải — dùng ở cả trang danh sách lẫn biểu mẫu. */
export function completionOf(data: SessionReportEditorData) {
  return getReportCompletion({
    form: data.report.form,
    lesson: { lessonLog: data.session.lessonLog },
    students: data.report.students,
    evidenceCount: data.report.evidence.length,
  });
}

// =============================================================================
// Phía giáo vụ
// =============================================================================

export type AdminReportRow = {
  sessionId: string;
  reportId: string | null;
  sessionNumber: number;
  startsAt: string;
  classId: string;
  classCode: string;
  className: string;
  teacherName: string;
  topic: string | null;
  comprehension: number | null;
  interaction: number | null;
  focus: number | null;
  hasIssue: boolean | null;
  issueSeverity: string | null;
  overallRating: string | null;
  /**
   * `waived` = giáo vụ đã đánh dấu KHÔNG CẦN báo cáo (`TEACHER-REPORT-5`).
   *
   * Là trạng thái thứ BA chứ không phải một biến thể của `missing`: buổi đã miễn
   * không được đếm vào nợ, không lên khối cảnh báo đỏ, và không bị nhắc.
   */
  status: "submitted" | "missing" | "waived";
  attendanceDone: boolean;
  marked: number;
  expected: number;
  daysSince: number;
  /** Lý do miễn — hiện ngay trên hàng để giáo vụ khác biết vì sao. */
  waiveReason: string | null;
};

export type AdminTeacherReportData = {
  rows: AdminReportRow[];
  stats: {
    taught: number;
    submitted: number;
    missing: number;
    /** Số buổi đã miễn trong kỳ — mẫu số của tỉ lệ "đã có báo cáo" phải trừ ra. */
    waived: number;
    avgComprehension: number | null;
  };
  attention: AdminReportRow[];
};

/**
 * Bảng "Báo cáo của giáo viên" cho giáo vụ.
 *
 * ⚠️ Bộ lọc kỳ ĐƯỢC ÁP Ở ĐÂY và cũng chính là bộ lọc mà nút xuất file dùng —
 * `BUG_M16_01` ở hệ cũ là ca export bỏ qua khoảng ngày đang chọn.
 */
export async function getAdminTeacherReports(
  filters: TeacherReportFilters & { from?: string; to?: string },
): Promise<AdminTeacherReportData> {
  const supabase = await createClient();

  let query = supabase
    .from("class_sessions")
    .select(
      `id, session_number, starts_at, ends_at, class_id,
       report_waived_at, report_waive_reason,
       class:classes (id, code, name),
       report:session_reports (
         id, status, topic, comprehension_level, interaction_level, focus_level,
         has_issue, issue_severity, overall_rating, submitted_by
       )`,
    )
    .lt("starts_at", new Date().toISOString())
    .neq("status", "cancelled")
    .order("starts_at", { ascending: false })
    .limit(500);

  if (filters.from) query = query.gte("starts_at", `${filters.from}T00:00:00Z`);
  if (filters.to) query = query.lte("starts_at", `${filters.to}T23:59:59Z`);
  if (filters.class) query = query.eq("class_id", filters.class);

  const { data, error } = await query;
  if (error) {
    throw new Error(`Không tải được báo cáo của giáo viên: ${error.message}`);
  }

  const sessions = (data ?? []) as unknown as (RawSession & {
    report: Record<string, unknown> | null;
  })[];

  const classIds = [...new Set(sessions.map((s) => s.class_id))];
  const sessionIds = sessions.map((s) => s.id);

  const [enrollments, records, teachers, profiles] = await Promise.all([
    supabase
      .from("enrollments")
      .select("id, class_id")
      .in("class_id", classIds)
      .in("status", [...OPEN_ENROLLMENT_STATUSES]),
    supabase
      .from("attendance_records")
      .select("session_id, enrollment_id")
      .in("session_id", sessionIds),
    supabase
      .from("class_teachers")
      .select("class_id, teacher:teachers (id, user_id)")
      .in("class_id", classIds),
    supabase.from("profiles").select("id, full_name"),
  ]);

  if (enrollments.error || records.error || teachers.error || profiles.error) {
    throw new Error(
      `Không tải được dữ liệu phụ trợ báo cáo: ${
        enrollments.error?.message ??
        records.error?.message ??
        teachers.error?.message ??
        profiles.error?.message
      }`,
    );
  }

  const nameByUser = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]));
  const teacherByClass = new Map<string, { id: string; name: string }>();
  for (const row of teachers.data ?? []) {
    if (!row.teacher) continue;
    teacherByClass.set(row.class_id, {
      id: row.teacher.id,
      name: nameByUser.get(row.teacher.user_id) ?? "—",
    });
  }

  const expectedByClass = new Map<string, number>();
  for (const row of enrollments.data ?? []) {
    expectedByClass.set(row.class_id, (expectedByClass.get(row.class_id) ?? 0) + 1);
  }
  const markedBySession = new Map<string, number>();
  for (const row of records.data ?? []) {
    markedBySession.set(row.session_id, (markedBySession.get(row.session_id) ?? 0) + 1);
  }

  const now = Date.now();

  let rows: AdminReportRow[] = sessions.map((session) => {
    const report = session.report as Record<string, unknown> | null;
    const teacher = teacherByClass.get(session.class_id);
    const expected = expectedByClass.get(session.class_id) ?? 0;
    const marked = markedBySession.get(session.id) ?? 0;
    const submitted = report?.status === "submitted";

    return {
      sessionId: session.id,
      reportId: submitted ? ((report?.id as string) ?? null) : null,
      sessionNumber: session.session_number,
      startsAt: session.starts_at,
      classId: session.class_id,
      classCode: session.class?.code ?? "—",
      className: session.class?.name ?? "Lớp",
      teacherName: teacher?.name ?? "—",
      topic: submitted ? ((report?.topic as string) ?? null) : null,
      comprehension: submitted ? ((report?.comprehension_level as number) ?? null) : null,
      interaction: submitted ? ((report?.interaction_level as number) ?? null) : null,
      focus: submitted ? ((report?.focus_level as number) ?? null) : null,
      hasIssue: submitted ? ((report?.has_issue as boolean) ?? null) : null,
      issueSeverity: submitted ? ((report?.issue_severity as string) ?? null) : null,
      overallRating: submitted ? ((report?.overall_rating as string) ?? null) : null,
      // Thứ tự CÓ CHỦ ĐÍCH: báo cáo đã gửi thắng cờ miễn. Một buổi vừa có báo cáo
      // đã ký vừa mang nhãn "không cần báo cáo" thì bản đã ký mới là sự thật —
      // RPC cũng chặn chiều còn lại (không miễn được buổi đã gửi).
      status: submitted ? "submitted" : session.report_waived_at ? "waived" : "missing",
      attendanceDone: expected > 0 && marked >= expected,
      marked,
      expected,
      daysSince: Math.floor((now - new Date(session.ends_at).getTime()) / 86_400_000),
      waiveReason: session.report_waive_reason ?? null,
    };
  });

  if (filters.teacher) {
    const wanted = filters.teacher;
    const classesOfTeacher = new Set(
      [...teacherByClass.entries()]
        .filter(([, teacher]) => teacher.id === wanted)
        .map(([classId]) => classId),
    );
    rows = rows.filter((row) => classesOfTeacher.has(row.classId));
  }

  // Cần chú ý = mức xử lý CAO, hoặc đánh giá chung "Chưa đạt". Đây mới là lý do
  // giáo vụ mở trang này, nên nó phải nổi lên trước mọi con số thống kê.
  const attention = rows.filter(
    (row) =>
      row.status === "submitted" &&
      (row.issueSeverity === "high" || row.overallRating === "unsatisfactory"),
  );

  if (filters.state === "submitted") rows = rows.filter((r) => r.status === "submitted");
  if (filters.state === "missing") rows = rows.filter((r) => r.status === "missing");
  if (filters.state === "waived") rows = rows.filter((r) => r.status === "waived");
  if (filters.state === "attention") rows = attention;

  const submittedRows = rows.filter((r) => r.status === "submitted");
  const scores = submittedRows
    .map((r) => r.comprehension)
    .filter((value): value is number => value !== null);

  return {
    rows,
    stats: {
      taught: rows.length,
      submitted: submittedRows.length,
      missing: rows.filter((r) => r.status === "missing").length,
      waived: rows.filter((r) => r.status === "waived").length,
      avgComprehension: scores.length
        ? scores.reduce((sum, value) => sum + value, 0) / scores.length
        : null,
    },
    attention,
  };
}

/**
 * Con số đỏ trên tab — đếm TOÀN BỘ nợ, KHÔNG theo kỳ đang lọc.
 *
 * 🔴 Chạy theo bộ lọc thì đổi sang tháng khác là nợ biến mất khỏi màn hình —
 * đúng thứ không được phép giấu. Trần 200 để câu truy vấn không phình; UI hiện
 * `99+` khi vượt.
 */
export async function getMissingReportCount(): Promise<number> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_sessions")
    .select("id, report:session_reports (status)")
    .lt("starts_at", new Date().toISOString())
    .neq("status", "cancelled")
    // Buổi đã miễn KHÔNG còn là nợ ⇒ không nằm trong con số đỏ trên tab
    // (`TEACHER-REPORT-5`). Lọc ở DB chứ không ở app: `limit(200)` cắt trước khi
    // app kịp lọc, nên lọc muộn là badge đếm thiếu ở trung tâm nhiều buổi.
    .is("report_waived_at", null)
    .limit(200);

  if (error) {
    // Badge hỏng KHÔNG được làm sập cả trang Báo cáo. Trả 0 và để phần còn lại
    // của trang chạy — nhưng chỉ ở đây, vì badge là thông tin phụ.
    console.error("[session-reports] không đếm được báo cáo còn thiếu:", error.message);
    return 0;
  }

  return (data ?? []).filter((row) => {
    const report = row.report as { status?: string } | null;
    return report?.status !== "submitted";
  }).length;
}

/**
 * Báo cáo ĐẦY ĐỦ để dựng bản in / bản DOCX.
 *
 * 🔴 Nhận đúng bộ lọc mà bảng trên màn hình đang dùng. Bản cũ ở hệ XKLĐ bỏ qua
 * khoảng ngày đang chọn nên file luôn ra toàn kỳ (`BUG_M16_01`) — đó là lý do
 * hàm này KHÔNG có đường tắt "lấy tất cả".
 */
export async function getReportsForExport(
  filters: TeacherReportFilters & { from?: string; to?: string },
): Promise<ReportForRender[]> {
  const supabase = await createClient();

  let query = supabase
    .from("session_reports")
    .select(
      `*,
       students:session_report_students (category, enrollment_id, note),
       evidence:session_report_evidence (id, storage_path, bytes),
       session:class_sessions (
         session_number, starts_at, ends_at, lesson_log, teacher_note,
         lesson:lessons (title),
         class:classes (code, name)
       )`,
    )
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (filters.class) query = query.eq("class_id", filters.class);

  const { data, error } = await query;
  if (error) throw new Error(`Không tải được báo cáo để xuất file: ${error.message}`);

  const rows = (data ?? []) as unknown as ExportRow[];

  // Lọc theo kỳ ở app chứ không ở query: `starts_at` nằm trên bảng con nên
  // PostgREST không lọc trực tiếp được. Số lượng đã bị chặn ở `limit(200)`.
  const inPeriod = rows.filter((row) => {
    const startsAt = row.session?.starts_at;
    if (!startsAt) return false;
    const day = startsAt.slice(0, 10);
    if (filters.from && day < filters.from) return false;
    if (filters.to && day > filters.to) return false;
    return true;
  });

  // Tên học viên lấy một lượt cho cả lô thay vì mỗi báo cáo một vòng.
  const enrollmentIds = [
    ...new Set(inPeriod.flatMap((row) => (row.students ?? []).map((s) => s.enrollment_id))),
  ];

  const nameByEnrollment = new Map<string, string>();
  if (enrollmentIds.length > 0) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("id, student:students (full_name)")
      .in("id", enrollmentIds);

    for (const row of enrollments ?? []) {
      nameByEnrollment.set(row.id, row.student?.full_name ?? "Học viên");
    }
  }

  const teacherName = await resolveTeacherNames(supabase, inPeriod);

  /*
   * Ký URL ảnh minh chứng cho CẢ LÔ trong một request (`signPaths`).
   *
   * 🔴 Ký ở đây chứ không ở từng bề mặt: bản xem, bản in và bản DOCX cùng đi qua
   * hàm này, nên ký một chỗ là ba nơi cùng có ảnh. Path nào ký hỏng thì rơi khỏi
   * Map và `url` thành `null` — bề mặt hiện tên tệp thay cho ảnh, chứ không phát
   * ra một `<img src="">` gãy.
   */
  const evidenceUrls = await signPaths(
    supabase,
    EVIDENCE_BUCKET,
    inPeriod.flatMap((row) => (row.evidence ?? []).map((item) => item.storage_path)),
    EVIDENCE_URL_TTL_SECONDS,
  );

  return inPeriod.map((row) => ({
    session: {
      classCode: row.session?.class?.code ?? "—",
      className: row.session?.class?.name ?? "—",
      teacherName: teacherName.get(row.submitted_by ?? "") ?? "—",
      startsAt: formatDate(row.session?.starts_at ?? null),
      // Mốc THẬT đi cùng ba chuỗi đã định dạng — tên file PDF đọc từ đây.
      startsAtISO: row.session?.starts_at ?? null,
      // `formatTime` chứ KHÔNG `formatDate`: dòng "Thời gian" của mục 1 cần giờ
      // bắt đầu, không phải ngày (xem chú thích ở `ReportForRender.startTime`).
      startTime: formatTime(row.session?.starts_at ?? null),
      endsAt: formatTime(row.session?.ends_at ?? null),
      sessionNumber: row.session?.session_number ?? 0,
      // `TEACHER-REPORT-2`: "Bài học đã dạy" đọc từ chữ giáo viên gõ trong
      // BÁO CÁO. `row.session.lesson.title` chỉ còn là dự phòng cho các báo cáo
      // đã gửi TRƯỚC đợt này — hồi đó ô ấy là dropdown chọn từ giáo trình, và
      // bản in của một báo cáo cũ không được phép trống đi.
      lessonTitle:
        (row.lesson_title as string | null) ?? row.session?.lesson?.title ?? null,
      lessonLog: row.session?.lesson_log ?? null,
      teacherNote: row.session?.teacher_note ?? null,
    },
    report: row as unknown as Record<string, unknown>,
    students: (row.students ?? []).map((item) => ({
      category: item.category,
      fullName: nameByEnrollment.get(item.enrollment_id) ?? "Học viên",
      note: item.note,
    })),
    evidence: (row.evidence ?? []).map((item) => ({
      id: item.id,
      fileName: evidenceFileName(item.storage_path),
      bytes: item.bytes,
      storagePath: item.storage_path,
      url: evidenceUrls.get(item.storage_path) ?? null,
    })),
    snapshot: row.attendance_snapshot ?? null,
  }));
}

type ExportRow = {
  id: string;
  submitted_by: string | null;
  /** `TEACHER-REPORT-2` — chữ giáo viên tự gõ ở mục 3. `select("*")` đã kéo về. */
  lesson_title: string | null;
  attendance_snapshot: ReportForRender["snapshot"];
  students: { category: string; enrollment_id: string; note: string | null }[] | null;
  evidence: { id: string; storage_path: string; bytes: number }[] | null;
  session: {
    session_number: number;
    starts_at: string;
    ends_at: string;
    lesson_log: string | null;
    teacher_note: string | null;
    lesson: { title: string } | null;
    class: { code: string; name: string } | null;
  } | null;
};

async function resolveTeacherNames(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: ExportRow[],
): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((row) => row.submitted_by).filter(Boolean))] as string[];
  if (ids.length === 0) return new Map();

  const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  return new Map((data ?? []).map((row) => [row.id, row.full_name]));
}

/** Một báo cáo, cho trang chi tiết của giáo vụ. */
export async function getReportForRender(
  reportId: string,
): Promise<ReportForRender | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_reports")
    .select("class_id")
    .eq("id", reportId)
    .maybeSingle();

  if (error) throw new Error(`Không tải được báo cáo: ${error.message}`);
  if (!data) return null;

  const all = await getReportsForExport({ class: data.class_id });
  return all.find((item) => (item.report as { id?: string }).id === reportId) ?? null;
}

/**
 * Một báo cáo ĐÃ GỬI, tra theo buổi học — cho bản in của GIÁO VIÊN
 * (`TEACHER-REPORT-5`, nút *"Xuất báo cáo"*).
 *
 * 🔴 Tra theo `session_id` chứ không `report_id` vì mọi URL bên giáo viên đã đi
 * theo buổi (`/teacher/reports/[sessionId]`); bắt trang đó tự đi tìm `reportId`
 * trước là thêm một vòng truy vấn và một đường 404 nữa cho cùng một thứ.
 *
 * ⛔ Chỉ trả báo cáo **đã gửi**. Bản nháp không phải tài liệu để xuất ra ngoài —
 * in một bản nháp rồi gửi phụ huynh là chuyện không có đường lùi. Không kiểm
 * "buổi này của tôi không" ở đây: RLS lo (`app.can_read_session_report`).
 */
export async function getReportForRenderBySession(
  sessionId: string,
): Promise<ReportForRender | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_reports")
    .select("id, class_id, status")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw new Error(`Không tải được báo cáo: ${error.message}`);
  if (!data || data.status !== "submitted") return null;

  const all = await getReportsForExport({ class: data.class_id });
  return all.find((item) => (item.report as { id?: string }).id === data.id) ?? null;
}
