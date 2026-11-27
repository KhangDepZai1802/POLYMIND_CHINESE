"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole, requireTeaching } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { zodToActionState, type ActionState } from "@/lib/action-state";
import {
  B2C_HOMEWORK_BUCKET,
  b2cHomeworkArchiveSchema,
  b2cHomeworkCreateSchema,
  b2cHomeworkStoredFileSchema,
  b2cHomeworkSubmitSchema,
  b2cHomeworkUpdateSchema,
  b2cHomeworkUploadSchema,
  homeworkDeadlineToUtc,
  homeworkFileSignatureMatches,
  type B2CHomeworkPage,
  type B2CHomeworkSubmissionHistory,
  type B2CHomeworkSubmissionsPage,
  type B2CHomeworkUploadTicket,
} from "../domain/homework";
import { permissionRpc } from "./permission-rpc";
import { revalidateB2CViews } from "./revalidate-views";

const pageSchema = z.number().int().min(0).max(1000000);
const fileKindSchema = z.enum(["assignment", "submission"]);

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
function refreshHomeworkViews() {
  revalidateB2CViews();
  revalidatePath("/student/b2c-homework");
}

async function verifyUploadedFile(uploadId: string, assignment: boolean) {
  // The path comes only from a rights-checked DB upload ID, never from FormData.
  const file = b2cHomeworkStoredFileSchema.parse(await permissionRpc<unknown>(
    "read_b2c_homework_file", { p_kind: "upload", p_id: uploadId },
  ));
  if (assignment && file.mime_type !== "application/pdf") {
    throw new Error("Đề bài phải là tệp PDF.");
  }
  const storage = (await createClient()).storage.from(B2C_HOMEWORK_BUCKET);
  const { data: info, error: infoError } = await storage.info(file.object_path);
  if (infoError || !info || info.size !== file.size_bytes || info.contentType !== file.mime_type) {
    throw new Error("Không xác minh được tệp đã tải lên. Kiểm tra định dạng và kích thước tệp.");
  }
  // This SDK supports cache/signal, not a Range header. The object is bounded
  // to 20 MB above and again by the bucket; download through the session client.
  const { data: blob, error: downloadError } = await storage.download(
    file.object_path, {}, { cache: "no-store", signal: AbortSignal.timeout(15000) },
  );
  if (downloadError || !blob || blob.size !== file.size_bytes) {
    throw new Error("Không đọc được tệp vừa tải lên. Vui lòng thử lại.");
  }
  const prefix = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
  if (!homeworkFileSignatureMatches(prefix, file.mime_type)) {
    throw new Error("Nội dung tệp không đúng định dạng PDF hoặc ảnh đã chọn.");
  }
}

export async function prepareB2CHomeworkUploadAction(input: unknown): Promise<{
  data?: B2CHomeworkUploadTicket; error?: string;
}> {
  await requireRole("super_admin", "academic_manager", "teacher", "student");
  const parsed = b2cHomeworkUploadSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Thông tin tệp không hợp lệ." };
  const value = parsed.data;
  if (value.kind === "assignment") await requireTeaching("super_admin");
  else await requireRole("student");
  try {
    const ticket = z.object({ id: z.uuid(), object_path: b2cHomeworkStoredFileSchema.shape.object_path, bucket: z.literal(B2C_HOMEWORK_BUCKET) }).parse(
      await permissionRpc<unknown>("prepare_b2c_homework_upload", {
        p_class_id: value.class_id,
        p_homework_id: value.homework_id,
        p_kind: value.kind,
        p_file_name: value.file_name,
        p_mime_type: value.mime_type,
        p_size_bytes: value.size_bytes,
        p_request_id: value.request_id,
      }),
    );
    const { data, error } = await (await createClient()).storage.from(ticket.bucket)
      .createSignedUploadUrl(ticket.object_path, { upsert: false });
    if (error || !data || data.path !== ticket.object_path) {
      return { error: "Không tạo được liên kết tải lên. Vui lòng thử lại." };
    }
    return { data: { uploadId: ticket.id, path: ticket.object_path, token: data.token, bucket: ticket.bucket } };
  } catch (error) {
    return { error: errorMessage(error, "Không tạo được lượt tải lên.") };
  }
}

export async function createB2CHomeworkAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireTeaching("super_admin");
  const parsed = b2cHomeworkCreateSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  const value = parsed.data;
  try {
    await verifyUploadedFile(value.upload_id, true);
    await permissionRpc<string>("create_b2c_homework", {
      p_upload_id: value.upload_id,
      p_title: value.title,
      p_description: value.description,
      p_due_at: homeworkDeadlineToUtc(value.due_at),
      p_request_id: value.request_id,
    });
  } catch (error) {
    return { error: errorMessage(error, "Không giao được bài tập.") };
  }
  refreshHomeworkViews();
  return { success: "Đã giao bài tập." };
}

