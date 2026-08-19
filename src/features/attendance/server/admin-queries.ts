import "server-only";

import {
  summarizeAttendance,
  type AttendanceStatus,
  type AttendanceSummary,
  type LearningPeriod,
} from "@/features/reports/learning";
import {
  getAttendanceForSessions,
  getPeriodSessions,
} from "@/features/reports/server/learning-queries";
import { OPEN_ENROLLMENT_STATUSES } from "@/lib/domain/enrollment";
import { createClient } from "@/lib/supabase/server";

/**
 * Dữ liệu cho tab "Điểm danh" của `/admin/reports` (`ADMIN-ATTENDANCE-1`).
 *
 * =============================================================================
 * KHÔNG CÓ MỘT DÒNG `where` NÀO VỀ QUYỀN
 * =============================================================================
 *
 * Cùng triết lý `learning-queries.ts`: phạm vi dữ liệu do RLS quyết. Hàm này
 * chạy cho super_admin và giáo vụ đều trả về mọi lớp (cả hai đều là
 * `app.is_manager()`); quyền SỬA thì hoàn toàn không nằm ở đây — nó nằm ở
 * `app.is_super_admin()` bên trong RPC `admin_override_attendance`.
 *
 * =============================================================================
 * 🔴 SĨ SỐ LẤY THEO ĐÚNG BỘ TRẠNG THÁI MÀ DB DÙNG
 * =============================================================================
 *
 * `OPEN_ENROLLMENT_STATUSES` = `pending|active|paused` — trùng khít vế
 * `e.status in ('pending','active','paused')` của `app.build_attendance_snapshot`
 * và của `app.session_attendance_complete`. Lấy rộng hơn (ví dụ "mọi trạng thái
 * trừ withdrawn/transferred" như tab Học tập) thì lưới hiện thêm người mà DB
 * không đòi điểm danh ⇒ cột nào cũng đọc là "còn thiếu" và không bao giờ đủ.
 */

export type AdminAttendanceCell = {
  status: AttendanceStatus;
  note: string | null;
};

export type AdminAttendanceSession = {
  id: string;
  sessionNumber: number;
  startsAt: string;
  topic: string | null;
  marked: number;
  /**
   * Buổi này đã có báo cáo giáo viên GỬI chưa.
   *
   * Ô của buổi đó phải mang dấu hiệu riêng trên lưới: sửa nó là dựng lại
   * `attendance_snapshot` của một bản báo cáo đã ký (`D-45` vế 2). Người bấm
   * cần biết điều đó TRƯỚC khi bấm, không phải sau.
   */
  hasSubmittedReport: boolean;
  reportId: string | null;
};

export type AdminAttendanceStudent = {
  enrollmentId: string;
  studentCode: string;
  fullName: string;
  summary: AttendanceSummary;
};

export type AdminAttendanceClass = {
  classId: string;
  code: string;
  name: string;
  teacherName: string;
  sessions: AdminAttendanceSession[];
  students: AdminAttendanceStudent[];
  /**
   * `${sessionId}:${enrollmentId}` → ô. Dùng object thường chứ KHÔNG dùng `Map`:
   * dữ liệu này đi từ Server Component sang Client Component, mà `Map` không
   * qua được ranh giới serialize của React.
   */
  cells: Record<string, AdminAttendanceCell>;
  /** Ô trống = buổi đã diễn ra mà chưa ai điểm danh. Đây là con số giáo vụ săn. */
  missingCells: number;
};

export type AdminAttendanceBoard = {
  classes: AdminAttendanceClass[];
  totals: {
    sessions: number;
    students: number;
    marked: number;
    /** Tổng số ô phải điền = Σ (buổi trong kỳ × sĩ số lớp đó). */
    expected: number;
    sessionsWithSubmittedReport: number;
  };
};

