import { z } from "zod";
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
export const b2cTeacherSchema = z.object({
  id: z.union([z.uuid(), z.literal("")]),
  full_name: z.string().trim().min(2, "Nhập họ tên giáo viên").max(200),
  phone: text(30),
  email: z
    .union([z.literal(""), z.email({ message: "Email liên hệ không hợp lệ" })])
    .transform((v) => v || null),
  specialization: text(1000),
  employment_type: z.enum(["full_time", "part_time"], {
    message: "Chọn hình thức làm việc",
  }),
  hourly_rate: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce
      .number({ message: "Nhập đơn giá / giờ" })
      .int("Đơn giá phải là số nguyên VNĐ")
      .min(0, "Đơn giá không được âm")
      .max(999999999999),
  ),
});
export type B2CTeacher = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  specialization: string | null;
  employment_type: "full_time" | "part_time" | null;
  hourly_rate: number | null;
};
