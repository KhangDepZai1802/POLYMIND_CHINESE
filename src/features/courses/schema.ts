import { z } from "zod";

const COURSE_TYPES = [
  "hsk",
  "communication",
  "kids",
  "exam_prep",
  "business_custom",
  "custom",
] as const;

const COURSE_STATUSES = ["draft", "active", "archived"] as const;

/** Mã nghiệp vụ: chữ HOA, số, gạch ngang. Không dấu, không khoảng trắng. */
const codeSchema = z
  .string()
  .trim()
  .min(2, { message: "Mã phải có ít nhất 2 ký tự" })
  .max(30, { message: "Mã tối đa 30 ký tự" })
  .regex(/^[A-Z0-9-]+$/, {
    message: "Mã chỉ gồm chữ IN HOA, số và dấu gạch ngang (VD: HSK1, VCB-BANK)",
  });

/** Ô số để trống → null, KHÔNG phải 0. "Chưa biết" khác "bằng 0". */
const optionalPositiveInt = z
  .union([z.literal(""), z.coerce.number().int().positive()])
  .transform((v) => (v === "" ? null : v))
  .nullable();

const optionalAmount = z
  .union([z.literal(""), z.coerce.number().nonnegative()])
  .transform((v) => (v === "" ? null : v))
  .nullable();

const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => (v === "" ? null : v))
  .transform((v) => v ?? null);

export const courseSchema = z.object({
  code: codeSchema,
  title: z.string().trim().min(3, { message: "Tên khóa học tối thiểu 3 ký tự" }),
  title_en: optionalText,
  course_type: z.enum(COURSE_TYPES, { message: "Chọn loại khóa học" }),
  level_id: z
    .string()
    .trim()
    .transform((v) => (v === "" || v === "none" ? null : v))
    .nullable(),
  target_audience: optionalText,
  objectives: optionalText,
  description: optionalText,

  // Để trống là hợp lệ: trung tâm chưa chốt số buổi cho khóa cốt lõi.
  // Số buổi THẬT được chốt ở từng lớp triển khai.
  default_session_count: optionalPositiveInt,
  default_session_duration_minutes: optionalPositiveInt,
  default_tuition_amount: optionalAmount,

  completion_min_attendance_rate: z.coerce
    .number()
    .min(0, { message: "Từ 0 đến 100" })
    .max(100, { message: "Từ 0 đến 100" }),
  completion_min_overall_score: z.coerce
    .number()
    .min(0, { message: "Từ 0 đến 100" })
    .max(100, { message: "Từ 0 đến 100" }),
  completion_require_all_assignments: z.coerce.boolean(),

  status: z.enum(COURSE_STATUSES),
});

export const levelSchema = z.object({
  code: codeSchema,
  name: z.string().trim().min(1, { message: "Nhập tên bậc" }),
  framework: z.string().trim().min(1).default("HSK"),
  order_index: z.coerce.number().int().min(0),
  description: optionalText,
});

export const moduleSchema = z.object({
  course_id: z.uuid(),
  title: z.string().trim().min(2, { message: "Nhập tên chương" }),
  description: optionalText,
  order_index: z.coerce.number().int().min(1, { message: "Thứ tự từ 1 trở lên" }),
});

export const lessonSchema = z.object({
  module_id: z.uuid(),
  title: z.string().trim().min(2, { message: "Nhập tên bài học" }),
  objectives: optionalText,
  content_summary: optionalText,
  planned_duration_minutes: optionalPositiveInt,
  order_index: z.coerce.number().int().min(1, { message: "Thứ tự từ 1 trở lên" }),
});

// --- Tài liệu khóa học -------------------------------------------------------

const MATERIAL_VISIBILITIES = ["staff_only", "enrolled_students"] as const;

/**
 * Select rỗng / "none" / field không được gửi → null.
 *
 * Khi gắn tài liệu ở cấp khóa học, form không có module/lesson để gửi. Đây là
 * trạng thái hợp lệ, không phải lỗi validation.
 */
const optionalUuid = z
  .union([z.literal(""), z.literal("none"), z.uuid()])
  .nullish()
  .transform((v) => (v === undefined || v === null || v === "" || v === "none" ? null : v));

const materialTitle = z
  .string()
  .trim()
  .min(2, { message: "Tên tài liệu tối thiểu 2 ký tự" })
  .max(200, { message: "Tên tài liệu tối đa 200 ký tự" });

/**
 * Ghi nhận metadata SAU khi file đã lên storage.
 *
 * `object_path` KHÔNG lấy từ đây một cách mù quáng: action phải kiểm nó nằm
 * đúng thư mục `course_id` và file có thật trên storage. Client gửi path trỏ
 * sang course khác là bị từ chối.
 */
export const materialRegisterSchema = z.object({
  course_id: z.uuid(),
  object_path: z.string().trim().min(1),
  title: materialTitle,
  module_id: optionalUuid,
  lesson_id: optionalUuid,
  visibility: z.enum(MATERIAL_VISIBILITIES, { message: "Chọn phạm vi hiển thị" }),
});

export const materialUpdateSchema = z.object({
  title: materialTitle,
  visibility: z.enum(MATERIAL_VISIBILITIES, { message: "Chọn phạm vi hiển thị" }),
});

export type MaterialRegisterInput = z.infer<typeof materialRegisterSchema>;
export type MaterialUpdateInput = z.infer<typeof materialUpdateSchema>;

export type CourseInput = z.infer<typeof courseSchema>;
export type LevelInput = z.infer<typeof levelSchema>;
export type ModuleInput = z.infer<typeof moduleSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;