export async function getAdminAttendanceBoard(
  period: LearningPeriod,
): Promise<AdminAttendanceBoard> {
  const supabase = await createClient();

  const [classesResult, sessions] = await Promise.all([
    supabase
      .from("classes")
      .select("id, code, name")
      .not("status", "eq", "cancelled")
      .order("code"),
    getPeriodSessions(supabase, period),
  ]);

  if (classesResult.error) {
    throw new Error(`Không tải được danh sách lớp: ${classesResult.error.message}`);
  }

  const classRows = classesResult.data ?? [];
  const classIds = classRows.map((row) => row.id);
  if (classIds.length === 0) {
    return {
      classes: [],
      totals: {
        sessions: 0,
        students: 0,
        marked: 0,
        expected: 0,
        sessionsWithSubmittedReport: 0,
      },
    };
  }

  const sessionIds = sessions.map((session) => session.id);

  const [enrollmentsResult, teachersResult, profilesResult, reportsResult] =
    await Promise.all([
      supabase
        .from("enrollments")
        .select("id, class_id, student:students (student_code, full_name)")
        .in("class_id", classIds)
        .in("status", [...OPEN_ENROLLMENT_STATUSES]),
      supabase
        .from("class_teachers")
        .select("class_id, teacher:teachers (user_id)")
        .in("class_id", classIds),
      supabase.from("profiles").select("id, full_name"),
      sessionIds.length > 0
        ? supabase
            .from("session_reports")
            .select("id, session_id, status")
            .in("session_id", sessionIds)
        : Promise.resolve({ data: [], error: null } as const),
    ]);

  const failed = [
    enrollmentsResult,
    teachersResult,
    profilesResult,
    reportsResult,
  ].find((result) => result.error);
  if (failed?.error) {
    throw new Error(`Không tải được sổ điểm danh: ${failed.error.message}`);
  }

  const records = await getAttendanceForSessions(supabase, sessionIds);

  const nameByUser = new Map(
    (profilesResult.data ?? []).map((row) => [row.id, row.full_name]),
  );
  const teacherByClass = new Map<string, string>();
  for (const row of teachersResult.data ?? []) {
    if (!row.teacher) continue;
    teacherByClass.set(row.class_id, nameByUser.get(row.teacher.user_id) ?? "—");
  }

  const reportBySession = new Map(
    (reportsResult.data ?? []).map((row) => [row.session_id, row]),
  );

  const sessionsByClass = new Map<string, AdminAttendanceSession[]>();
  const markedBySession = new Map<string, number>();
  for (const record of records) {
    markedBySession.set(
      record.session_id,
      (markedBySession.get(record.session_id) ?? 0) + 1,
    );
  }

  for (const session of sessions) {
    const report = reportBySession.get(session.id);
    const submitted = report?.status === "submitted";
    const list = sessionsByClass.get(session.class_id) ?? [];
    list.push({
      id: session.id,
      sessionNumber: session.session_number,
      startsAt: session.starts_at,
      topic: session.topic,
      marked: markedBySession.get(session.id) ?? 0,
      hasSubmittedReport: submitted,
      reportId: submitted ? (report?.id ?? null) : null,
    });
    sessionsByClass.set(session.class_id, list);
  }

  const enrollmentsByClass = new Map<
    string,
    { enrollmentId: string; studentCode: string; fullName: string }[]
  >();
  for (const row of enrollmentsResult.data ?? []) {
    const list = enrollmentsByClass.get(row.class_id) ?? [];
    list.push({
      enrollmentId: row.id,
      studentCode: row.student?.student_code ?? "—",
      fullName: row.student?.full_name ?? "Học viên",
    });
    enrollmentsByClass.set(row.class_id, list);
  }

  const cellByKey = new Map<string, AdminAttendanceCell>();
  const statusesByEnrollment = new Map<string, AttendanceStatus[]>();
  for (const record of records) {
    cellByKey.set(`${record.session_id}:${record.enrollment_id}`, {
      status: record.status,
      note: record.note,
    });
    const list = statusesByEnrollment.get(record.enrollment_id) ?? [];
    list.push(record.status);
    statusesByEnrollment.set(record.enrollment_id, list);
  }

  const classes: AdminAttendanceClass[] = [];
  const totals = {
    sessions: 0,
    students: 0,
    marked: 0,
    expected: 0,
    sessionsWithSubmittedReport: 0,
  };

  for (const row of classRows) {
    const classSessions = sessionsByClass.get(row.id) ?? [];
    const roster = (enrollmentsByClass.get(row.id) ?? []).sort((a, b) =>
      a.fullName.localeCompare(b.fullName, "vi"),
    );

    // Lớp không có buổi nào trong kỳ VÀ không có học viên nào thì bỏ hẳn —
    // một mục rỗng chỉ làm dài danh sách. Còn lớp có học viên mà chưa có buổi
    // thì GIỮ: đó là thông tin thật ("kỳ này lớp chưa học buổi nào").
    if (classSessions.length === 0 && roster.length === 0) continue;

    const cells: Record<string, AdminAttendanceCell> = {};
    let missingCells = 0;
    for (const session of classSessions) {
      for (const student of roster) {
        const key = `${session.id}:${student.enrollmentId}`;
        const cell = cellByKey.get(key);
        if (cell) cells[key] = cell;
        else missingCells += 1;
      }
    }

    const students: AdminAttendanceStudent[] = roster.map((student) => ({
      ...student,
      summary: summarizeAttendance(
        // CHỈ đếm các buổi thuộc kỳ đang xem. `statusesByEnrollment` gom theo
        // học viên nên đã đúng phạm vi kỳ, nhưng lọc lại theo đúng danh sách
        // buổi của lớp để một ghi danh bị chuyển lớp không kéo theo số của lớp cũ.
        classSessions
          .map((session) => cells[`${session.id}:${student.enrollmentId}`]?.status)
          .filter((status): status is AttendanceStatus => Boolean(status)),
        classSessions.length,
      ),
    }));

    const submittedCount = classSessions.filter(
      (session) => session.hasSubmittedReport,
    ).length;

    classes.push({
      classId: row.id,
      code: row.code,
      name: row.name,
      teacherName: teacherByClass.get(row.id) ?? "—",
      sessions: classSessions,
      students,
      cells,
      missingCells,
    });

    totals.sessions += classSessions.length;
    totals.students += roster.length;
    totals.expected += classSessions.length * roster.length;
    totals.marked += classSessions.length * roster.length - missingCells;
    totals.sessionsWithSubmittedReport += submittedCount;
  }

  return { classes, totals };
}
