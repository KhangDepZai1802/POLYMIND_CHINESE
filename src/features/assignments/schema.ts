import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const optionalUuid = z
  .union([z.literal(""), z.literal("none"), z.uuid()])
  .nullish()
  .transform((value) =>
    value === undefined || value === null || value === "" || value === "none"
      ? null
      : value,
  );

const optionalLocalDateTime = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value),
    { message: "Thời hạn không hợp lệ" },
  )
  .transform((value) => (value === "" ? null : value));

const assignmentFields = {
  title: z
    .string()
    .trim()
    .min(3, { message: "Tên bài tập tối thiểu 3 ký tự" })
    .max(200, { message: "Tên bài tập tối đa 200 ký tự" }),
  instructions: optionalText,
  due_at: optionalLocalDateTime,
  max_score: z.coerce
    .number()
    .positive({ message: "Điểm tối đa phải lớn hơn 0" })
    .max(999.99, { message: "Điểm tối đa không vượt quá 999,99" }),
  allow_late_submission: z.coerce.boolean(),
  max_attempts: z.coerce
    .number()
    .int()
    .min(1, { message: "Số lần nộp tối thiểu là 1" })
    .max(20, { message: "Số lần nộp tối đa là 20" }),
  lesson_id: optionalUuid,
  session_id: optionalUuid,
};

export const assignmentCreateSchema = z.object({
  class_id: z.uuid(),
  ...assignmentFields,
});

export const assignmentUpdateSchema = z.object(assignmentFields);

export const assignmentAttachmentRegisterSchema = z.object({
  assignment_id: z.uuid(),
  class_id: z.uuid(),
  object_path: z.string().trim().min(1),
  file_name: z
    .string()
    .trim()
    .min(1, { message: "Tên tệp không được để trống" })
    .max(255, { message: "Tên tệp tối đa 255 ký tự" }),
});

export const gradeSubmissionSchema = z.object({
  submission_id: z.uuid(),
  assignment_id: z.uuid(),
  class_id: z.uuid(),
  score: z.coerce
    .number()
    .min(0, { message: "Điểm không được âm" })
    .max(999.99, { message: "Điểm không hợp lệ" }),
  feedback: z
    .string()
    .trim()
    .max(5000, { message: "Nhận xét tối đa 5.000 ký tự" })
    .transform((value) => (value === "" ? null : value))
    .nullable(),
});

export type AssignmentCreateInput = z.infer<typeof assignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof assignmentUpdateSchema>;
export type GradeSubmissionInput = z.infer<typeof gradeSubmissionSchema>;
