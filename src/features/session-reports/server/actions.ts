"use server";

import { revalidatePath } from "next/cache";

import { dbErrorToMessage, zodToActionState, type ActionState } from "@/lib/action-state";
import { requireTeaching } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { EVIDENCE_BUCKET } from "../domain/evidence";
import {
  saveSessionReportSchema,
  type SaveSessionReportInput,
} from "../schema";
import { completionOf, getSessionReportEditorData } from "./queries";

function revalidateReports() {
  revalidatePath("/teacher/reports");
  revalidatePath("/admin/reports");
}

/**
 * Lưu nháp.
 *
 * Nhận một object đã có kiểu chứ không phải `FormData`: biểu mẫu có ~35 trường
 * và tự lưu sau mỗi lần rời ô, nên gói lại thành `FormData` rồi bóc ra chỉ để
 * hợp khuôn là công vô ích.
 *
 * Mục 3 ghi làm HAI đường có chủ đích:
 *   • ba ô của nhật ký (`lesson_id` · `lesson_log` · `teacher_note`) đi qua
 *     `save_session_log(..., p_complete => false)` — đường ghi vốn có;
 *   • phần còn lại đi qua `save_session_report`.
 * Nhân bản ba ô đó sang bảng báo cáo mới là thứ `BUG_M10_01` cấm.
 */
export async function saveSessionReportAction(
  input: SaveSessionReportInput,
): Promise<ActionState> {
  await requireTeaching("super_admin");

  const parsed = saveSessionReportSchema.safeParse(input);
  if (!parsed.success) return zodToActionState(parsed.error);

  const { session_id, form, students, log } = parsed.data;
  const supabase = await createClient();

  // Nhật ký buổi học trước: nếu bước này hỏng thì mục 3 chưa được ghi và ta
  // KHÔNG muốn báo "đã lưu" cho một biểu mẫu mới lưu được một nửa.
  const { error: logError } = await supabase.rpc("save_session_log", {
    p_session_id: session_id,
    // `p_lesson_id` CÓ nhận null — bản nháp cho phép giáo viên gõ nội dung
    // trước rồi mới chọn bài. Kiểu sinh tự động khai `string` vì chữ ký SQL
    // (`p_lesson_id uuid`) không mang thông tin nullable; chỗ chặn thật nằm
    // trong thân hàm: `if p_lesson_id is not null and not exists (…)`.
    p_lesson_id: log.lesson_id as string,
    p_lesson_log: log.lesson_log,
    p_teacher_note: log.teacher_note,
    p_complete: false,
  });

  if (logError) {
    return { error: dbErrorToMessage(logError, "Không lưu được nội dung buổi dạy.") };
  }

  const { error } = await supabase.rpc("save_session_report", {
    p_session_id: session_id,
    p_form: form,
    p_students: students,
  });

  if (error) {
    return { error: dbErrorToMessage(error, "Không lưu được bản nháp báo cáo.") };
  }

  revalidateReports();
  return { success: "Đã lưu nháp." };
}

/**
 * Gửi báo cáo.
 *
 * Hai tầng chặn, cố ý khác nhau về bản chất:
 *
 *   1. Ở ĐÂY — độ đầy đủ của biểu mẫu, tính bằng `getReportCompletion()`, tức
 *      ĐÚNG hàm mà mục lục dùng để vẽ dấu tích. Một luật, một nơi (`D-43` điểm
 *      6): hai luật thì sẽ có ngày mục lục báo 9/9 mà nút Gửi vẫn kêu thiếu.
 *
 *   2. Ở RPC `submit_session_report` — mấy vế an ninh không bao giờ được lách:
 *      đúng giáo viên của lớp · còn nháp · ĐÃ ĐIỂM DANH ĐỦ · đã tick xác nhận.
 *      Gọi thẳng RPC bỏ qua toàn bộ giao diện vẫn bị chặn (có pgTAP canh).
 */
export async function submitSessionReportAction(
  formData: FormData,
): Promise<ActionState> {
  await requireTeaching("super_admin");

  const sessionId = String(formData.get("session_id") ?? "");
  if (!sessionId) return { error: "Buổi học không hợp lệ." };

  const data = await getSessionReportEditorData(sessionId);
  if (!data) return { error: "Không tìm thấy buổi học." };

  if (!data.attendance.complete) {
    return {
      error: `Cần điểm danh đủ học viên trước khi gửi báo cáo (mới điểm danh ${data.attendance.marked}/${data.attendance.rosterSize}).`,
    };
  }

  if (!data.report.form.confirmed) {
    return { error: "Cần tích ô xác nhận ở cuối biểu mẫu trước khi gửi." };
  }

  const completion = completionOf(data);
  if (!completion.isComplete) {
    const names = completion.missing
      .map((section) => `${section.number}. ${section.title}`)
      .join(" · ");
    return {
      error: `Còn ${completion.missing.length} mục chưa xong: ${names}.`,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_session_report", {
    p_session_id: sessionId,
  });

  if (error) {
    return { error: dbErrorToMessage(error, "Không gửi được báo cáo.") };
  }

  revalidateReports();
  revalidatePath(`/teacher/reports/${sessionId}`);
  return { success: "Đã gửi báo cáo buổi dạy." };
}

