import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Read path của khóa học.
 *
 * Không cần `WHERE` lọc theo quyền ở đây — RLS đã lọc rồi. Super admin thấy tất,
 * giáo viên chỉ thấy course của lớp mình dạy, học viên chỉ course lớp mình học.
 * Cùng một hàm, ba kết quả khác nhau, không một dòng `if role ===` nào.
 */

export async function getLevels() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("levels")
    .select("id, code, name, framework, order_index, description, is_active")
    .order("order_index");

  if (error) throw new Error(`Không tải được danh sách bậc: ${error.message}`);
  return data;
}

export async function getCourses(params?: {
  search?: string;
  courseType?: string;
  status?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("courses")
    .select(
      `id, code, title, title_en, course_type, status, target_audience,
       default_session_count, default_session_duration_minutes, default_tuition_amount,
       level:levels (id, code, name),
       classes (id)`,
    )
    .order("course_type")
    .order("code");

  if (params?.search) {
    query = query.or(`code.ilike.%${params.search}%,title.ilike.%${params.search}%`);
  }
  if (params?.courseType && params.courseType !== "all") {
    query = query.eq(
      "course_type",
      params.courseType as "hsk" | "communication" | "kids" | "exam_prep" | "business_custom" | "custom",
    );
  }
  if (params?.status && params.status !== "all") {
    query = query.eq("status", params.status as "draft" | "active" | "archived");
  }

  const { data, error } = await query;
  if (error) throw new Error(`Không tải được danh sách khóa học: ${error.message}`);
  return data;
}

export async function getCourseById(id: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .select(`*, level:levels (id, code, name)`)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`Không tải được khóa học: ${error.message}`);
  return data;
}

/** Giáo trình: chương → bài học, đã sắp đúng thứ tự. */
export async function getCourseCurriculum(courseId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("course_modules")
    .select(
      `id, title, description, order_index,
       lessons (id, title, objectives, content_summary, planned_duration_minutes, order_index)`,
    )
    .eq("course_id", courseId)
    .order("order_index");

  if (error) throw new Error(`Không tải được giáo trình: ${error.message}`);

  // PostgREST không sắp xếp được bảng lồng nhau → sắp ở đây.
  return data.map((m) => ({
    ...m,
    lessons: [...m.lessons].sort((a, b) => a.order_index - b.order_index),
  }));
}

/** Các lớp đã mở từ khóa học này. */
export async function getCourseClasses(courseId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select("id, code, name, status, capacity, start_date, delivery_mode")
    .eq("course_id", courseId)
    .order("code");

  if (error) throw new Error(`Không tải được danh sách lớp: ${error.message}`);
  return data;
}
