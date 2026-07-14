import "server-only";

import { z } from "zod";

import { OPEN_ENROLLMENT_STATUSES } from "@/lib/domain/enrollment";
import { createClient } from "@/lib/supabase/server";

/**
 * Đọc một buổi theo scope RLS của người gọi.
 *
 * Giáo viên đoán UUID buổi của lớp khác nhận `null`; không có query bằng admin
 * client và không tự viết một lớp phân quyền thứ hai ở app.
 * Chuỗi URL không phải UUID cũng nhận `null`, tránh lỗi kiểu dữ liệu từ Postgres
 * làm trang trả 500 thay vì 404.
 */
export async function getSessionLog(sessionId: string) {
  if (!z.uuid().safeParse(sessionId).success) return null;

  const supabase = await createClient();
  const { data: session, error } = await supabase
    .from("class_sessions")
    .select(
      `id, class_id, session_number, starts_at, ends_at, status, topic,
       lesson_id, lesson_log, teacher_note, completed_at, completed_by,
       class:classes (
         id, code, name, course_id,
         course:courses (id, code, title)
       )`,
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error)
    throw new Error(`Không tải được nhật ký buổi học: ${error.message}`);
  if (!session?.class?.course) return null;

  const { data: enrollments, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id")
    .eq("class_id", session.class.id)
    .in("status", [...OPEN_ENROLLMENT_STATUSES]);

  if (enrollmentError) {
    throw new Error(
      `Không tải được học viên của buổi học: ${enrollmentError.message}`,
    );
  }

  const enrollmentIds = enrollments.map((enrollment) => enrollment.id);
  const { count: attendanceCount, error: attendanceError } = await supabase
    .from("attendance_records")
    .select("id", { count: "exact", head: true })
    .eq("session_id", session.id)
    .in(
      "enrollment_id",
      enrollmentIds.length > 0 ? enrollmentIds : [session.id],
    );

  if (attendanceError) {
    throw new Error(
      `Không tải được tiến độ điểm danh: ${attendanceError.message}`,
    );
  }

  let completedProgressCount = 0;
  if (session.lesson_id && enrollmentIds.length > 0) {
    const { count, error: progressError } = await supabase
      .from("lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("lesson_id", session.lesson_id)
      .eq("status", "completed")
      .in("enrollment_id", enrollmentIds);

    if (progressError) {
      throw new Error(
        `Không tải được tiến độ bài học: ${progressError.message}`,
      );
    }
    completedProgressCount = count ?? 0;
  }

  return {
    ...session,
    openEnrollmentCount: enrollmentIds.length,
    attendanceCount: attendanceCount ?? 0,
    completedProgressCount,
  };
}
