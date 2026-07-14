"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  assignmentAttachmentRegisterSchema,
  assignmentCreateSchema,
  assignmentUpdateSchema,
} from "@/features/assignments/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { logAudit } from "@/lib/audit";
import { requireRole, requireUser } from "@/lib/auth/session";
import { fromLocalInput } from "@/lib/dates";
import {
  ALLOWED_FILE_EXTENSIONS,
  ASSIGNMENT_FILES_BUCKET,
  MAX_ASSIGNMENT_FILE_SIZE_BYTES,
  SIGNED_URL_TTL_SECONDS,
  fileExtension,
  sanitizeDownloadName,
} from "@/lib/domain/files";
import { createClient } from "@/lib/supabase/server";

function assignmentFormData(formData: FormData) {
  return {
    ...Object.fromEntries(formData),
    allow_late_submission: formData.get("allow_late_submission") === "on",
  };
}

function toAssignmentWrite<T extends { due_at: string | null }>(data: T) {
  return {
    ...data,
    due_at: data.due_at ? fromLocalInput(data.due_at).toISOString() : null,
  };
}

function revalidateAssignmentPaths(classId: string) {
  revalidatePath("/teacher/assignments");
  revalidatePath(`/teacher/classes/${classId}`);
}

export async function createAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("super_admin", "teacher");
  const parsed = assignmentCreateSchema.safeParse(assignmentFormData(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const payload = toAssignmentWrite(parsed.data);
  const { data, error } = await supabase
    .from("assignments")
    .insert({
      ...payload,
      // DB ghi đè bằng auth.uid(); gửi actor thật ở đây để ý định cũng rõ ràng.
      created_by: user.id,
      status: "draft",
      published_at: null,
    })
    .select("id, class_id, title, status")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "assignment.create",
    resourceType: "assignment",
    resourceId: data.id,
    after: { title: data.title, class_id: data.class_id, status: data.status },
  });

  revalidateAssignmentPaths(data.class_id);
  return { success: `Đã lưu bản nháp “${data.title}”.` };
}

export async function updateAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");

  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin bài tập." };
  }

  const parsed = assignmentUpdateSchema.safeParse(assignmentFormData(formData));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { data: before } = await supabase
    .from("assignments")
    .select("title, due_at, max_score, status")
    .eq("id", id)
    .eq("class_id", classId)
    .maybeSingle();

  if (!before) return { error: "Không tìm thấy bài tập." };
  if (before.status === "closed") {
    return { error: "Bài tập đã đóng nên không thể sửa nội dung." };
  }

  const payload = toAssignmentWrite(parsed.data);
  const { data, error } = await supabase
    .from("assignments")
    .update(payload)
    .eq("id", id)
    .eq("class_id", classId)
    .select("id, title, due_at, max_score")
    .single();

  if (error) return { error: dbErrorToMessage(error) };

  await logAudit(supabase, {
    action: "assignment.update",
    resourceType: "assignment",
    resourceId: id,
    before,
    after: {
      title: data.title,
      due_at: data.due_at,
      max_score: data.max_score,
    },
  });

  revalidateAssignmentPaths(classId);
  return { success: "Đã lưu thay đổi bài tập." };
}

export async function publishAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");
  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin bài tập." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_assignment", {
    p_assignment_id: id,
  });

  if (error) return { error: dbErrorToMessage(error) };
  revalidateAssignmentPaths(classId);
  return { success: "Đã giao bài và gửi thông báo cho học viên." };
}

export async function closeAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");
  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin bài tập." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("close_assignment", {
    p_assignment_id: id,
  });

  if (error) return { error: dbErrorToMessage(error) };
  revalidateAssignmentPaths(classId);
  return { success: "Đã đóng bài tập; lịch sử bài nộp được giữ nguyên." };
}

