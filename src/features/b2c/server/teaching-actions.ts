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
export async function prepareMeetingCheckin(id: string) {
  await requireTeaching();
  if (!z.uuid().safeParse(id).success)
    return { error: "Buổi học không hợp lệ." };
  try {
    await permissionRpc<string>("prepare_b2c_meeting_checkin", {
      p_meeting_id: id,
    });
    revalidatePath("/teacher/b2c-teaching");
    revalidatePath("/admin/b2c/teaching");
    return { success: "Đã mở chấm công. Chọn ảnh để check-in." };
  } catch {
    return {
      error:
        "Không mở được chấm công. Kiểm tra phân công, ngày dạy và lịch trùng; tải lại để thử lại.",
    };
  }
}
export async function prepareWeeklyCheckin(id: string) {
  await requireTeaching();
  if (!z.uuid().safeParse(id).success)
    return { error: "Lớp học không hợp lệ." };
  try {
    await permissionRpc<string>("prepare_b2c_weekly_checkin", {
      p_class_id: id,
    });
    revalidatePath("/teacher/b2c-teaching");
    revalidatePath("/teacher");
    revalidatePath("/admin/b2c/teaching");
    return { success: "Đã mở chấm công. Chọn ảnh để check-in." };
  } catch {
    return {
      error:
        "Chưa mở được check-in. Chỉ check-in từ 15 phút trước giờ dạy đến trước giờ kết thúc. Lịch có thể đã thay đổi; tải lại để kiểm tra.",
    };
  }
}
export async function priceTeachingSession(form: FormData) {
  await requireManager();
  const input = z
    .object({
      id: z.uuid(),
      rate: z.coerce.number().int().min(0).max(999999999999),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success || !String(form.get("rate") ?? "").trim())
    return { error: "Nhập đơn giá hợp lệ." };
  try {
    await permissionRpc("price_b2c_teaching_session", {
      p_id: input.data.id,
      p_rate: input.data.rate,
    });
    revalidatePath("/admin/b2c/teaching");
    revalidatePath("/teacher/b2c-teaching");
    return { success: "Đã cập nhật đơn giá cho buổi dạy." };
  } catch {
    return {
      error:
        "Không lưu được đơn giá. Buổi có thể đã được cập nhật; vui lòng tải lại.",
    };
  }
}
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
        "Không tạo được buổi dạy. Kiểm tra tài khoản giáo viên và lịch trùng.",
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
    return { error: "Bạn chưa được cấp quyền chấm công." };
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
        "Không ghi nhận được. Check-in từ 15 phút trước giờ dạy đến trước giờ kết thúc; check-out sau giờ kết thúc trong cùng ngày. Mỗi bước cần ảnh riêng.",
    };
  revalidatePath("/teacher/b2c-teaching");
  revalidatePath("/admin/b2c/teaching");
  return { success: "Đã ghi nhận chấm công." };
}
