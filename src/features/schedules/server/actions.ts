"use server";

import { revalidatePath } from "next/cache";

import {
  classScheduleSchema,
  manualSessionSchema,
} from "@/features/schedules/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/session";
import { fromLocalInput } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

/**
 * Lịch lặp + sinh buổi học.
 *
 * Ranh giới quan trọng: `class_schedules` là **khuôn** (thứ mấy, mấy giờ),
 * `class_sessions` là **buổi có thật trên trục thời gian**. Sửa khuôn KHÔNG tự
 * đổi các buổi đã sinh — muốn áp lịch mới thì xóa buổi chưa dạy rồi sinh lại.
 * Nếu để sửa khuôn tự động ghi đè buổi đã sinh thì mọi thay đổi lịch sẽ âm thầm
 * dời cả những buổi giáo viên đã dạy xong.
 */

function revalidateClass(classId: string) {
  revalidatePath("/admin/schedule");
  revalidatePath(`/admin/classes/${classId}`);
}

export async function createScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = classScheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();

  const { error } = await supabase.from("class_schedules").insert(parsed.data);
  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "class.schedule.create",
    resourceType: "class",
    resourceId: parsed.data.class_id,
    after: {
      weekday: parsed.data.weekday,
      start_time: parsed.data.start_time,
      end_time: parsed.data.end_time,
    },
  });

  revalidateClass(parsed.data.class_id);
  return { success: "Đã thêm lịch lặp." };
}

export async function deleteScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin lịch." };
  }

  const supabase = await createClient();

  // `class_sessions.schedule_id` là ON DELETE SET NULL → các buổi ĐÃ SINH từ lịch
  // này vẫn còn nguyên, chỉ mất con trỏ về khuôn. Đúng ý: xóa khuôn không được
  // làm bốc hơi buổi học có thật (và điểm danh của nó).
  const { error } = await supabase
    .from("class_schedules")
    .delete()
    .eq("id", id);

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "class.schedule.delete",
    resourceType: "class",
    resourceId: classId,
  });

  revalidateClass(classId);
  return { success: "Đã xóa lịch lặp. Các buổi đã sinh vẫn được giữ nguyên." };
}

/**
 * Sinh buổi học từ lịch lặp — **idempotent**.
 *
 * RPC `generate_class_sessions` chống trùng bằng `ON CONFLICT` trên unique index
 * `(class_id, session_number)`, không bằng check ở app. Bấm nút hai lần thì lần
 * hai trả về 0 buổi mới — đó là kết quả ĐÚNG, không phải lỗi, và UI phải nói rõ
 * như vậy thay vì ném ra thông báo đỏ.
 */
export async function generateSessionsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const classId = formData.get("class_id");
  if (typeof classId !== "string") return { error: "Thiếu mã lớp." };

  const supabase = await createClient();

  // Đếm TRƯỚC để giải thích được vì sao ra 0 buổi: lớp linh hoạt (không có lịch
  // lặp) và lớp đã đủ buổi đều trả 0, nhưng là hai chuyện hoàn toàn khác nhau.
  const [{ count: scheduleCount }, { count: sessionCount }] = await Promise.all([
    supabase
      .from("class_schedules")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId),
    supabase
      .from("class_sessions")
      .select("id", { count: "exact", head: true })
      .eq("class_id", classId),
  ]);

  const { data: created, error } = await supabase.rpc(
    "generate_class_sessions",
    { p_class_id: classId },
  );

  if (error) return { error: dbErrorToMessage(error) };

  revalidateClass(classId);

  if ((created ?? 0) > 0) {
    return { success: `Đã sinh ${created} buổi học.` };
  }

  if ((scheduleCount ?? 0) === 0) {
    return {
      success:
        "Lớp chưa có lịch lặp nên không sinh buổi nào. Lớp linh hoạt thì thêm buổi thủ công bên dưới.",
    };
  }

  if ((sessionCount ?? 0) > 0) {
    return { success: "Lớp đã đủ số buổi dự kiến — không sinh thêm buổi nào." };
  }

  return {
    success:
      "Không sinh được buổi nào: lịch lặp không rơi vào ngày nào kể từ ngày khai giảng.",
  };
}

