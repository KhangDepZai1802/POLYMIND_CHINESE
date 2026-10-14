"use server";
import { revalidatePath } from "next/cache";
import { b2cTeacherSchema } from "@/features/b2c/teacher-schema";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";

export async function saveB2CTeacherAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  const actor = await requireManager();
  const parsed = b2cTeacherSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  const { id, ...values } = parsed.data;
  const client = await createClient();
  const mutation = id
    ? client.from("b2c_teachers").update(values).eq("id", id)
    : client.from("b2c_teachers").insert({ ...values, created_by: actor.id });
  const { data, error } = await mutation.select("id").maybeSingle();
  if (error) return { error: dbErrorToMessage(error) };
  if (!data)
    return { error: "Không tìm thấy giáo viên hoặc bạn không có quyền sửa." };
  revalidatePath("/admin/b2c/teachers");
  return { success: "Đã lưu hồ sơ giáo viên B2C." };
}
