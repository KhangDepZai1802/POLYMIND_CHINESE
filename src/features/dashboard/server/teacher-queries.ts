import "server-only";

import { fromZonedTime } from "date-fns-tz";

import { APP_TIMEZONE } from "@/lib/dates";
import { OPEN_ENROLLMENT_STATUSES } from "@/lib/domain/enrollment";
import { createClient } from "@/lib/supabase/server";

/**
 * Dashboard "Hôm nay" của giáo viên.
 *
 * KHÔNG có một dòng `where teacher_id = ...` nào ở đây, và đó là **cố ý**: RLS
 * đã khoanh phạm vi qua `class_teachers`. Cùng một câu query, admin thấy tất,
 * giáo viên chỉ thấy lớp mình dạy. Nếu tự lọc thêm ở app thì có hai nguồn sự
 * thật về quyền — và cái ở app là cái sẽ quên cập nhật.
 *
 * Hệ quả cần nhớ: giáo viên gọi thẳng Supabase từ DevTools cũng chỉ nhận được
 * đúng ngần này dữ liệu.
 */

function todayRangeUtc() {
  const nowVn = new Date(
    new Date().toLocaleString("en-US", { timeZone: APP_TIMEZONE }),
  );
  const y = nowVn.getFullYear();
  const m = String(nowVn.getMonth() + 1).padStart(2, "0");
  const d = String(nowVn.getDate()).padStart(2, "0");

  return {
    from: fromZonedTime(`${y}-${m}-${d}T00:00:00`, APP_TIMEZONE).toISOString(),
    to: fromZonedTime(`${y}-${m}-${d}T23:59:59`, APP_TIMEZONE).toISOString(),
  };
}

const SESSION_SELECT = `
  id, session_number, starts_at, ends_at, status, topic,
  class:classes (
    id, code, name,
    enrollments (id, status)
  ),
  attendance_records (id)
`;

type RawSession = {
  id: string;
  session_number: number;
  starts_at: string;
  ends_at: string;
  status: "scheduled" | "completed" | "cancelled" | "rescheduled";
  topic: string | null;
  class: {
    id: string;
    code: string;
    name: string;
    enrollments: { id: string; status: string }[];
  } | null;
  attendance_records: { id: string }[];
};

/**
 * Buổi học + tiến độ điểm danh.
 *
 * "Đã điểm danh" = số bản ghi điểm danh ≥ số học viên **đang mở** của lớp. Đếm
 * theo enrollment đang mở chứ không phải toàn bộ enrollment: học viên đã rút thì
 * không cần (và không nên) điểm danh.
 */
function withAttendanceProgress(rows: RawSession[]) {
  return rows.map((s) => {
    const expected = (s.class?.enrollments ?? []).filter((e) =>
      (OPEN_ENROLLMENT_STATUSES as readonly string[]).includes(e.status),
    ).length;
    const marked = s.attendance_records.length;

    return {
      id: s.id,
      sessionNumber: s.session_number,
      startsAt: s.starts_at,
      endsAt: s.ends_at,
      status: s.status,
      topic: s.topic,
      classId: s.class?.id ?? null,
      classCode: s.class?.code ?? "—",
      className: s.class?.name ?? "—",
      expected,
      marked,
      // Lớp chưa có học viên nào thì không thể "thiếu điểm danh".
      isFullyMarked: expected > 0 && marked >= expected,
    };
  });
}

/** Buổi dạy hôm nay (giờ VN), sớm nhất trước. */
export async function getTeacherSessionsToday() {
  const supabase = await createClient();
  const { from, to } = todayRangeUtc();

  const { data, error } = await supabase
    .from("class_sessions")
    .select(SESSION_SELECT)
    .gte("starts_at", from)
    .lte("starts_at", to)
    .neq("status", "cancelled")
    .order("starts_at");

  if (error) throw new Error(`Không tải được lịch dạy hôm nay: ${error.message}`);
  return withAttendanceProgress(data as RawSession[]);
}

/**
 * Buổi ĐÃ DIỄN RA nhưng chưa điểm danh xong — việc tồn đọng của giáo viên.
 *
 * Chỉ lấy buổi đã bắt đầu: buổi tương lai chưa điểm danh là chuyện bình thường,
 * đưa vào danh sách "cần làm" chỉ tạo nhiễu.
 */
export async function getSessionsNeedingAttendance(limit = 10) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_sessions")
    .select(SESSION_SELECT)
    .lt("starts_at", new Date().toISOString())
    .neq("status", "cancelled")
    .order("starts_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Không tải được buổi chưa điểm danh: ${error.message}`);
  }

  return withAttendanceProgress(data as RawSession[])
    .filter((s) => !s.isFullyMarked && s.expected > 0)
    .slice(0, limit);
}

/** Lượt bài tập/kỳ thi đang chờ chấm thủ công. */
export async function getPendingGrading(limit = 10) {
  const supabase = await createClient();
  const [exercises, exams] = await Promise.all([
    supabase
      .from("exercise_attempts")
      .select(`id,submitted_at,is_late,enrollment:enrollments(id,student:students(id,full_name,student_code)),delivery:exercise_deliveries(id,title)`)
      .eq("status", "pending_manual_grading")
      .order("submitted_at")
      .limit(limit),
    supabase
      .from("exam_attempts")
      .select(`id,submitted_at,enrollment:enrollments(id,student:students(id,full_name,student_code)),delivery:exam_deliveries(id,title)`)
      .eq("status", "pending_manual_grading")
      .order("submitted_at")
      .limit(limit),
  ]);
  if (exercises.error || exams.error) throw new Error(`Không tải được bài chờ chấm: ${exercises.error?.message ?? exams.error?.message}`);
  return [
    ...(exercises.data ?? []).map((row) => ({ ...row, kind: "exercise" as const })),
    ...(exams.data ?? []).map((row) => ({ ...row, kind: "exam" as const, is_late: false })),
  ].sort((a, b) => (a.submitted_at ?? "").localeCompare(b.submitted_at ?? "")).slice(0, limit);
}

/** Học viên cần chú ý — trong lớp mình dạy (RLS lo phần "của mình"). */
export async function getTeacherAtRiskStudents(limit = 6) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_at_risk_assessment_students")
    .select("*")
    .order("progress_percent", { nullsFirst: true })
    .limit(limit);

  if (error) {
    throw new Error(`Không tải được học viên cần chú ý: ${error.message}`);
  }
  return data;
}

/** Lớp mình dạy — để vào lớp trong 1 thao tác. */
export async function getMyClasses() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select("id, code, name, status, capacity, enrollments (id, status)")
    .in("status", ["planned", "active"])
    .order("code");

  if (error) throw new Error(`Không tải được lớp của bạn: ${error.message}`);

  return data.map((c) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    status: c.status,
    capacity: c.capacity,
    openCount: c.enrollments.filter((e) =>
      (OPEN_ENROLLMENT_STATUSES as readonly string[]).includes(e.status),
    ).length,
  }));
}
