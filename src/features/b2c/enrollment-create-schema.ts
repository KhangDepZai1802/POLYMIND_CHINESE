import { z } from "zod";
import { B2C_CUSTOMER_SOURCES } from "./domain/customer-source";
import { B2C_LEARNING_GOALS } from "./domain/learning-goal";
const text = (max: number) => z.string().trim().max(max).default("");
const date = z.union([z.literal(""), z.iso.date()]).default("");
export const b2cEnrollmentCreateSchema = z
  .object({
    request_id: z.uuid(),
    class_id: z.uuid(),
    mode: z.enum(["new", "existing"]),
    student_id: z.union([z.literal(""), z.uuid()]).default(""),
    full_name: text(200),
    phone: text(30),
    guardian_name: text(200),
    guardian_zalo: z
      .string()
      .trim()
      .regex(/^(?:[0-9]{10})?$/, "Số Zalo phụ huynh phải có đúng 10 chữ số.")
      .default(""),
    email: z.union([z.literal(""), z.email()]).default(""),
    address: text(1000),
    date_of_birth: date,
    customer_source: z
      .union([z.literal(""), z.enum(B2C_CUSTOMER_SOURCES)])
      .default(""),
    referrer_name: text(200),
    salesperson: z.string().trim().min(1, "Vui lòng nhập người chốt.").max(200),
    enrollment_date: z.iso.date("Vui lòng nhập ngày nhập học."),
    learning_start_date: date,
    tuition_end_date: date,
    learning_goal: z
      .union([z.literal(""), z.enum(B2C_LEARNING_GOALS)])
      .default(""),
    certificate_goal: text(200),
    notes: text(2000),
  })
  .superRefine((v, ctx) => {
    if (v.mode === "new") {
      if (v.full_name.length < 2)
        ctx.addIssue({
          code: "custom",
          path: ["full_name"],
          message: "Họ tên tối thiểu 2 ký tự.",
        });
      if (v.phone && !/^[0-9]{10}$/.test(v.phone))
        ctx.addIssue({
          code: "custom",
          path: ["phone"],
          message: "SĐT phải có đúng 10 chữ số.",
        });
      if (v.customer_source === "referral" && !v.referrer_name)
        ctx.addIssue({
          code: "custom",
          path: ["referrer_name"],
          message: "Nhập tên người giới thiệu.",
        });
    } else if (!v.student_id)
      ctx.addIssue({
        code: "custom",
        path: ["student_id"],
        message: "Vui lòng chọn học viên đã có.",
      });
    if (v.learning_goal === "certificate" && !v.certificate_goal)
      ctx.addIssue({
        code: "custom",
        path: ["certificate_goal"],
        message: "Nhập chứng chỉ mục tiêu.",
      });
    if (
      v.tuition_end_date &&
      (!v.learning_start_date || v.tuition_end_date < v.learning_start_date)
    )
      ctx.addIssue({
        code: "custom",
        path: ["tuition_end_date"],
        message: "Ngày hết phí cần bằng hoặc sau ngày bắt đầu học.",
      });
  });
export type EnrollmentStudentOption = {
  id: string;
  code: string;
  full_name: string;
  phone: string | null;
  guardian_name: string | null;
  date_of_birth: string | null;
};
