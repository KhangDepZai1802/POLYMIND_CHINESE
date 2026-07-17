"use server";

import { revalidatePath } from "next/cache";

import {
  classSchema,
  teacherAssignmentSchema,
} from "@/features/classes/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireRole("super_admin");
  const parsed = classSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  // Lớp mới chưa thể active vì giáo viên chính chỉ được phân công sau khi có id.
  if (parsed.data.status === "active") {
    return {
      error:
        "Hãy tạo lớp ở trạng thái Sắp mở, phân công giáo viên chính rồi mới kích hoạt.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("classes")
    .insert({ ...parsed.data, created_by: actor.id })
    .select("id, code, name, status")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "class.create",
    resourceType: "class",
    resourceId: data.id,
    after: { code: data.code, name: data.name, status: data.status },
  });

  revalidatePath("/admin/classes");
  return { success: `Đã tạo lớp "${data.name}".` };
}

export async function updateClassAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Thiếu mã lớp học." };

  const parsed = classSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();

  if (parsed.data.status === "active") {
    const { count, error: teacherError } = await supabase
      .from("class_teachers")
      .select("id", { count: "exact", head: true })
      .eq("class_id", id);

    if (teacherError) return { error: dbErrorToMessage(teacherError) };
    if (count !== 1) {
      return {
        error: "Không thể kích hoạt: lớp phải có một giáo viên phụ trách.",
      };
    }
  }

  const { count: openEnrollmentCount, error: enrollmentError } = await supabase
    .from("enrollments")
    .select("id", { count: "exact", head: true })
    .eq("class_id", id)
    .in("status", ["pending", "active", "paused"]);

  if (enrollmentError) return { error: dbErrorToMessage(enrollmentError) };
  if ((openEnrollmentCount ?? 0) > parsed.data.capacity) {
    return {
      error: `Sĩ số mới không thể thấp hơn ${openEnrollmentCount ?? 0} học viên đang mở trong lớp.`,
    };
  }

  const { data: before } = await supabase
    .from("classes")
    .select("code, name, status, capacity")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("classes")
    .update(parsed.data)
    .eq("id", id)
    .select("id, code, name, status, capacity")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "class.update",
    resourceType: "class",
    resourceId: id,
    before,
    after: {
      code: data.code,
      name: data.name,
      status: data.status,
      capacity: data.capacity,
    },
  });

  revalidatePath("/admin/classes");
  revalidatePath(`/admin/classes/${id}`);
  return { success: "Đã lưu thay đổi lớp học." };
}

export async function assignTeacherAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = teacherAssignmentSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select(
      "id, teacher_code, is_active, profile:profiles!fk_teachers_profile (full_name, is_active)",
    )
    .eq("id", parsed.data.teacher_id)
    .maybeSingle();

  if (teacherError) return { error: dbErrorToMessage(teacherError) };
  if (!teacher || !teacher.is_active || teacher.profile?.is_active === false) {
    return { error: "Giáo viên không tồn tại hoặc tài khoản đã bị khóa." };
  }

  const { data: existingAssignment, error: assignmentError } = await supabase
    .from("class_teachers")
    .select("teacher_id, class:classes (status)")
    .eq("class_id", parsed.data.class_id)
    .maybeSingle();

  if (assignmentError) return { error: dbErrorToMessage(assignmentError) };
  if (
    existingAssignment &&
    existingAssignment.teacher_id !== parsed.data.teacher_id &&
    existingAssignment.class?.status === "active"
  ) {
    return {
      error:
        "Không thể đổi giáo viên phụ trách khi lớp đang hoạt động. Hãy tạm dừng lớp trước.",
    };
  }

  const { data, error } = await supabase
    .from("class_teachers")
    .upsert(parsed.data, { onConflict: "class_id" })
    .select("id, class_id, teacher_id")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "class.teacher.assign",
    resourceType: "class",
    resourceId: data.class_id,
    before: existingAssignment
      ? { teacher_id: existingAssignment.teacher_id }
      : undefined,
    after: { teacher_id: data.teacher_id },
  });

  revalidatePath("/admin/classes");
  revalidatePath(`/admin/classes/${data.class_id}`);
  return {
    success: `Đã phân công ${teacher.profile?.full_name ?? teacher.teacher_code}.`,
  };
}

export async function removeTeacherAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin phân công." };
  }

  const supabase = await createClient();
  const { data: assignment, error: assignmentError } = await supabase
    .from("class_teachers")
    .select("teacher_id, class:classes (status)")
    .eq("id", id)
    .eq("class_id", classId)
    .maybeSingle();

  if (assignmentError) return { error: dbErrorToMessage(assignmentError) };
  if (!assignment) return { error: "Không tìm thấy phân công giáo viên." };
  if (assignment.class?.status === "active") {
    return {
      error:
        "Không thể gỡ giáo viên phụ trách khi lớp đang hoạt động. Hãy tạm dừng lớp trước.",
    };
  }

  const { error } = await supabase
    .from("class_teachers")
    .delete()
    .eq("id", id)
    .eq("class_id", classId);

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "class.teacher.remove",
    resourceType: "class",
    resourceId: classId,
    before: {
      teacher_id: assignment.teacher_id,
    },
  });

  revalidatePath("/admin/classes");
  revalidatePath(`/admin/classes/${classId}`);
  return { success: "Đã gỡ phân công giáo viên." };
}