/**
 * Ghi lại một ảnh minh chứng vừa tải lên bucket.
 *
 * File được tải thẳng từ trình duyệt lên Storage (đã nén ở client), action này
 * chỉ ghi hàng tham chiếu. Tách hai bước để file lớn không phải đi qua server
 * action — Next.js giới hạn body của server action ở vài MB.
 */
export async function attachReportEvidenceAction(
  formData: FormData,
): Promise<ActionState> {
  await requireTeaching("super_admin");

  const sessionId = String(formData.get("session_id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");
  const bytes = Number(formData.get("bytes") ?? 0);

  if (!sessionId || !storagePath || !Number.isFinite(bytes) || bytes <= 0) {
    return { error: "Thiếu thông tin ảnh minh chứng." };
  }

  const supabase = await createClient();

  const { data: report, error: reportError } = await supabase
    .from("session_reports")
    .select("id, status")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (reportError) {
    return { error: dbErrorToMessage(reportError, "Không đọc được báo cáo.") };
  }
  if (!report) return { error: "Hãy lưu nháp báo cáo trước khi tải ảnh." };
  if (report.status === "submitted") {
    return { error: "Báo cáo đã gửi, không thêm minh chứng được nữa." };
  }

  const { error } = await supabase.from("session_report_evidence").insert({
    report_id: report.id,
    storage_path: storagePath,
    bytes: Math.round(bytes),
  });

  if (error) {
    return { error: dbErrorToMessage(error, "Không lưu được ảnh minh chứng.") };
  }

  revalidatePath(`/teacher/reports/${sessionId}`);
  return { success: "Đã thêm ảnh minh chứng." };
}

/** Gỡ một ảnh khỏi bản nháp — xoá cả hàng lẫn file trong bucket. */
export async function removeReportEvidenceAction(
  formData: FormData,
): Promise<ActionState> {
  await requireTeaching("super_admin");

  const evidenceId = String(formData.get("evidence_id") ?? "");
  const sessionId = String(formData.get("session_id") ?? "");
  if (!evidenceId) return { error: "Không xác định được ảnh cần gỡ." };

  const supabase = await createClient();

  const { data: row, error: readError } = await supabase
    .from("session_report_evidence")
    .select("id, storage_path")
    .eq("id", evidenceId)
    .maybeSingle();

  if (readError) {
    return { error: dbErrorToMessage(readError, "Không đọc được ảnh minh chứng.") };
  }
  if (!row) return { error: "Ảnh không còn tồn tại." };

  const { error } = await supabase
    .from("session_report_evidence")
    .delete()
    .eq("id", evidenceId);

  if (error) {
    return { error: dbErrorToMessage(error, "Không gỡ được ảnh minh chứng.") };
  }

  // Xoá file SAU khi hàng đã đi. Ngược lại thì lỡ xoá file xong mà hàng còn thì
  // báo cáo trỏ tới một file không tồn tại; còn theo thứ tự này, xấu nhất là
  // một file mồ côi trong bucket — không ai thấy, và dọn được.
  const { error: storageError } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .remove([row.storage_path]);

  if (storageError) {
    console.error("[session-reports] không xoá được file:", storageError.message);
  }

  revalidatePath(`/teacher/reports/${sessionId}`);
  return { success: "Đã gỡ ảnh minh chứng." };
}

/**
 * Nhắc giáo viên gửi báo cáo — nút của giáo vụ.
 *
 * Dùng lại bảng `notifications` sẵn có thay vì dựng kênh riêng.
 */
export async function remindTeacherReportAction(
  formData: FormData,
): Promise<ActionState> {
  const { requireManager } = await import("@/lib/auth/session");
  await requireManager();

  const sessionId = String(formData.get("session_id") ?? "");
  if (!sessionId) return { error: "Buổi học không hợp lệ." };

  const supabase = await createClient();

  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select(`id, session_number, starts_at, class_id, class:classes (code, name)`)
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return { error: dbErrorToMessage(sessionError, "Không đọc được buổi học.") };
  }
  if (!session) return { error: "Không tìm thấy buổi học." };

  // Giáo viên phụ trách phải hỏi qua `class_teachers` theo `class_id`:
  // `class_sessions` không có liên kết trực tiếp tới `class_teachers`.
  const { data: assignments, error: teacherError } = await supabase
    .from("class_teachers")
    .select("teacher:teachers (user_id)")
    .eq("class_id", session.class_id);

  if (teacherError) {
    return { error: dbErrorToMessage(teacherError, "Không đọc được giáo viên của lớp.") };
  }

  const recipients = (assignments ?? [])
    .map((row) => row.teacher?.user_id)
    .filter((value): value is string => Boolean(value));

  if (recipients.length === 0) {
    return { error: "Lớp này chưa có giáo viên phụ trách để nhắc." };
  }

  // `dedupe_key` có ngày trong đó ⇒ mỗi giáo viên nhận TỐI ĐA MỘT lời nhắc cho
  // một buổi trong một ngày. Bấm nhắc mười lần trong lúc sốt ruột cũng không
  // thành mười thông báo, nhưng hôm sau vẫn nhắc lại được.
  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("notifications").insert(
    recipients.map((userId) => ({
      user_id: userId,
      type: "announcement" as const,
      title: `Chưa có báo cáo buổi ${session.session_number}`,
      body: `Lớp ${session.class?.code ?? ""} — buổi ${session.session_number} đã dạy nhưng chưa có báo cáo. Vui lòng gửi báo cáo.`,
      link: `/teacher/reports/${sessionId}`,
      resource_type: "class_session",
      resource_id: sessionId,
      dedupe_key: `session_report_reminder:${sessionId}:${userId}:${today}`,
    })),
  );

  // 23505 = đã nhắc hôm nay rồi. Đó không phải lỗi của người dùng, nên nói
  // đúng chuyện đã xảy ra thay vì ném ra một câu lỗi đỏ.
  if (error?.code === "23505") {
    return { success: "Hôm nay đã nhắc rồi — không gửi trùng." };
  }
  if (error) {
    return { error: dbErrorToMessage(error, "Không gửi được lời nhắc.") };
  }

  return { success: `Đã nhắc ${recipients.length} giáo viên.` };
}

