"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireStudentDataAccess } from "./student-data";
import { permissionRpc } from "./permission-rpc";
import { B2C_CUSTOMER_SOURCES } from "../domain/customer-source";
const date = z.union([z.literal(""), z.iso.date()]);
const schema = z.object({
  student_id: z.uuid(), enrollment_id: z.union([z.literal(""), z.uuid()]), student_updated_at: z.string().min(1), enrollment_updated_at: z.string(),
  phone: z.string().trim().regex(/^(?:[0-9]{10})?$/, "SĐT phải có đúng 10 chữ số."),
  customer_source: z.union([z.literal(""), z.enum(B2C_CUSTOMER_SOURCES)]),
  referrer_name: z.string().trim().max(200), salesperson: z.string().trim().max(200),
  enrollment_date: date, learning_start_date: date, tuition_end_date: date,
}).refine(v => v.customer_source !== "referral" || !!v.referrer_name, "Nhập người giới thiệu.")
  .refine(v => !v.tuition_end_date || !!v.learning_start_date && v.tuition_end_date >= v.learning_start_date, "Ngày hết phí cần bằng hoặc sau ngày bắt đầu học.");
export async function saveStudentDataAction(form: FormData) {
  await requireStudentDataAccess();
  const input = Object.fromEntries(form);
  for (const key of ["salesperson", "enrollment_date", "learning_start_date", "tuition_end_date"])
    input[key] ??= "";
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Kiểm tra thông tin." };
  try { await permissionRpc("save_center_b2c_student_data", { p_data: parsed.data }); }
  catch (e) { return { error: e instanceof Error ? e.message : "Không lưu được hồ sơ." }; }
  revalidatePath("/teacher/students");
  revalidatePath("/teacher/tuition");
  revalidatePath("/teacher/b2c-classes/[classId]", "page");
  revalidatePath("/admin/b2c", "layout");
  return { success: true };
}
