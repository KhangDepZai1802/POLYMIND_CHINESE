import "server-only";

import { OPEN_ENROLLMENT_STATUSES } from "@/lib/domain/enrollment";
import { createClient } from "@/lib/supabase/server";

/** Ghi danh của một lớp, kèm học viên và toàn bộ lịch sử đổi trạng thái. */
export async function getClassEnrollments(classId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("enrollments")
    .select(
      `id, status, enrolled_on, started_on, ended_on, reason,
       student:students (id, student_code, full_name, phone),
       enrollment_status_history (
         id, old_status, new_status, reason, changed_at
       )`,
    )
    .eq("class_id", classId)
    .order("enrolled_on");

  if (error) throw new Error(`Không tải được danh sách ghi danh: ${error.message}`);

  return data.map((e) => ({
    ...e,
    enrollment_status_history: [...e.enrollment_status_history].sort(
      (a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at),
    ),
  }));
}

/**
 * Học viên **ghi danh được** — tức chưa có lớp nào đang mở (D-18).
 *
 * Lọc ở đây là UX: admin không phải chọn một học viên rồi mới ăn lỗi. Chốt chặn
 * thật vẫn nằm ở DB (partial unique index `ux_enrollments_one_open_per_student`
 * + kiểm trong RPC) — hai admin ghi danh đồng thời cho cùng một học viên vào hai
 * lớp khác nhau thì danh sách này không cứu được, chỉ DB mới chặn nổi.
 */
export async function getEnrollableStudents() {
  const supabase = await createClient();

  const { data: busy, error: busyError } = await supabase
    .from("enrollments")
    .select("student_id")
    .in("status", [...OPEN_ENROLLMENT_STATUSES]);

  if (busyError) {
    throw new Error(`Không tải được ghi danh đang mở: ${busyError.message}`);
  }

  const busyIds = new Set(busy.map((e) => e.student_id));

  const { data, error } = await supabase
    .from("students")
    .select("id, student_code, full_name")
    .eq("status", "active")
    .order("student_code");

  if (error) throw new Error(`Không tải được học viên: ${error.message}`);

  return data.filter((s) => !busyIds.has(s.id));
}

/** Lớp có thể chuyển đến: đang mở, khác lớp hiện tại, và CÒN CHỖ. */
export async function getTransferTargets(currentClassId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("classes")
    .select("id, code, name, capacity, status, enrollments (id, status)")
    .in("status", ["planned", "active"])
    .neq("id", currentClassId)
    .order("code");

  if (error) throw new Error(`Không tải được lớp đích: ${error.message}`);

  return data
    .map((c) => {
      const taken = c.enrollments.filter((e) =>
        (OPEN_ENROLLMENT_STATUSES as readonly string[]).includes(e.status),
      ).length;

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        taken,
        capacity: c.capacity,
        isFull: taken >= c.capacity,
      };
    })
    .filter((c) => !c.isFull);
}
