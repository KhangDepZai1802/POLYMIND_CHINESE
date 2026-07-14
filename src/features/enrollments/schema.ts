import { z } from "zod";

const ENROLLMENT_STATUSES = [
  "pending",
  "active",
  "paused",
  "completed",
  "withdrawn",
  "transferred",
] as const;

const optionalReason = z
  .string()
  .trim()
  .max(500, { message: "Lý do tối đa 500 ký tự" })
  .transform((v) => (v === "" ? null : v))
  .nullable();

export const enrollStudentSchema = z.object({
  student_id: z.uuid({ message: "Chọn học viên" }),
  class_id: z.uuid(),
  // Ghi danh mở ra ở trạng thái `pending` (chờ xếp lớp) hoặc `active` (vào học ngay).
  status: z.enum(["pending", "active"], { message: "Chọn trạng thái ghi danh" }),
  reason: optionalReason,
});

export const changeEnrollmentStatusSchema = z.object({
  enrollment_id: z.uuid(),
  class_id: z.uuid(),
  new_status: z.enum(ENROLLMENT_STATUSES, { message: "Trạng thái không hợp lệ" }),
  reason: optionalReason,
});

export const transferEnrollmentSchema = z.object({
  enrollment_id: z.uuid(),
  class_id: z.uuid(), // lớp NGUỒN — chỉ để revalidate đúng trang
  to_class_id: z.uuid({ message: "Chọn lớp đích" }),
  reason: optionalReason,
});

export type EnrollStudentInput = z.infer<typeof enrollStudentSchema>;
export type ChangeEnrollmentStatusInput = z.infer<
  typeof changeEnrollmentStatusSchema
>;
export type TransferEnrollmentInput = z.infer<typeof transferEnrollmentSchema>;
