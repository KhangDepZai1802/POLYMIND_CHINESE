import "server-only";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { StudentDashboardData } from "@/features/b2c/domain/student-dashboard";

async function readAll<T>(
  read: (offset: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await read(offset);
    if (result.error)
      throw new Error("Không tải được dữ liệu học viên. Vui lòng thử lại.");
    rows.push(...(result.data ?? []));
    if (!result.data || result.data.length < 1000) return rows;
  }
}
export async function getStudentDashboard(): Promise<StudentDashboardData> {
  await requireManager();
  const client = await createClient();
  const [students, enrollments, classes] = await Promise.all([
    readAll((o) =>
      client
        .from("b2c_students")
        .select(
          "id,code,full_name,phone,email,date_of_birth,birth_year,address,guardian_name,guardian_zalo,customer_source,referrer_name,parentLinks:b2c_student_parents(parent:b2c_parents(full_name,zalo))",
        )
        .is("archived_at", null)
        .order("full_name")
        .order("id")
        .range(o, o + 999),
    ),
    readAll((o) =>
      client
        .from("b2c_enrollments")
        .select(
          "id,student_id,class_id,status,withdrawal_reason,learning_goal,certificate_goal,enrollment_date,payment_date,learning_start_date,tuition_end_date,registered_sessions,salesperson,notes",
        )
        .order("id")
        .range(o, o + 999),
    ),
    readAll((o) =>
      client
        .from("b2c_classes")
        .select("id,code,name,status,program_slug")
        .order("code")
        .order("id")
        .range(o, o + 999),
    ),
  ]);
  return {
    students: students.map(
      ({ parentLinks, guardian_name, guardian_zalo, ...s }) => ({
        ...s,
        guardianName:
          parentLinks
            .map((p) => p.parent?.full_name)
            .filter(Boolean)
            .join(", ") ||
          guardian_name ||
          null,
        guardianZalo:
          [
            ...new Set(
              [guardian_zalo, ...parentLinks.map((p) => p.parent?.zalo)].filter(
                Boolean,
              ),
            ),
          ].join(", ") || null,
      }),
    ),
    enrollments: enrollments.filter(e => students.some(s => s.id === e.student_id)),
    classes,
    today: new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
  };
}
