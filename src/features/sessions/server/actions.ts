"use server";

import { revalidatePath } from "next/cache";

import { sessionLogSchema } from "@/features/sessions/schema";
import {
  dbErrorToMessage,
  type ActionState,
  zodToActionState,
} from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export async function saveSessionLogAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");

  const parsed = sessionLogSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data: progressCount, error } = await supabase.rpc(
    "save_session_log",
    {
      p_session_id: parsed.data.session_id,
      p_lesson_id: parsed.data.lesson_id,
      p_lesson_log: parsed.data.lesson_log,
      p_teacher_note: parsed.data.teacher_note,
      p_complete: parsed.data.intent === "complete",
    },
  );

  if (error) return { error: dbErrorToMessage(error) };

  revalidatePath("/teacher");
  revalidatePath("/teacher/classes");
  revalidatePath(`/teacher/sessions/${parsed.data.session_id}`);

  if (parsed.data.intent === "complete") {
    return {
      success: `Đã hoàn tất buổi và cập nhật tiến độ cho ${progressCount ?? 0} học viên.`,
    };
  }

  return { success: "Đã lưu nhật ký buổi học." };
}
