import "server-only";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildTeacherTimetable } from "../domain/teacher-timetable";
async function readAll<T>(
  read: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await read(offset);
    if (error)
      throw new Error(
        "Không tải được thời khóa biểu giáo viên B2C. Vui lòng thử lại.",
      );
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
export async function getTeacherTimetable() {
  await requireManager();
  const client = await createClient();
  const [classes, teachers] = await Promise.all([
    readAll((o) =>
      client
        .from("b2c_classes")
        .select(
          "id,code,name,teacher_id,teacher_name,weekdays_text,time_text,campus,status",
        )
        .in("status", ["active", "planned"])
        .order("id")
        .range(o, o + 499),
    ),
    readAll((o) =>
      client
        .from("b2c_teachers")
        .select("id,full_name")
        .order("id")
        .range(o, o + 499),
    ),
  ]);
  return buildTeacherTimetable(classes, teachers);
}