/** Buổi học thêm tay — lối đi cho lớp linh hoạt không có lịch lặp. */
export async function createManualSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const parsed = manualSessionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const { class_id, starts_at, ends_at, topic, lesson_id } = parsed.data;
  const supabase = await createClient();

  const { data: last } = await supabase
    .from("class_sessions")
    .select("session_number")
    .eq("class_id", class_id)
    .order("session_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("class_sessions").insert({
    class_id,
    session_number: (last?.session_number ?? 0) + 1,
    // Giờ VN từ form → UTC. DB luôn lưu UTC.
    starts_at: fromLocalInput(starts_at).toISOString(),
    ends_at: fromLocalInput(ends_at).toISOString(),
    topic,
    lesson_id,
  });

  if (error) {
    // Hai admin cùng thêm buổi một lúc → cùng đọc ra `session_number` cũ. Unique
    // index (class_id, session_number) chặn ở DB, app-level check thì không.
    return {
      error:
        error.code === "23505"
          ? "Vừa có buổi khác được thêm cùng lúc. Bấm thêm lại lần nữa."
          : dbErrorToMessage(error),
    };
  }

  await logAudit(supabase, {
    action: "class.session.create_manual",
    resourceType: "class",
    resourceId: class_id,
    after: { starts_at, ends_at },
  });

  revalidateClass(class_id);
  return { success: "Đã thêm buổi học." };
}

/**
 * Xóa TẤT CẢ buổi học sinh nhầm của một lớp — CHỈ buổi chưa dạy & chưa điểm danh.
 *
 * Giữ nguyên luật "không hard delete lịch sử": buổi `completed` và buổi đã có
 * điểm danh được GIỮ LẠI. Ta lọc sẵn danh sách xóa được ở app để lệnh delete
 * không bị trigger `prevent_session_delete_with_history` (migration 22) làm hỏng
 * cả mẻ (delete là một câu lệnh — một buổi vướng lịch sử thì cả mẻ rollback).
 */
export async function deleteAllSessionsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const classId = formData.get("class_id");
  if (typeof classId !== "string") return { error: "Thiếu mã lớp." };

  const supabase = await createClient();

  // Ứng viên xóa: buổi `scheduled` (chưa dạy). Buổi completed/cancelled không đụng.
  const { data: candidates, error: fetchError } = await supabase
    .from("class_sessions")
    .select("id")
    .eq("class_id", classId)
    .eq("status", "scheduled");
  if (fetchError) return { error: dbErrorToMessage(fetchError) };

  const candidateIds = (candidates ?? []).map((s) => s.id);
  if (candidateIds.length === 0) {
    return { success: "Không có buổi nào chưa dạy để xóa." };
  }

  // Trong số đó, bỏ ra các buổi đã có điểm danh (giữ lại lịch sử).
  const { data: attended, error: attendedError } = await supabase
    .from("attendance_records")
    .select("session_id")
    .in("session_id", candidateIds);
  if (attendedError) return { error: dbErrorToMessage(attendedError) };

  const keepIds = new Set((attended ?? []).map((a) => a.session_id));
  const deletableIds = candidateIds.filter((id) => !keepIds.has(id));

  if (deletableIds.length === 0) {
    return {
      success:
        "Mọi buổi chưa dạy đều đã có điểm danh — giữ lại toàn bộ, không xóa buổi nào.",
    };
  }

  const { error } = await supabase
    .from("class_sessions")
    .delete()
    .in("id", deletableIds);
  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "class.session.delete_all",
    resourceType: "class",
    resourceId: classId,
    after: { deleted: deletableIds.length, kept: keepIds.size },
  });

  revalidateClass(classId);
  const keptNote =
    keepIds.size > 0 ? ` Giữ lại ${keepIds.size} buổi đã có điểm danh.` : "";
  return { success: `Đã xóa ${deletableIds.length} buổi chưa dạy.${keptNote}` };
}

/** Hủy buổi — GIỮ lại vết. Đây là cách đúng để bỏ một buổi đã có lịch sử. */
export async function cancelSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin buổi học." };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("class_sessions")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "class.session.cancel",
    resourceType: "class_session",
    resourceId: id,
    after: { status: "cancelled" },
  });

  revalidateClass(classId);
  return { success: "Đã hủy buổi học. Buổi vẫn nằm trong lịch sử." };
}

/**
 * Xóa buổi — chỉ dùng cho buổi SINH NHẦM (chưa dạy, chưa điểm danh).
 *
 * Trigger `prevent_session_delete_with_history` (migration 22) chặn ở DB nếu buổi
 * đã dạy hoặc đã có điểm danh: `attendance_records` đang ON DELETE CASCADE, để
 * xóa tự do thì mất luôn điểm danh mà không ai hay.
 */
export async function deleteSessionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");

  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin buổi học." };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("class_sessions").delete().eq("id", id);
  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "class.session.delete",
    resourceType: "class_session",
    resourceId: id,
  });

  revalidateClass(classId);
  return { success: "Đã xóa buổi học." };
}