export async function updateB2CHomeworkAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireTeaching("super_admin");
  const parsed = b2cHomeworkUpdateSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  const value = parsed.data;
  try {
    await permissionRpc<string>("update_b2c_homework", {
      p_id: value.id, p_title: value.title, p_description: value.description,
      p_due_at: homeworkDeadlineToUtc(value.due_at), p_expected_updated_at: value.expected_updated_at,
    });
  } catch (error) {
    return { error: errorMessage(error, "Không sửa được bài tập.") };
  }
  refreshHomeworkViews();
  return { success: "Đã cập nhật bài tập." };
}

export async function archiveB2CHomeworkAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireTeaching("super_admin");
  const parsed = b2cHomeworkArchiveSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  try {
    await permissionRpc<string>("archive_b2c_homework", {
      p_id: parsed.data.id, p_expected_updated_at: parsed.data.expected_updated_at,
    });
  } catch (error) {
    return { error: errorMessage(error, "Không lưu trữ được bài tập.") };
  }
  refreshHomeworkViews();
  return { success: "Đã lưu trữ bài tập." };
}

export async function submitB2CHomeworkAction(_: ActionState, form: FormData): Promise<ActionState> {
  await requireRole("student");
  const parsed = b2cHomeworkSubmitSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  const value = parsed.data;
  try {
    await verifyUploadedFile(value.upload_id, false);
    await permissionRpc<string>("submit_b2c_homework", {
      p_homework_id: value.homework_id, p_upload_id: value.upload_id, p_request_id: value.request_id,
    });
  } catch (error) {
    return { error: errorMessage(error, "Không nộp được bài tập.") };
  }
  refreshHomeworkViews();
  return { success: "Đã nộp bài tập." };
}

export async function readB2CHomeworkAction(classId: string | null, page = 0): Promise<B2CHomeworkPage> {
  await requireRole("super_admin", "academic_manager", "teacher", "student");
  const input = z.object({ classId: z.uuid().nullable(), page: pageSchema }).parse({ classId, page });
  return permissionRpc<B2CHomeworkPage>("read_b2c_homework_page", { p_class_id: input.classId, p_page: input.page });
}

export async function readB2CHomeworkSubmissionsAction(homeworkId: string, page = 0): Promise<B2CHomeworkSubmissionsPage> {
  await requireTeaching("super_admin");
  const input = z.object({ homeworkId: z.uuid(), page: pageSchema }).parse({ homeworkId, page });
  return permissionRpc<B2CHomeworkSubmissionsPage>("read_b2c_homework_submissions", { p_homework_id: input.homeworkId, p_page: input.page });
}

export async function readB2CHomeworkSubmissionHistoryAction(homeworkId: string, enrollmentId: string | null = null, page = 0): Promise<B2CHomeworkSubmissionHistory> {
  await requireRole("super_admin", "academic_manager", "teacher", "student");
  const input = z.object({ homeworkId: z.uuid(), enrollmentId: z.uuid().nullable(), page: pageSchema }).parse({ homeworkId, enrollmentId, page });
  return permissionRpc<B2CHomeworkSubmissionHistory>("read_b2c_homework_submission_history", {
    p_homework_id: input.homeworkId, p_enrollment_id: input.enrollmentId, p_page: input.page,
  });
}

export async function getB2CHomeworkFileUrlAction(kind: string, id: string): Promise<{
  url?: string; fileName?: string; error?: string;
}> {
  await requireRole("super_admin", "academic_manager", "teacher", "student");
  const parsed = z.object({ kind: fileKindSchema, id: z.uuid() }).safeParse({ kind, id });
  if (!parsed.success) return { error: "Tệp không hợp lệ." };
  try {
    const file = b2cHomeworkStoredFileSchema.parse(await permissionRpc<unknown>(
      "read_b2c_homework_file", { p_kind: parsed.data.kind, p_id: parsed.data.id },
    ));
    const { data, error } = await (await createClient()).storage.from(file.bucket)
      .createSignedUrl(file.object_path, 120);
    if (error || !data) return { error: "Không tạo được liên kết xem tệp. Vui lòng thử lại." };
    return { url: data.signedUrl, fileName: file.file_name };
  } catch (error) {
    return { error: errorMessage(error, "Không xem được tệp hoặc bạn không có quyền.") };
  }
}
