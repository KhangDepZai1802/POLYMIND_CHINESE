"use server";

import { revalidatePath } from "next/cache";

import {
  changeEnrollmentStatusSchema,
  enrollStudentSchema,
  transferEnrollmentSchema,
} from "@/features/enrollments/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { ENROLLMENT_STATUS_LABELS } from "@/lib/domain/labels";
import { createClient } from "@/lib/supabase/server";

/**
 * Vòng đời ghi danh — MỌI thao tác đi qua RPC, không có ngoại lệ.
 *
 * Vì sao không `supabase.from("enrollments").update(...)` cho nhanh? Vì một lần
 * đổi trạng thái là NHIỀU việc phải xảy ra cùng nhau: cập nhật enrollment, ghi
 * `enrollment_status_history`, ghi audit — và với chuyển lớp thì còn kiểm sĩ số
 * lớp đích CÓ KHÓA HÀNG rồi mở enrollment mới. JS không có transaction: hỏng
 * giữa chừng là dữ liệu rác (lớp cũ đã `transferred` mà lớp mới chưa tạo →
 * học viên biến mất khỏi hệ thống).
 *
 * Đây cũng là bài học `BUG_M10_01` của hệ cũ: 3 đường code cùng set `Payment→Paid`
 * theo 3 cách khác nhau. Một hành động = MỘT đường ghi.
 */

/**
 * Lỗi DB → câu tiếng Việt người dùng hiểu.
 *
 * `dbErrorToMessage` dịch 23505 thành "mã bị trùng" — đúng cho `code` của khóa
 * học, nhưng vô nghĩa ở đây. Enrollment có HAI unique khác nhau và người dùng
 * cần biết chính xác mình vướng cái nào:
 *   • `uq_enrollments_student_class` — đã từng ghi danh vào ĐÚNG lớp này
 *   • `ux_enrollments_one_open_per_student` — đang có lớp khác đang mở (D-18)
 */
function enrollmentError(error: {
  code?: string;
  message?: string;
}): string {
  if (error.code === "23505") {
    const message = error.message ?? "";

    if (message.includes("ux_enrollments_one_open_per_student")) {
      return "Học viên đang có một lớp mở. Mỗi học viên chỉ học một lớp tại một thời điểm — hãy hoàn thành, rút học, hoặc chuyển lớp trước.";
    }

    if (message.includes("uq_enrollments_student_class")) {
      return "Học viên này đã từng ghi danh vào chính lớp đó. Không thể ghi danh lại vào cùng một lớp.";
    }
  }

  // P0001 = exception do chính RPC của ta raise → thông điệp đã là tiếng Việt,
  // an toàn để hiện thẳng (vd "Lớp đã đủ sĩ số (12 / 12)").
  return dbErrorToMessage(error);
}

export async function enrollStudentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = enrollStudentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const { student_id, class_id, status, reason } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("enroll_student", {
    p_student_id: student_id,
    p_class_id: class_id,
    p_status: status,
    p_reason: reason ?? undefined,
  });

  if (error) return { error: enrollmentError(error) };

  revalidatePath(`/admin/classes/${class_id}`);
  revalidatePath("/admin/classes");
  return { success: "Đã ghi danh học viên." };
}

export async function changeEnrollmentStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = changeEnrollmentStatusSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return zodToActionState(parsed.error);

  const { enrollment_id, class_id, new_status, reason } = parsed.data;
  const supabase = await createClient();

  const { error } = await supabase.rpc("change_enrollment_status", {
    p_enrollment_id: enrollment_id,
    p_new_status: new_status,
    p_reason: reason ?? undefined,
  });

  if (error) return { error: enrollmentError(error) };

  revalidatePath(`/admin/classes/${class_id}`);
  revalidatePath("/admin/classes");
  return {
    success: `Đã chuyển sang "${ENROLLMENT_STATUS_LABELS[new_status]}".`,
  };
}

export async function transferEnrollmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = transferEnrollmentSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return zodToActionState(parsed.error);

  const { enrollment_id, class_id, to_class_id, reason } = parsed.data;
  const supabase = await createClient();

  // RPC làm trọn gói trong một transaction: đóng ghi danh cũ (`transferred`),
  // kiểm sĩ số lớp đích có khóa hàng, mở ghi danh mới, ghi 2 dòng history.
  // Điểm và điểm danh của lớp cũ Ở LẠI lớp cũ — chuyển lớp không mang chúng đi.
  const { error } = await supabase.rpc("transfer_enrollment", {
    p_enrollment_id: enrollment_id,
    p_to_class_id: to_class_id,
    p_reason: reason ?? undefined,
  });

  if (error) return { error: enrollmentError(error) };

  revalidatePath(`/admin/classes/${class_id}`);
  revalidatePath(`/admin/classes/${to_class_id}`);
  revalidatePath("/admin/classes");
  return { success: "Đã chuyển lớp. Lịch sử lớp cũ được giữ nguyên." };
}
