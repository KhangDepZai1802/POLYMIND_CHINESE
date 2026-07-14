import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Toàn bộ dữ liệu màn hình "Lịch học" của MỘT lớp.
 *
 * RLS lọc sẵn theo role — không có `if role ===` nào ở đây.
 */
export async function getClassScheduleBoard(classId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select(
      `id, code, name, status, capacity, start_date, expected_end_date,
       planned_session_count, session_duration_minutes, delivery_mode,
       course:courses (id, code, title),
       class_schedules (id, weekday, start_time, end_time, effective_from, effective_to),
       class_sessions (
         id, session_number, starts_at, ends_at, status, topic, schedule_id,
         lesson:lessons (id, title)
       )`,
    )
    .eq("id", classId)
    .maybeSingle();

  if (error) throw new Error(`Không tải được lịch lớp: ${error.message}`);
  if (!data) return null;

  // PostgREST không sắp xếp được bảng lồng nhau → sắp ở đây.
  return {
    ...data,
    class_schedules: [...data.class_schedules].sort(
      (a, b) =>
        a.weekday - b.weekday || a.start_time.localeCompare(b.start_time),
    ),
    class_sessions: [...data.class_sessions].sort(
      (a, b) => a.session_number - b.session_number,
    ),
  };
}

/** Bài học của khóa mà lớp này triển khai — để gắn buổi học vào bài. */
export async function getLessonOptionsForClass(courseId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("course_modules")
    .select(`id, title, order_index, lessons (id, title, order_index)`)
    .eq("course_id", courseId)
    .order("order_index");

  if (error) throw new Error(`Không tải được bài học: ${error.message}`);

  return data.flatMap((m) =>
    [...m.lessons]
      .sort((a, b) => a.order_index - b.order_index)
      .map((l) => ({
        id: l.id,
        label: `Chương ${m.order_index} · Bài ${l.order_index}: ${l.title}`,
      })),
  );
}