export async function deleteDraftAssignmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");
  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin bài tập." };
  }

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("title, status, assignment_attachments (object_path)")
    .eq("id", id)
    .eq("class_id", classId)
    .maybeSingle();

  if (!assignment) return { error: "Không tìm thấy bài tập." };
  if (assignment.status !== "draft") {
    return {
      error: "Chỉ xóa được bản nháp. Bài đã giao phải đóng để giữ lịch sử.",
    };
  }

  // Metadata trước, Storage sau: nếu Storage lỗi thì chỉ còn object mồ côi, không
  // tạo row hiển thị nhưng tải không được. Đây là failure mode ít gây hại hơn.
  const { error } = await supabase.from("assignments").delete().eq("id", id);
  if (error) return { error: dbErrorToMessage(error) };

  const paths = assignment.assignment_attachments.map(
    (file) => file.object_path,
  );
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(ASSIGNMENT_FILES_BUCKET)
      .remove(paths);
    if (storageError) {
      console.error(
        "[storage] xóa file draft thất bại:",
        paths,
        storageError.message,
      );
    }
  }

  await logAudit(supabase, {
    action: "assignment.delete_draft",
    resourceType: "assignment",
    resourceId: id,
    before: { title: assignment.title, status: assignment.status },
  });

  revalidateAssignmentPaths(classId);
  return { success: `Đã xóa bản nháp “${assignment.title}”.` };
}

type UploadTicket = { path: string; token: string };

