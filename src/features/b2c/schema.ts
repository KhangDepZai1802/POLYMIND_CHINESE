import { z } from "zod";
import { B2C_STUDENT_STATUSES } from "@/features/b2c/domain/student-status";
import { B2C_CUSTOMER_SOURCES } from "@/features/b2c/domain/customer-source";
import { B2C_LEARNING_GOALS } from "@/features/b2c/domain/learning-goal";
import { ADMISSION_STAGES } from "@/features/b2c/domain/admissions";
import { PARENT_RELATIONSHIPS } from "@/features/b2c/domain/parents";

export const b2cParentSchema = z.object({
  id: z.union([z.literal(""), z.uuid()]),
  full_name: z.string().trim().min(1, "Vui lòng nhập tên phụ huynh").max(200),
  phone: z.union([z.literal(""), z.string().regex(/^[0-9]{10}$/, "SĐT phải có đúng 10 chữ số")]),
  zalo: z.string().trim().max(200),
  relationship: z.enum(PARENT_RELATIONSHIPS),
  student_codes: z.string().max(20000).transform((value) => [...new Set(value.split(/[\s,;]+/).filter(Boolean).map((code) => code.toUpperCase()))]).pipe(z.array(z.string().regex(/^B2C-HV\d{6,}$/, "Mã học viên không hợp lệ")).max(100)),
});

export const b2cCareLogSchema = z.object({
  lead_id: z.uuid(),
  channel: z.enum(["call", "message"]),
  contact_date: z.iso.date("Ngày liên hệ không hợp lệ"),
  caretaker_name: z.string().trim().min(1, "Vui lòng nhập người phụ trách").max(200),
  content: z.string().trim().min(1, "Vui lòng nhập nội dung chăm sóc").max(2000),
  next_followup_date: z.union([z.literal(""), z.iso.date()]).transform((value) => value || null),
}).superRefine((value, ctx) => {
  if (value.next_followup_date && value.next_followup_date < value.contact_date) ctx.addIssue({ code: "custom", path: ["next_followup_date"], message: "Ngày hẹn tiếp theo không được trước ngày liên hệ" });
});

export const b2cAdmissionSchema = z.object({
  id: z.union([z.literal(""), z.uuid()]),
  full_name: z.string().trim().min(1, "Vui lòng nhập tên khách").max(200),
  phone: z.string().trim().regex(/^[0-9]{10}$/, "SĐT phải có đúng 10 chữ số"),
  program_slug: z.enum(["tieng-anh", "tieng-trung", "tieng-viet", "lop-ve", "kem-1-1"]),
  salesperson: z.string().trim().min(1, "Vui lòng nhập người phụ trách").max(200),
  stage: z.enum(ADMISSION_STAGES),
  customer_source: z.union([z.literal(""), z.enum(B2C_CUSTOMER_SOURCES)]),
  referrer_name: z.string().trim().max(200),
  notes: z.string().trim().max(2000),
  failure_reason: z.string().trim().max(1000),
}).superRefine((value, ctx) => {
  if (value.stage === "lost" && !value.failure_reason) ctx.addIssue({code: "custom", path: ["failure_reason"], message: "Vui lòng nhập lý do thất bại"});
  if (value.customer_source === "referral" && !value.referrer_name) ctx.addIssue({code: "custom", path: ["referrer_name"], message: "Vui lòng nhập tên người giới thiệu"});
}).transform((value) => ({ ...value, customer_source: value.customer_source || null,
  referrer_name: value.customer_source === "referral" ? value.referrer_name : null,
  failure_reason: value.stage === "lost" ? value.failure_reason : null, notes: value.notes || null,
}));

export const b2cStudentStatusSchema = z.object({
  enrollment_id: z.uuid(),
  status: z.enum(B2C_STUDENT_STATUSES),
  withdrawal_reason: z.string().trim().max(1000, "Lý do nghỉ tối đa 1.000 ký tự"),
}).transform((value) => ({
  ...value,
  withdrawal_reason: value.status === "withdrawn" ? value.withdrawal_reason || null : null,
}));

const optionalText = z
  .string()
  .trim()
  .transform((value) => value || null);

const optionalDate = z.union([z.literal(""), z.iso.date()]).transform((value) => value || null);

export const b2cEnrollmentEditSchema = z.object({
  learning_goal: z.union([z.literal(""), z.enum(B2C_LEARNING_GOALS)]),
  certificate_goal: z.string().trim().max(200, "Tên chứng chỉ tối đa 200 ký tự"),
  customer_source: z.union([z.literal(""), z.enum(B2C_CUSTOMER_SOURCES)]),
  referrer_name: z.string().trim().max(200, "Tên người giới thiệu tối đa 200 ký tự"),
  enrollment_id: z.uuid(),
  phone: z.string().trim().regex(/^[0-9]{10}$/, "SĐT phải có đúng 10 chữ số"),
  salesperson: z.string().trim().min(1, "Vui lòng nhập người chốt").max(200),
  enrollment_date: z.iso.date("Vui lòng nhập ngày nhập học hợp lệ"),
  program_slug: z.enum(["tieng-anh", "tieng-trung", "tieng-viet", "lop-ve", "kem-1-1"], "Vui lòng chọn chương trình"),
  learning_start_date: optionalDate,
  tuition_end_date: optionalDate,
  status: z.enum(B2C_STUDENT_STATUSES),
  withdrawal_reason: z.string().trim().max(1000, "Lý do nghỉ tối đa 1.000 ký tự"),
}).superRefine((value, ctx) => {
  if (value.learning_goal === "certificate" && !value.certificate_goal) {
    ctx.addIssue({ code: "custom", path: ["certificate_goal"], message: "Vui lòng nhập tên chứng chỉ mục tiêu" });
  }
  if (value.customer_source === "referral" && !value.referrer_name) {
    ctx.addIssue({ code: "custom", path: ["referrer_name"], message: "Vui lòng nhập tên người giới thiệu" });
  }
  if (value.tuition_end_date && !value.learning_start_date) {
    ctx.addIssue({ code: "custom", path: ["learning_start_date"], message: "Nhập ngày bắt đầu học để kiểm tra ngày hết phí" });
  } else if (value.tuition_end_date && value.learning_start_date && value.tuition_end_date < value.learning_start_date) {
    ctx.addIssue({ code: "custom", path: ["tuition_end_date"], message: "Ngày hết phí không được trước ngày bắt đầu học" });
  }
}).transform((value) => ({ ...value, learning_goal: value.learning_goal || null, certificate_goal: value.learning_goal === "certificate" ? value.certificate_goal : null, customer_source: value.customer_source || null, referrer_name: value.customer_source === "referral" ? value.referrer_name : null, withdrawal_reason: value.status === "withdrawn" ? value.withdrawal_reason || null : null }));

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
    start_date: optionalDate,
    end_date: optionalDate.default(null),
    status: z.enum(["planned", "active", "paused", "completed", "cancelled"]),
    notes: optionalText,
  })
  .superRefine((data, context) => {
    if (data.start_date && data.end_date && data.end_date < data.start_date) {
      context.addIssue({ code: "custom", path: ["end_date"], message: "Ngày kết thúc khóa học không được trước ngày khai giảng." });
    }
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
  teacher_payroll: z.preprocess((value) => value === null || value === "" ? undefined : value, nonNegativeInteger),
  office_payroll: z.preprocess((value) => value === null || value === "" ? undefined : value, nonNegativeInteger),
  rent: nonNegativeInteger,
  marketing: z.preprocess((value) => value === null || value === "" ? undefined : value, nonNegativeInteger),
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
