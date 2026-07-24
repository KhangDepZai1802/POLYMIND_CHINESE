"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  dbErrorToMessage,
  type ActionState,
} from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;

const recordSchema = z.object({
  enrollment_id: z.uuid(),
  status: z.enum(ATTENDANCE_STATUSES),
  note: z.string().trim().max(300).optional(),
});

/**
 * Lưu điểm danh cả buổi — MỘT lần gọi RPC, không phải n lần insert.
 *
 * `bulk_mark_attendance` upsert theo `(session_id, enrollment_id)`. Giáo viên bấm
 * Lưu hai lần (mạng chậm, bấm lại) vẫn chỉ có **một** bản ghi mỗi học viên. Chống
 * trùng nằm ở **unique index của DB**, không nằm ở việc disable cái nút — nút bị
 * disable không cứu được khi request thứ hai đã bay đi rồi.
 *
 * `marked_by` do RPC lấy từ `auth.uid()`, client không gửi lên được.
 */
export async function saveAttendanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("teacher", "super_admin");

  const sessionId = formData.get("session_id");
  if (typeof sessionId !== "string" || !z.uuid().safeParse(sessionId).success) {
    return { error: "Buổi học không hợp lệ." };
  }

  // Form gửi lên `status_<enrollmentId>` và `note_<enrollmentId>`.
  // Học viên chưa được chọn trạng thái thì KHÔNG gửi — bỏ qua, không mặc định
  // thành "vắng". Bấm Lưu mà quên chọn ai đó thì họ vẫn là "chưa điểm danh",
  // chứ không âm thầm bị đánh vắng.
  const records: z.infer<typeof recordSchema>[] = [];

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("status_") || typeof value !== "string" || !value) {
      continue;
    }

    const enrollmentId = key.slice("status_".length);
    const note = formData.get(`note_${enrollmentId}`);

    const parsed = recordSchema.safeParse({
      enrollment_id: enrollmentId,
      status: value,
      note: typeof note === "string" ? note : undefined,
    });

    if (!parsed.success) return { error: "Dữ liệu điểm danh không hợp lệ." };
    records.push(parsed.data);
  }

  // Ghi chú KHÔNG được rơi im lặng.
  //
  // Vòng lặp trên chỉ đọc field bắt đầu bằng `status_`; ai không có trạng thái
  // thì `note_<id>` của họ không bao giờ được đọc tới. Giáo viên gõ "xin nghỉ,
  // mẹ báo ốm" rồi bấm Lưu mà quên chọn trạng thái → chữ biến mất, không một
  // cảnh báo nào. Ghi chú sống chung bản ghi với trạng thái nên không thể lưu
  // riêng; thứ sửa được là ĐỪNG IM LẶNG: chặn cả lượt lưu và nói rõ phải làm gì.
  // Form không reload khi action trả lỗi, nên chữ vừa gõ vẫn còn nguyên trong ô.
  let orphanNotes = 0;
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("note_") || typeof value !== "string") continue;
    if (value.trim() === "") continue;
    if (!formData.get(`status_${key.slice("note_".length)}`)) orphanNotes += 1;
  }

  if (orphanNotes > 0) {
    return {
      error: `${orphanNotes} học viên có ghi chú nhưng chưa chọn trạng thái. Ghi chú chỉ lưu được kèm trạng thái — hãy chọn trạng thái cho họ, hoặc xóa ghi chú, rồi lưu lại.`,
    };
  }

  if (records.length === 0) {
    return { error: "Chưa chọn trạng thái cho học viên nào." };
  }

  const supabase = await createClient();

  const { data: count, error } = await supabase.rpc("bulk_mark_attendance", {
    p_session_id: sessionId,
    p_records: records,
  });

  if (error) return { error: dbErrorToMessage(error) };

  revalidatePath("/teacher");
  revalidatePath("/teacher/attendance");

  return { success: `Đã lưu điểm danh cho ${count} học viên.` };
}
