import { z } from "zod";

const CLASS_STATUSES = [
  "planned",
  "active",
  "paused",
  "completed",
  "cancelled",
] as const;
const DELIVERY_MODES = ["offline", "online", "hybrid", "in_house"] as const;

const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

const optionalPositiveInt = z
  .union([z.literal(""), z.coerce.number().int().positive()])
  .transform((value) => (value === "" ? null : value))
  .nullable();

const optionalDate = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable();

export const classSchema = z
  .object({
    course_id: z.uuid({ message: "Chọn khóa học" }),
    name: z.string().trim().min(3, { message: "Tên lớp tối thiểu 3 ký tự" }),
    target_audience: optionalText,
    capacity: z.coerce
      .number()
      .int()
      .positive({ message: "Sĩ số phải lớn hơn 0" }),
    planned_session_count: optionalPositiveInt,
    session_duration_minutes: optionalPositiveInt,
    start_date: optionalDate,
    expected_end_date: optionalDate,
    delivery_mode: z.enum(DELIVERY_MODES, { message: "Chọn hình thức học" }),
    location_name: optionalText,
    address: optionalText,
    meeting_url: z
      .union([z.literal(""), z.url({ message: "Link phòng học không hợp lệ" })])
      .transform((value) => (value === "" ? null : value))
      .nullable(),
    location_note: optionalText,
    status: z.enum(CLASS_STATUSES),
  })
  .superRefine((data, context) => {
    if (
      data.start_date &&
      data.expected_end_date &&
      data.expected_end_date < data.start_date
    ) {
      context.addIssue({
        code: "custom",
        path: ["expected_end_date"],
        message: "Ngày dự kiến kết thúc phải từ ngày khai giảng trở đi",
      });
    }

    if (data.status === "active") {
      if (!data.start_date) {
        context.addIssue({
          code: "custom",
          path: ["start_date"],
          message: "Lớp đang học phải có ngày khai giảng",
        });
      }
      if (!data.planned_session_count) {
        context.addIssue({
          code: "custom",
          path: ["planned_session_count"],
          message: "Lớp đang học phải chốt số buổi",
        });
      }
      if (!data.session_duration_minutes) {
        context.addIssue({
          code: "custom",
          path: ["session_duration_minutes"],
          message: "Lớp đang học phải chốt thời lượng buổi",
        });
      }
    }
  });

export const teacherAssignmentSchema = z.object({
  class_id: z.uuid(),
  teacher_id: z.uuid({ message: "Chọn giáo viên" }),
});

export type ClassInput = z.infer<typeof classSchema>;
