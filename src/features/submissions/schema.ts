import { z } from "zod";

export const submitAssignmentSchema = z.object({
  assignment_id: z.uuid(),
  text_answer: z
    .string()
    .trim()
    .max(20000, { message: "Bài làm tối đa 20.000 ký tự" })
    .transform((value) => (value === "" ? null : value))
    .nullable(),
});

export const submissionFileRegisterSchema = z.object({
  submission_id: z.uuid(),
  assignment_id: z.uuid(),
  object_path: z.string().trim().min(1),
  file_name: z
    .string()
    .trim()
    .min(1, { message: "Tên tệp không được để trống" })
    .max(255, { message: "Tên tệp tối đa 255 ký tự" }),
});

export type SubmitAssignmentInput = z.infer<typeof submitAssignmentSchema>;
