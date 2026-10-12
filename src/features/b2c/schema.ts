import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .transform((value) => value || null);

export const b2cClassSchema = z
  .object({
    program_slug: z.enum([
      "tieng-anh",
      "tieng-trung",
      "tieng-viet",
      "lop-ve",
      "kem-1-1",
    ]),
    name: z.string().trim().min(3, "Tên lớp tối thiểu 3 ký tự"),
    level_name: optionalText,
    teacher_name: optionalText,
    weekdays_text: optionalText,
    time_text: optionalText,
    capacity: z.coerce.number().int().positive("Sĩ số phải lớn hơn 0"),
    enrolled_count: z.coerce.number().int().min(0, "Số học viên không được âm"),
    campus: optionalText,
    delivery_mode: z.enum(["offline", "online", "hybrid"]),
    start_date: optionalText,
    status: z.enum(["planned", "active", "paused", "completed", "cancelled"]),
    notes: optionalText,
  })
  .superRefine((data, context) => {
    if (data.enrolled_count > data.capacity) {
      context.addIssue({
        code: "custom",
        path: ["enrolled_count"],
        message: "Số học viên không được vượt sĩ số tối đa",
      });
    }
  });

const nonNegativeInteger = z.coerce
  .number()
  .int("Chỉ nhận số nguyên")
  .min(0, "Giá trị không được âm");

export const b2cMonthlyReportSchema = z.object({
  report_year: z.coerce.number().int().min(2000).max(2100),
  report_month: z.coerce.number().int().min(1).max(12),
  revenue: nonNegativeInteger,
  electricity: nonNegativeInteger,
  water: nonNegativeInteger,
  internet: nonNegativeInteger,
  payroll: nonNegativeInteger,
  rent: nonNegativeInteger,
  marketing: nonNegativeInteger,
  advertising: nonNegativeInteger,
  other: nonNegativeInteger,
  notes: optionalText,
  metrics: z
    .array(
      z.object({
        program_slug: z.enum([
          "tieng-anh",
          "tieng-trung",
          "tieng-viet",
          "lop-ve",
          "kem-1-1",
        ]),
        opening_students: nonNegativeInteger,
        new_students: nonNegativeInteger,
        departed_students: nonNegativeInteger,
        lessons_taught: nonNegativeInteger,
        lessons_paid: nonNegativeInteger,
      }),
    )
    .superRefine((metrics, context) => {
      metrics.forEach((metric, index) => {
        if (
          metric.opening_students + metric.new_students <
          metric.departed_students
        ) {
          context.addIssue({
            code: "custom",
            path: [index, "departed_students"],
            message: "Số giảm không được lớn hơn số học viên hiện có",
          });
        }
      });
    }),
});
