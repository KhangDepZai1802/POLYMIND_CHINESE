"use server";

import { revalidatePath } from "next/cache";

import {
  courseSchema,
  lessonSchema,
  moduleSchema,
} from "@/features/courses/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Mutation của khóa học.
 *
 * Mỗi action kiểm quyền ở dòng đầu bằng `requireRole("super_admin")`.
 * Đây KHÔNG phải sự thừa thãi vì đã có middleware: middleware chỉ chặn điều
 * hướng trang. Server action là một HTTP endpoint — gọi thẳng được, không đi
 * qua middleware. Và kể cả action này có lỗ, RLS vẫn chặn ở DB.
 */

function formToObject(formData: FormData) {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    raw[key] = value;
  }
  // Checkbox không được tick thì trình duyệt KHÔNG gửi field lên.
  raw["completion_require_all_assignments"] =
    formData.get("completion_require_all_assignments") === "on";
  return raw;
}

export async function createCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = courseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("courses")
    .insert(parsed.data)
    .select("id, code, title")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "course.create",
    resourceType: "course",
    resourceId: data.id,
    after: { code: data.code, title: data.title },
  });

  revalidatePath("/admin/courses");
  return { success: `Đã tạo khóa học "${data.title}".` };
}

export async function updateCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Thiếu mã khóa học." };

  const parsed = courseSchema.safeParse(formToObject(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();

  const { data: before } = await supabase
    .from("courses")
    .select("code, title, status")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("courses")
    .update(parsed.data)
    .eq("id", id)
    .select("id, code, title, status")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "course.update",
    resourceType: "course",
    resourceId: id,
    before,
    after: { code: data.code, title: data.title, status: data.status },
  });

  revalidatePath("/admin/courses");
  revalidatePath(`/admin/courses/${id}`);
  return { success: "Đã lưu thay đổi." };
}

export async function archiveCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return { error: "Thiếu mã khóa học." };

  const supabase = await createClient();

  // KHÔNG hard delete: khóa học đã mở lớp thì xóa đi là mất cả lịch sử học tập
  // của học viên. Lưu trữ (archive) giữ dữ liệu, chỉ ẩn khỏi danh sách chọn.
  const { error } = await supabase
    .from("courses")
    .update({ status: "archived" })
    .eq("id", id);

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "course.archive",
    resourceType: "course",
    resourceId: id,
    after: { status: "archived" },
  });

  revalidatePath("/admin/courses");
  return { success: "Đã lưu trữ khóa học." };
}

// --- Chương (module) ---------------------------------------------------------

export async function createModuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = moduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();

  const { error } = await supabase.from("course_modules").insert(parsed.data);
  if (error) {
    // UNIQUE (course_id, order_index) — thứ tự trùng là lỗi hay gặp nhất.
    return {
      error:
        error.code === "23505"
          ? "Đã có chương ở vị trí này. Chọn thứ tự khác."
          : dbErrorToMessage(error),
    };
  }

  revalidatePath(`/admin/courses/${parsed.data.course_id}`);
  return { success: "Đã thêm chương." };
}

export async function deleteModuleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  const courseId = formData.get("course_id");
  if (typeof id !== "string" || typeof courseId !== "string") {
    return { error: "Thiếu thông tin chương." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("course_modules").delete().eq("id", id);
  if (error) return { error: dbErrorToMessage(error) };

  revalidatePath(`/admin/courses/${courseId}`);
  return { success: "Đã xóa chương." };
}

// --- Bài học (lesson) --------------------------------------------------------

export async function createLessonAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = lessonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const courseId = formData.get("course_id");
  const supabase = await createClient();

  const { error } = await supabase.from("lessons").insert(parsed.data);
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Đã có bài học ở vị trí này trong chương. Chọn thứ tự khác."
          : dbErrorToMessage(error),
    };
  }

  if (typeof courseId === "string") revalidatePath(`/admin/courses/${courseId}`);
  return { success: "Đã thêm bài học." };
}

export async function deleteLessonAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  const courseId = formData.get("course_id");
  if (typeof id !== "string" || typeof courseId !== "string") {
    return { error: "Thiếu thông tin bài học." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  if (error) return { error: dbErrorToMessage(error) };

  revalidatePath(`/admin/courses/${courseId}`);
  return { success: "Đã xóa bài học." };
}
