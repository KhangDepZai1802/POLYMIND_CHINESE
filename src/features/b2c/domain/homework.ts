import { z } from "zod";
import { fromLocalInput } from "@/lib/dates";

export const B2C_HOMEWORK_BUCKET = "b2c-homework-files";
export const B2C_HOMEWORK_MAX_BYTES = 20 * 1024 * 1024;
export const B2C_HOMEWORK_PAGE_SIZE = 20;
export const B2C_HOMEWORK_ASSIGNMENT_ACCEPT = ".pdf,application/pdf";
export const B2C_HOMEWORK_SUBMISSION_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";

export type B2CHomeworkFileKind = "assignment" | "submission";
export type B2CHomeworkSubmission = {
  id: string;
  revision: number;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  submitted_at: string;
  due_at_snapshot: string;
};
export type B2CHomework = {
  id: string;
  class_id: string;
  class_name: string;
  title: string;
  description: string;
  due_at: string;
  created_at: string;
  updated_at: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_by_name: string | null;
  can_manage: boolean;
  can_submit: boolean;
  submission_count: number | null;
  student_count: number | null;
  latest_submission: B2CHomeworkSubmission | null;
};
export type B2CHomeworkClass = { id: string; code: string; name: string };
export type B2CHomeworkPage = {
  rows: B2CHomework[];
  total: number;
  class: (B2CHomeworkClass & Record<string, unknown>) | null;
  schedules: unknown[];
  linked_student: { id: string; full_name: string } | null;
  classes: B2CHomeworkClass[];
  server_now: string;
};
export type B2CHomeworkSubmissionRow = {
  enrollment_id: string;
  student_id: string;
  student_code: string;
  full_name: string;
  has_account: boolean;
  submission: B2CHomeworkSubmission | null;
};
export type B2CHomeworkSubmissionsPage = {
  rows: B2CHomeworkSubmissionRow[];
  total: number;
};
export type B2CHomeworkSubmissionHistory = {
  rows: B2CHomeworkSubmission[];
  total: number;
};
export type B2CHomeworkUploadTicket = {
  uploadId: string;
  path: string;
  token: string;
  bucket: string;
};

const homeworkMimeSchema = z.enum(["application/pdf", "image/jpeg", "image/png"]);
const homeworkFileNameSchema = z.string().trim().min(1).max(180)
  .refine((value) => !/[\u0000-\u001f\u007f/\\]/.test(value), "Tên tệp không hợp lệ.");

export function homeworkFileExtensionMatches(fileName: string, mimeType: string): boolean {
  const extension = fileName.toLowerCase().split(".").at(-1);
  return mimeType === "application/pdf" ? extension === "pdf"
    : mimeType === "image/jpeg" ? extension === "jpg" || extension === "jpeg"
      : mimeType === "image/png" && extension === "png";
}

export const b2cHomeworkUploadSchema = z.object({
  class_id: z.uuid(),
  homework_id: z.uuid().nullable(),
  kind: z.enum(["assignment", "submission"]),
  file_name: homeworkFileNameSchema,
  mime_type: homeworkMimeSchema,
  size_bytes: z.number().int().positive().max(B2C_HOMEWORK_MAX_BYTES, "Tệp tối đa 20 MB."),
  request_id: z.uuid(),
}).superRefine((value, ctx) => {
  if (!homeworkFileExtensionMatches(value.file_name, value.mime_type)) {
    ctx.addIssue({ code: "custom", path: ["file_name"], message: "Đuôi tệp không khớp định dạng." });
  }
  if (value.kind === "assignment") {
    if (value.mime_type !== "application/pdf") {
      ctx.addIssue({ code: "custom", path: ["mime_type"], message: "Đề bài phải là tệp PDF." });
    }
    if (value.homework_id) {
      ctx.addIssue({ code: "custom", path: ["class_id"], message: "Lớp giao bài không hợp lệ." });
    }
  } else if (!value.homework_id) {
    ctx.addIssue({ code: "custom", path: ["homework_id"], message: "Thiếu bài tập cần nộp." });
  }
});

export const b2cHomeworkLocalDeadlineSchema = z.string()
  .regex(/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/, "Nhập ngày và giờ hạn nộp hợp lệ.")
  .refine((value) => z.iso.date().safeParse(value.slice(0, 10)).success && value.slice(0, 4) >= "1900", "Ngày hạn nộp không hợp lệ.");

export function homeworkDeadlineToUtc(value: string): string {
  return fromLocalInput(b2cHomeworkLocalDeadlineSchema.parse(value)).toISOString();
}

const details = {
  title: z.string().trim().min(1, "Nhập tên bài tập.").max(200),
  description: z.string().trim().max(4000).default(""),
  due_at: b2cHomeworkLocalDeadlineSchema,
};
export const b2cHomeworkCreateSchema = z.object({ ...details, upload_id: z.uuid(), request_id: z.uuid() });
export const b2cHomeworkUpdateSchema = z.object({ ...details, id: z.uuid(), expected_updated_at: z.iso.datetime({ offset: true }) });
export const b2cHomeworkArchiveSchema = z.object({ id: z.uuid(), expected_updated_at: z.iso.datetime({ offset: true }) });
export const b2cHomeworkSubmitSchema = z.object({ homework_id: z.uuid(), upload_id: z.uuid(), request_id: z.uuid() });

export const b2cHomeworkStoredFileSchema = z.object({
  object_path: z.string().min(1).max(1024).refine((value) => !value.startsWith("/") && !value.includes("\\") && !value.split("/").some((part) => part === ".." || part === "." || part === "")),
  file_name: homeworkFileNameSchema,
  mime_type: homeworkMimeSchema,
  size_bytes: z.number().int().positive().max(B2C_HOMEWORK_MAX_BYTES),
  bucket: z.literal(B2C_HOMEWORK_BUCKET),
}).refine((value) => homeworkFileExtensionMatches(value.file_name, value.mime_type));

/** Check stored bytes as well as the client filename and Storage MIME metadata. */
export function homeworkFileSignatureMatches(bytes: Uint8Array, mimeType: string): boolean {
  const signature = mimeType === "application/pdf" ? [0x25, 0x50, 0x44, 0x46, 0x2d]
    : mimeType === "image/jpeg" ? [0xff, 0xd8, 0xff]
      : mimeType === "image/png" ? [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] : null;
  return !!signature && signature.every((byte, index) => bytes[index] === byte);
}
