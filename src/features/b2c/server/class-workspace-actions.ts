"use server";
import { revalidateB2CViews } from "./revalidate-views";
import { requireTeaching } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dbErrorToMessage } from "@/lib/action-state";
import {
  meetingSchema,
  attendanceSchema,
  commentSchema,
} from "../domain/class-workspace";
import type { Json } from "@/types/database";
async function write(action: string, data: Json) {
  const { error } = await (
    await createClient()
  ).rpc("write_b2c_class_workspace", { p_action: action, p_data: data });
  if (error) return { error: dbErrorToMessage(error) };
  revalidateB2CViews();
  return { success: true };
}
export async function saveClassMeetingAction(input: unknown) {
  await requireTeaching("super_admin");
  const p = meetingSchema.safeParse(input);
  if (!p.success)
    return {
      error:
        "Ngày/giờ không hợp lệ. Buổi học cùng ngày, tối đa 12 giờ; kiểm tra nội dung.",
    };
  const v = p.data;
  return write("save_meeting", {
    ...v,
    starts_at: new Date(`${v.date}T${v.start_time}:00+07:00`).toISOString(),
    ends_at: new Date(`${v.date}T${v.end_time}:00+07:00`).toISOString(),
  });
}
export async function saveClassAttendanceAction(input: unknown) {
  await requireTeaching("super_admin");
  const p = attendanceSchema.safeParse(input);
  return !p.success
    ? { error: "Chọn học viên, buổi học và trạng thái điểm danh hợp lệ." }
    : write("save_attendance", p.data);
}
export async function addClassCommentAction(input: unknown) {
  await requireTeaching("super_admin");
  const p = commentSchema.safeParse(input);
  return !p.success
    ? { error: "Nhận xét phải có nội dung và tối đa 4.000 ký tự." }
    : write("add_comment", p.data);
}
