import { z } from "zod";
export const DOCUMENTS_PATH = "/workspace/xkld/documents";
export const DOCUMENT_BUCKET = "xkld-documents";
export const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024;
export type Requirement = {
  id: string;
  market_id: string;
  name: string;
  is_required: boolean;
  expects_expiry: boolean;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
};
export type CandidateDocument = {
  id: string;
  submitted_on: string | null;
  expires_on: string | null;
  note: string;
  updated_at: string;
};
export type DocumentRow = {
  requirement: Requirement;
  document: CandidateDocument | null;
  file_count: number;
};
export type DocumentFile = {
  id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  uploaded_at: string;
  uploaded_by: string;
  storage_path?: string;
  state?: string;
};
export const requirementSchema = z.object({
  id: z.uuid().optional(),
  request_id: z.uuid(),
  market_id: z.uuid(),
  name: z.string().trim().min(1).max(200),
  is_required: z.boolean(),
  expects_expiry: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.number().int().min(0).max(10000),
  expected_updated_at: z.string().optional(),
});
const optionalDate = z.union([
  z.iso.date().refine((v) => v >= "1900-01-01", "Ngày phải từ năm 1900."),
  z.literal(""),
]);
export const documentSchema = z.object({
  candidate_id: z.uuid(),
  requirement_id: z.uuid(),
  submitted_on: optionalDate,
  expires_on: optionalDate,
  note: z.string().max(2000),
  expected_updated_at: z.string().nullable(),
});
export const uploadSchema = z
  .object({
    candidate_id: z.uuid(),
    requirement_id: z.uuid(),
    request_id: z.uuid(),
    file_name: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[^\\/\u0000-\u001f\u007f]+$/),
    mime_type: z.enum(["application/pdf", "image/png", "image/jpeg"]),
    size_bytes: z.number().int().min(1).max(MAX_DOCUMENT_SIZE),
  })
  .refine(
    (v) =>
      ({
        "application/pdf": /\.pdf$/i,
        "image/png": /\.png$/i,
        "image/jpeg": /\.jpe?g$/i,
      })[v.mime_type].test(v.file_name),
    "Tên tệp không khớp định dạng.",
  );
export function documentStatus(row: DocumentRow, today: string) {
  const d = row.document;
  if (!d?.submitted_on) return "Chưa nộp";
  if (row.requirement.expects_expiry && !d.expires_on)
    return "Thiếu ngày hết hạn";
  if (d.expires_on && d.expires_on < today) return "Hết hạn";
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + 30);
  if (d.expires_on && d.expires_on <= limit.toISOString().slice(0, 10))
    return "Sắp hết hạn";
  return "Đã nộp";
}
export function hasDocumentSignature(bytes: Uint8Array, mime: string) {
  if (mime === "application/pdf")
    return [37, 80, 68, 70, 45].every((v, i) => bytes[i] === v);
  if (mime === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  return (
    mime === "image/jpeg" &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  );
}
