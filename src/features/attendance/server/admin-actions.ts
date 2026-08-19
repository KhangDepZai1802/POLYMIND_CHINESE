"use server";

import { revalidatePath } from "next/cache";

import { dbErrorToMessage, type ActionState } from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import {
  attendanceChangeListSchema,
  describeOverrideResult,
  groupChangesBySession,
  parseOverrideResult,
} from "../admin-edit";

/**
 * Admin sửa lại điểm danh giáo viên đã chốt (`ADMIN-ATTENDANCE-1`, `D-45`).
 *
 * =============================================================================
 * 🔴 `requireRole("super_admin")` Ở ĐÂY KHÔNG PHẢI CHỐT CHẶN
 * =============================================================================
 *
 * Chốt chặn thật là `app.is_super_admin()` bên trong RPC
 * `admin_override_attendance` — giáo vụ mở DevTools gọi thẳng `supabase.rpc()`
 * vẫn bị DB chặn, có bài pgTAP ghim. Dòng này chỉ để người không phận sự nhận
 * câu trả lời sớm thay vì phải đợi một vòng tới DB.
 *
 * Cùng lý do đó, action này KHÔNG kiểm lại "buổi này có báo cáo chưa", "ghi
 * danh có thuộc lớp không", hay "trạng thái có đổi thật không". Ba luật ấy sống
 * trong RPC; dựng lại ở đây là dựng luật thứ hai cho cùng một việc rồi có ngày
 * hai luật lệch nhau (`BUG_M10_01`).
 */
export async function adminOverrideAttendanceAction(
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const raw = formData.get("changes");
  if (typeof raw !== "string" || raw.trim() === "") {
    return { error: "Chưa có thay đổi nào để lưu." };
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    return { error: "Dữ liệu gửi lên không đọc được. Hãy tải lại trang." };
  }

  const parsed = attendanceChangeListSchema.safeParse(decoded);
  if (!parsed.success) {
    return { error: "Dữ liệu điểm danh không hợp lệ." };
  }
  if (parsed.data.length === 0) {
    return { error: "Chưa có thay đổi nào để lưu." };
  }

  const reasonRaw = formData.get("reason");
  const reason =
    typeof reasonRaw === "string" ? reasonRaw.trim().slice(0, 300) : "";

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_override_attendance", {
    p_changes: groupChangesBySession(parsed.data),
    p_reason: reason || undefined,
  });

  if (error) {
    return {
      error: dbErrorToMessage(error, "Không lưu được điểm danh."),
    };
  }

  /*
   * Ba đường phải cùng thấy số mới, không chỉ trang admin:
   *
   *   • `/admin/reports` — chính lưới vừa sửa, và ô "Chưa gửi" của tab Báo cáo
   *     giáo viên đọc cùng nguồn điểm danh.
   *   • `/teacher` + `/teacher/reports` — điểm danh thiếu là thứ CHẶN giáo viên
   *     gửi báo cáo. Admin vừa điền nốt ô còn thiếu mà hàng đợi của giáo viên
   *     vẫn báo "chưa điểm danh xong" thì họ không có cách nào biết đã thông.
   *   • `/teacher/attendance` — bảng điểm danh của chính buổi đó.
   */
  revalidatePath("/admin/reports");
  revalidatePath("/teacher");
  revalidatePath("/teacher/reports");
  revalidatePath("/teacher/attendance");

  return { success: describeOverrideResult(parseOverrideResult(data)) };
}
