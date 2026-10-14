"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dbErrorToMessage } from "@/lib/action-state";
import { XKLD_READ_ROLES, XKLD_EDIT_ROLES } from "../domain/candidates";
import {
  DOCUMENTS_PATH,
  DOCUMENT_BUCKET,
  requirementSchema,
  documentSchema,
  uploadSchema,
  hasDocumentSignature,
  type DocumentFile,
} from "../domain/documents";
import type { Json } from "@/types/database";

export async function saveRequirementAction(input: unknown) {
  await requireRole(...XKLD_EDIT_ROLES);
  const parsed = requirementSchema.safeParse(input);
  if (!parsed.success)
    return { error: "Tên checklist và thứ tự không hợp lệ." };
  const { error } = await (
    await createClient()
  ).rpc("xkld_documents_command", {
    p_action: "save_requirement",
    p_data: parsed.data,
  });
  if (error) return { error: dbErrorToMessage(error) };
  revalidatePath(DOCUMENTS_PATH, "layout");
  return { success: true };
}
export async function saveDocumentAction(input: unknown) {
  await requireRole(...XKLD_EDIT_ROLES);
  const parsed = documentSchema.safeParse(input);
  if (!parsed.success) return { error: "Ngày hoặc ghi chú không hợp lệ." };
  const { error } = await (
    await createClient()
  ).rpc("xkld_documents_command", {
    p_action: "save_document",
    p_data: parsed.data,
  });
  if (error) return { error: dbErrorToMessage(error) };
  revalidatePath(DOCUMENTS_PATH, "layout");
  return { success: true };
}
export async function prepareDocumentUploadAction(input: unknown) {
  await requireRole(...XKLD_EDIT_ROLES);
  const parsed = uploadSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: "Chỉ nhận PDF/PNG/JPG tối đa 10 MB, tên không chứa đường dẫn.",
    };
  const { data, error } = await (
    await createClient()
  ).rpc("xkld_documents_command", { p_action: "prepare", p_data: parsed.data });
  return error
    ? { error: dbErrorToMessage(error) }
    : { data: data as unknown as DocumentFile & { storage_path: string } };
}
export async function finishDocumentUploadAction(id: string) {
  await requireRole(...XKLD_EDIT_ROLES);
  if (!z.uuid().safeParse(id).success) return { error: "Mã tệp không hợp lệ." };
  const client = await createClient();
  // Pending metadata is visible only to its uploader through RLS. RPC download intentionally only returns ready files.
  const { data: pending, error: lookupError } = await client.rpc(
    "xkld_documents_command",
    { p_action: "upload_info", p_data: { id } },
  );
  if (lookupError || !pending) return { error: "Không tìm thấy lượt tải tệp." };
  const file = pending as unknown as DocumentFile & { storage_path: string };
  const { data: blob, error: fileError } = await client.storage
    .from(DOCUMENT_BUCKET)
    .download(file.storage_path);
  if (
    fileError ||
    !blob ||
    blob.size !== file.size_bytes ||
    !hasDocumentSignature(
      new Uint8Array(await blob.slice(0, 8).arrayBuffer()),
      file.mime_type,
    )
  )
    return {
      error:
        "Nội dung tệp không khớp định dạng. Hãy dùng PDF, PNG hoặc JPG hợp lệ.",
    };
  const { error } = await client.rpc("xkld_documents_command", {
    p_action: "finalize",
    p_data: { id },
  });
  if (error) return { error: dbErrorToMessage(error) };
  revalidatePath(DOCUMENTS_PATH, "layout");
  return { success: true };
}
export async function cancelDocumentUploadAction(id: string) {
  await requireRole(...XKLD_EDIT_ROLES);
  if (!z.uuid().safeParse(id).success) return;
  const client = await createClient();
  const { data } = await client.rpc("xkld_documents_command", {
    p_action: "upload_info",
    p_data: { id },
  });
  const file = data as unknown as DocumentFile | null;
  if (!file?.storage_path || file.state !== "pending") return;
  await client.storage.from(DOCUMENT_BUCKET).remove([file.storage_path]);
  await client.rpc("xkld_documents_command", {
    p_action: "cancel",
    p_data: { id },
  });
}
export async function listDocumentFilesAction(
  documentId: string,
  page: number,
) {
  await requireRole(...XKLD_READ_ROLES);
  if (
    !z.uuid().safeParse(documentId).success ||
    !z.number().int().min(0).max(1000000).safeParse(page).success
  )
    return { error: "Bộ lọc không hợp lệ." };
  const { data, error } = await (
    await createClient()
  ).rpc("xkld_documents_command", {
    p_action: "files",
    p_data: { document_id: documentId, page },
  });
  return error
    ? { error: "Không tải được danh sách tệp." }
    : { data: data as unknown as { rows: DocumentFile[]; total: number } };
}
// JSON serialization is kept inside the authenticated RPC boundary.
export async function readDocumentsAction(
  action: "documents" | "checklists",
  input: Json,
) {
  await requireRole(...XKLD_READ_ROLES);
  const { data, error } = await (
    await createClient()
  ).rpc("xkld_documents_command", { p_action: action, p_data: input });
  if (error) throw new Error("Không tải được hồ sơ giấy tờ.");
  return data;
}
