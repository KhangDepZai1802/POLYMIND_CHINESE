import { z } from "zod";

const RATINGS = ["weak", "average", "good", "excellent"] as const;

/** Rating bỏ trống = chưa đánh giá kỹ năng đó, KHÔNG phải "weak". */
const optionalRating = z
  .union([z.literal(""), z.literal("none"), z.enum(RATINGS)])
  .nullish()
  .transform((value) =>
    value === undefined || value === null || value === "" || value === "none"
      ? null
      : value,
  );

const optionalText = z
  .string()
  .trim()
  .max(5000, { message: "Nội dung tối đa 5.000 ký tự" })
  .transform((value) => (value === "" ? null : value))
  .nullable();

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
    message: "Ngày không hợp lệ",
  })
  .transform((value) => (value === "" ? null : value));

const evaluationFields = {
  evaluation_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Chọn ngày đánh giá" }),
  period_start: optionalDate,
  period_end: optionalDate,
  overall_rating: optionalRating,
  listening_rating: optionalRating,
  speaking_rating: optionalRating,
  reading_rating: optionalRating,
  writing_rating: optionalRating,
  vocabulary_rating: optionalRating,
  grammar_rating: optionalRating,
  strengths: optionalText,
  areas_for_improvement: optionalText,
  action_plan: optionalText,
  teacher_comment: optionalText,
};

export const evaluationCreateSchema = z
  .object({
    enrollment_id: z.uuid(),
    ...evaluationFields,
  })
  .refine(
    (data) =>
      !data.period_start ||
      !data.period_end ||
      data.period_end >= data.period_start,
    { message: "Kỳ đánh giá kết thúc trước khi bắt đầu", path: ["period_end"] },
  );

export const evaluationUpdateSchema = z
  .object(evaluationFields)
  .refine(
    (data) =>
      !data.period_start ||
      !data.period_end ||
      data.period_end >= data.period_start,
    { message: "Kỳ đánh giá kết thúc trước khi bắt đầu", path: ["period_end"] },
  );

export const noteCreateSchema = z.object({
  enrollment_id: z.uuid(),
  body: z
    .string()
    .trim()
    .min(3, { message: "Ghi chú tối thiểu 3 ký tự" })
    .max(5000, { message: "Ghi chú tối đa 5.000 ký tự" }),
  visibility: z.enum(["staff_only", "student_visible"], {
    message: "Chọn phạm vi hiển thị",
  }),
});

export type EvaluationCreateInput = z.infer<typeof evaluationCreateSchema>;
export type NoteCreateInput = z.infer<typeof noteCreateSchema>;

/** 6 kỹ năng + đánh giá chung — dùng chung cho form và hiển thị. */
export const RATING_FIELDS = [
  { name: "overall_rating", label: "Đánh giá chung" },
  { name: "listening_rating", label: "Nghe" },
  { name: "speaking_rating", label: "Nói" },
  { name: "reading_rating", label: "Đọc" },
  { name: "writing_rating", label: "Viết" },
  { name: "vocabulary_rating", label: "Từ vựng" },
  { name: "grammar_rating", label: "Ngữ pháp" },
] as const;

export type RatingField = (typeof RATING_FIELDS)[number]["name"];
