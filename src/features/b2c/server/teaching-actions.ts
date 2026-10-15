"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  teachingSessionSchema,
  checkpointSchema,
} from "@/features/b2c/teaching-schema";
import { requireManager, requireTeaching } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { permissionRpc } from "./permission-rpc";
import { zodToActionState, type ActionState } from "@/lib/action-state";
export async function createTeachingSessionAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireManager();
  const p = teachingSessionSchema.safeParse(Object.fromEntries(form.entries()));
  if (!p.success) return zodToActionState(p.error);
  const v = p.data;
  const { error } = await (
    await createClient()
  ).rpc("create_b2c_teaching_session", {
    p_class_id: v.class_id,
    p_teacher_id: v.teacher_id,
    p_starts_at: new Date(`${v.date}T${v.start_time}:00+07:00`).toISOString(),
    p_ends_at: new Date(`${v.date}T${v.end_time}:00+07:00`).toISOString(),
  });
  if (error)
    return {
      error:
        "Không tạo được buổi dạy. Kiểm tra tài khoản, đơn giá giáo viên và lịch trùng.",
    };
  revalidatePath("/admin/b2c/teaching");
  revalidatePath("/admin/b2c/classes/[classId]", "page");
  revalidatePath("/teacher/b2c-teaching");
  return { success: "Đã tạo buổi dạy." };
}
export async function teachingPhotoTicket(
  id: string,
  kind: "in" | "out",
  mime: string,
  size: number,
) {
  const actor = await requireTeaching();
  if (
    !(await permissionRpc<boolean>("has_b2c_permission", {
      p_key: "check_teaching",
    }))
  )
    return { error: "Bạn chưa được cấp quyền chấm công B2C." };
  if (
    !z.uuid().safeParse(id).success ||
    !["in", "out"].includes(kind) ||
    !["image/jpeg", "image/png", "image/webp"].includes(mime) ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > 5242880
  )
    return { error: "Chọn ảnh JPG, PNG hoặc WebP tối đa 5 MB." };
  const c = await createClient();
  const { data: allowed, error: permissionError } = await c.rpc(
    "can_check_b2c_session",
    { p_id: id },
  );
  if (permissionError || !allowed)
    return { error: "Bạn không được phân công buổi dạy này." };
  const ext =
    mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";
  const path = `${id}/${actor.id}/${kind}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await c.storage
    .from("b2c-check-photos")
    .createSignedUploadUrl(path);
  if (error || !data) return { error: "Không tạo được liên kết tải ảnh." };
  return { path: data.path, token: data.token };
}
export async function recordTeachingCheckpoint(input: unknown) {
  await requireTeaching();
  const p = checkpointSchema.safeParse(input);
  if (!p.success) return { error: "Dữ liệu chấm công không hợp lệ." };
  const { error } = await (
    await createClient()
  ).rpc("check_b2c_teaching_session", {
    p_id: p.data.id,
    p_kind: p.data.kind,
    p_photo: p.data.photo,
  });
  if (error)
    return {
      error:
        "Không ghi nhận được. Check-in trong ngày trước khi buổi kết thúc; check-out sau giờ kết thúc và sau check-in. Mỗi bước cần ảnh riêng.",
    };
  revalidatePath("/teacher/b2c-teaching");
  revalidatePath("/admin/b2c/teaching");
  return { success: "Đã ghi nhận chấm công." };
}
