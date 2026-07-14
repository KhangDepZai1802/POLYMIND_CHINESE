import { z } from "zod";

const optionalUuid = z
  .union([z.literal(""), z.literal("none"), z.uuid()])
  .nullish()
  .transform((value) =>
    value === undefined || value === null || value === "" || value === "none"
      ? null
      : value,
  );

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Ngày kiểm tra không hợp lệ",
  })
  .transform((value) => (value === "" ? null : value));

/**
 * Ô điểm bỏ trống ≠ 0 điểm.
 *
 * `z.coerce.number()` biến chuỗi rỗng thành **0** — nghĩa là giáo viên chưa chấm
 * kỹ năng nào thì kỹ năng đó bị ghi 0 vào học bạ. Ở đây rỗng phải ra `null`.
 */
const optionalScore = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : Number(value)))
  .refine(
    (value) =>
      value === null || (Number.isFinite(value) && value >= 0 && value <= 100),
    { message: "Điểm phải từ 0 đến 100" },
  );

const assessmentFields = {
  type: z.enum(["quiz", "midterm", "final", "mock_hsk", "speaking", "custom"]),
  title: z
    .string()
    .trim()
    .min(3, { message: "Tên bài kiểm tra tối thiểu 3 ký tự" })
    .max(200, { message: "Tên bài kiểm tra tối đa 200 ký tự" }),
  assessment_date: optionalDate,
  // Thang phân loại (Yếu → Xuất sắc) chạy trên 0..100 nên bài KT cũng chấm trên
  // thang đó. DB có CHECK tương ứng; đây chỉ là lưới chặn sớm cho người dùng.
  max_score: z.coerce
    .number()
    .positive({ message: "Điểm tối đa phải lớn hơn 0" })
    .max(100, { message: "Điểm tối đa không vượt quá 100" }),
  lesson_id: optionalUuid,
  module_id: optionalUuid,
};

export const assessmentCreateSchema = z.object({
  class_id: z.uuid(),
  ...assessmentFields,
});

export const assessmentUpdateSchema = z.object(assessmentFields);

export const assessmentResultSchema = z.object({
  assessment_id: z.uuid(),
  class_id: z.uuid(),
  enrollment_id: z.uuid(),
  overall_score: optionalScore,
  listening_score: optionalScore,
  speaking_score: optionalScore,
  reading_score: optionalScore,
  writing_score: optionalScore,
  vocabulary_score: optionalScore,
  grammar_score: optionalScore,
  feedback: z
    .string()
    .trim()
    .max(5000, { message: "Nhận xét tối đa 5.000 ký tự" })
    .transform((value) => (value === "" ? null : value))
    .nullable(),
});

export type AssessmentCreateInput = z.infer<typeof assessmentCreateSchema>;
export type AssessmentUpdateInput = z.infer<typeof assessmentUpdateSchema>;
export type AssessmentResultInput = z.infer<typeof assessmentResultSchema>;

/** 6 kỹ năng, dùng chung cho form nhập điểm và nhãn hiển thị. */
export const SKILL_FIELDS = [
  { name: "listening_score", label: "Nghe" },
  { name: "speaking_score", label: "Nói" },
  { name: "reading_score", label: "Đọc" },
  { name: "writing_score", label: "Viết" },
  { name: "vocabulary_score", label: "Từ vựng" },
  { name: "grammar_score", label: "Ngữ pháp" },
] as const;

export type SkillField = (typeof SKILL_FIELDS)[number]["name"];
