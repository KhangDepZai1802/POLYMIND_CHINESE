import "server-only";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { buildTodayTasks, vietnamDate } from "../domain/today-tasks";

async function readAll<T>(
  read: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const rows: T[] = [];
  // Small pages remain below the API's row limit. Never present a failed read as zero tasks.
  for (let offset = 0; ; offset += 500) {
    const result = await read(offset);
    if (result.error)
      throw new Error("Không tải được danh sách công việc. Vui lòng thử lại.");
    rows.push(...(result.data ?? []));
    if (!result.data || result.data.length < 500) return rows;
  }
}

export async function getTodayTasks() {
  await requireManager();
  const client = await createClient();
  const now = new Date();
  const [leads, care, classes, students, enrollments, meetings, attendance] =
    await Promise.all([
      readAll((o) =>
        client
          .from("b2c_admission_leads")
          .select("id,full_name,phone,stage,salesperson")
          .order("id")
          .range(o, o + 499),
      ),
      readAll((o) =>
        client
          .from("b2c_admission_care_logs")
          .select("id,lead_id,created_at,next_followup_date")
          .order("id")
          .range(o, o + 499),
      ),
      readAll((o) =>
        client
          .from("b2c_classes")
          .select("id,code,name,status,end_date")
          .order("id")
          .range(o, o + 499),
      ),
      readAll((o) =>
        client
          .from("b2c_students")
          .select("id,code,full_name")
          .order("id")
          .range(o, o + 499),
      ),
      readAll((o) =>
        client
          .from("b2c_enrollments")
          .select(
            "id,class_id,student_id,status,tuition_end_date,learning_start_date,enrollment_date",
          )
          .order("id")
          .range(o, o + 499),
      ),
      readAll((o) =>
        client
          .from("b2c_class_meetings")
          .select("id,class_id,starts_at,ends_at,status")
          .lte("ends_at", now.toISOString())
          .neq("status", "cancelled")
          .order("id")
          .range(o, o + 499),
      ),
      readAll((o) =>
        client
          .from("b2c_student_attendance")
          .select("meeting_id,enrollment_id")
          .order("id")
          .range(o, o + 499),
      ),
    ]);
  return {
    today: vietnamDate(now),
    refreshedAt: now.toISOString(),
    tasks: buildTodayTasks(
      {
        leads,
        care,
        classes,
        students,
        enrollments,
        meetings,
        attendance,
      },
      now,
    ),
  };
}
