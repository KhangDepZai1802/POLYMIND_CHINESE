import "server-only";

import { OPEN_ENROLLMENT_STATUSES } from "@/lib/domain/enrollment";
import { createClient } from "@/lib/supabase/server";

/**
 * Danh sách điểm danh của MỘT buổi.
 *
 * Không kiểm "giáo viên này có dạy lớp đó không" ở đây: RLS đã lo. Giáo viên mở
 * `?session=<id>` của lớp người khác thì query trả `null` → trang 404. Đoán được
 * URL cũng không lấy được gì.
 */
export async function getAttendanceSheet(sessionId: string) {
  const supabase = await createClient();

  const { data: session, error } = await supabase
    .from("class_sessions")
    .select(
      `id, session_number, starts_at, ends_at, status, topic,
       class:classes (id, code, name)`,
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw new Error(`Không tải được buổi học: ${error.message}`);
  if (!session || !session.class) return null;

  // CHỈ điểm danh học viên có ghi danh ĐANG MỞ. Học viên đã rút/hoàn thành thì
  // không còn thuộc lớp — điểm danh họ là ghi dữ liệu sai vào lịch sử.
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select(`id, status, student:students (id, student_code, full_name)`)
    .eq("class_id", session.class.id)
    .in("status", [...OPEN_ENROLLMENT_STATUSES]);

  if (enrollError) {
    throw new Error(`Không tải được học viên: ${enrollError.message}`);
  }

  const { data: records, error: recordError } = await supabase
    .from("attendance_records")
    .select("enrollment_id, status, note")
    .eq("session_id", sessionId);

  if (recordError) {
    throw new Error(`Không tải được điểm danh: ${recordError.message}`);
  }

  const byEnrollment = new Map(records.map((r) => [r.enrollment_id, r]));

  const roster = enrollments
    .map((e) => ({
      enrollmentId: e.id,
      studentName: e.student?.full_name ?? "Học viên",
      studentCode: e.student?.student_code ?? "—",
      // `null` = CHƯA điểm danh. Khác hẳn với "vắng" — không được mặc định thành
      // `absent`, nếu không giáo viên chỉ cần bấm Lưu là cả lớp bị đánh vắng.
      status: byEnrollment.get(e.id)?.status ?? null,
      note: byEnrollment.get(e.id)?.note ?? "",
    }))
    .sort((a, b) => a.studentName.localeCompare(b.studentName, "vi"));

  return {
    id: session.id,
    sessionNumber: session.session_number,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    status: session.status,
    topic: session.topic,
    classId: session.class.id,
    classCode: session.class.code,
    className: session.class.name,
    roster,
    markedCount: roster.filter((r) => r.status !== null).length,
  };
}