export async function createAssignmentUploadUrlAction(input: {
  classId: string;
  assignmentId: string;
  fileName: string;
  sizeBytes: number;
}): Promise<{ error: string } | UploadTicket> {
  await requireRole("super_admin", "teacher");

  if (
    !z.uuid().safeParse(input.classId).success ||
    !z.uuid().safeParse(input.assignmentId).success
  ) {
    return { error: "Lớp hoặc bài tập không hợp lệ." };
  }

  const ext = fileExtension(input.fileName);
  if (!ext) {
    return {
      error: `Định dạng không được hỗ trợ. Cho phép: ${ALLOWED_FILE_EXTENSIONS.join(", ")}.`,
    };
  }
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes <= 0) {
    return { error: "Tệp rỗng hoặc không đọc được." };
  }
  if (input.sizeBytes > MAX_ASSIGNMENT_FILE_SIZE_BYTES) {
    return { error: "Tệp vượt quá 20 MB." };
  }

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, status")
    .eq("id", input.assignmentId)
    .eq("class_id", input.classId)
    .maybeSingle();

  if (!assignment) return { error: "Không tìm thấy bài tập trong lớp này." };
  if (assignment.status === "closed") return { error: "Bài tập đã đóng." };

  const path = `${input.classId}/${input.assignmentId}/${crypto.randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage
    .from(ASSIGNMENT_FILES_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { error: "Không tạo được liên kết tải lên. Vui lòng thử lại." };
  }

  return { path: data.path, token: data.token };
}

export async function registerAssignmentAttachmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("super_admin", "teacher");
  const parsed = assignmentAttachmentRegisterSchema.safeParse(
    Object.fromEntries(formData),
  );
  if (!parsed.success) return zodToActionState(parsed.error);

  const { assignment_id, class_id, object_path, file_name } = parsed.data;
  const segments = object_path.split("/");
  const objectExt = fileExtension(object_path);
  const nameExt = fileExtension(file_name);
  if (
    segments.length !== 3 ||
    segments[0] !== class_id ||
    segments[1] !== assignment_id ||
    !objectExt ||
    objectExt !== nameExt
  ) {
    return { error: "Đường dẫn hoặc định dạng tệp không hợp lệ." };
  }

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, status")
    .eq("id", assignment_id)
    .eq("class_id", class_id)
    .maybeSingle();

  if (!assignment || assignment.status === "closed") {
    // Có thể assignment bị đóng/xóa giữa lúc client upload và gọi register.
    // Path đã được validate đúng scope phía trên nên dọn object mồ côi an toàn.
    await supabase.storage.from(ASSIGNMENT_FILES_BUCKET).remove([object_path]);
    return {
      error: assignment
        ? "Bài tập đã đóng."
        : "Không tìm thấy bài tập trong lớp này.",
    };
  }

  const { data: info, error: infoError } = await supabase.storage
    .from(ASSIGNMENT_FILES_BUCKET)
    .info(object_path);
  if (infoError || !info) {
    return { error: "Không tìm thấy tệp vừa tải lên. Vui lòng thử lại." };
  }
  const sizeBytes = info.size ?? 0;
  if (sizeBytes <= 0 || sizeBytes > MAX_ASSIGNMENT_FILE_SIZE_BYTES) {
    await supabase.storage.from(ASSIGNMENT_FILES_BUCKET).remove([object_path]);
    return {
      error:
        sizeBytes <= 0
          ? "Tệp rỗng hoặc không đọc được."
          : "Tệp vượt quá 20 MB.",
    };
  }

  const { data, error } = await supabase
    .from("assignment_attachments")
    .insert({
      assignment_id,
      object_path,
      file_name,
      mime_type: info.contentType ?? null,
      size_bytes: sizeBytes,
      uploaded_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    await supabase.storage.from(ASSIGNMENT_FILES_BUCKET).remove([object_path]);
    return { error: dbErrorToMessage(error) };
  }

  await logAudit(supabase, {
    action: "assignment.attachment_upload",
    resourceType: "assignment_attachment",
    resourceId: data.id,
    after: { assignment_id, file_name },
  });

  revalidateAssignmentPaths(class_id);
  return { success: `Đã đính kèm “${file_name}”.` };
}

export async function deleteAssignmentAttachmentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin", "teacher");
  const id = formData.get("id");
  const classId = formData.get("class_id");
  if (typeof id !== "string" || typeof classId !== "string") {
    return { error: "Thiếu thông tin tệp." };
  }

  const supabase = await createClient();
  const { data: attachment } = await supabase
    .from("assignment_attachments")
    .select(
      "file_name, object_path, assignment:assignments!inner (class_id, status)",
    )
    .eq("id", id)
    .eq("assignment.class_id", classId)
    .maybeSingle();

  if (!attachment) return { error: "Không tìm thấy tệp đính kèm." };
  if (attachment.assignment.status === "closed")
    return { error: "Bài tập đã đóng." };

  const { error } = await supabase
    .from("assignment_attachments")
    .delete()
    .eq("id", id);
  if (error) return { error: dbErrorToMessage(error) };

  const { error: storageError } = await supabase.storage
    .from(ASSIGNMENT_FILES_BUCKET)
    .remove([attachment.object_path]);
  if (storageError) {
    console.error(
      "[storage] xóa attachment thất bại:",
      attachment.object_path,
      storageError.message,
    );
  }

  revalidateAssignmentPaths(classId);
  return { success: `Đã xóa tệp “${attachment.file_name}”.` };
}

export async function getAssignmentAttachmentDownloadUrlAction(
  attachmentId: string,
): Promise<{ error: string } | { url: string }> {
  await requireUser();
  if (!z.uuid().safeParse(attachmentId).success) {
    return { error: "Tệp đính kèm không hợp lệ." };
  }

  const supabase = await createClient();
  const { data: attachment } = await supabase
    .from("assignment_attachments")
    .select("file_name, object_path")
    .eq("id", attachmentId)
    .maybeSingle();

  if (!attachment) return { error: "Không tìm thấy tệp đính kèm." };
  const ext = fileExtension(attachment.object_path);
  const baseName = attachment.file_name.replace(/\.[^.]+$/, "");
  const { data, error } = await supabase.storage
    .from(ASSIGNMENT_FILES_BUCKET)
    .createSignedUrl(attachment.object_path, SIGNED_URL_TTL_SECONDS, {
      download: ext ? sanitizeDownloadName(baseName, ext) : true,
    });

  if (error || !data) return { error: "Không tạo được liên kết tải xuống." };
  return { url: data.signedUrl };
}