/**
 * Đánh dấu / bỏ đánh dấu "buổi này không cần báo cáo" — nút của giáo vụ
 * (`TEACHER-REPORT-5`, user chốt 2026-08-17).
 *
 * 🔴 Toàn bộ luật nằm ở RPC `set_session_report_waiver`, action này KHÔNG kiểm
 * lại gì ngoài hình dạng tham số. Kiểm quyền hay kiểm "đã gửi báo cáo chưa" ở
 * đây nữa là dựng luật thứ hai cho cùng một việc, rồi có ngày hai luật lệch
 * nhau — `BUG_M10_01`. `requireManager()` ở đầu chỉ để trả 403 sớm cho người
 * không phận sự, không phải chốt chặn.
 *
 * `revalidatePath("/teacher/reports")` là vế BẮT BUỘC, không phải cho gọn: cờ
 * miễn đổi hàng đợi của GIÁO VIÊN, mà giáo viên không phải người bấm nút.
 */
export async function setSessionReportWaiverAction(
  formData: FormData,
): Promise<ActionState> {
  const { requireManager } = await import("@/lib/auth/session");
  await requireManager();

  const sessionId = String(formData.get("session_id") ?? "");
  if (!sessionId) return { error: "Buổi học không hợp lệ." };

  const waived = String(formData.get("waived") ?? "") === "true";
  const reason = String(formData.get("reason") ?? "").trim();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_session_report_waiver", {
    p_session_id: sessionId,
    p_waived: waived,
    p_reason: reason || undefined,
  });

  if (error) {
    return {
      error: dbErrorToMessage(
        error,
        waived
          ? "Không đánh dấu được buổi không cần báo cáo."
          : "Không bỏ được đánh dấu.",
      ),
    };
  }

  revalidateReports();

  // RPC trả `false` khi trạng thái đã đúng sẵn. Đó KHÔNG phải lỗi — nói đúng
  // chuyện đã xảy ra thay vì báo "đã lưu" cho một lần bấm không ghi gì.
  if (data === false) {
    return {
      success: waived
        ? "Buổi này đã được đánh dấu trước đó."
        : "Buổi này vốn đang cần báo cáo.",
    };
  }

  return {
    success: waived
      ? "Đã đánh dấu buổi này không cần báo cáo."
      : "Đã đưa buổi này trở lại danh sách cần báo cáo.",
  };
}
