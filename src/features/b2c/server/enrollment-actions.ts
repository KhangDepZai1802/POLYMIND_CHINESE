"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireB2CEnrollmentAccess } from "./enrollment-access";
import {
  b2cEnrollmentCreateSchema,
  type EnrollmentStudentOption,
} from "../enrollment-create-schema";
import { permissionRpc } from "./permission-rpc";

export async function findB2CEnrollmentStudentsAction(
  classId: string,
  query: string,
  page: number,
) {
  await requireB2CEnrollmentAccess();
  const parsed = z
    .object({
      classId: z.uuid(),
      query: z.string().trim().max(200),
      page: z.number().int().min(0).max(1000000),
    })
    .safeParse({ classId, query, page });
  if (!parsed.success) throw new Error("Bộ lọc học viên không hợp lệ.");
  return permissionRpc<{ rows: EnrollmentStudentOption[]; total: number }>(
    "find_b2c_enrollment_students",
    { p_class_id: classId, p_query: parsed.data.query, p_page: page },
  );
}
export async function addB2CClassStudentAction(
  form: FormData,
): Promise<{ success?: string; error?: string }> {
  await requireB2CEnrollmentAccess();
  const parsed = b2cEnrollmentCreateSchema.safeParse(
    form instanceof FormData ? Object.fromEntries(form) : null,
  );
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
    };
  try {
    await permissionRpc<string>("add_b2c_class_student", {
      p_data: parsed.data,
    });
    revalidatePath("/admin/b2c", "layout");
    revalidatePath("/teacher/classes");
    revalidatePath("/teacher/tuition");
    revalidatePath("/teacher/b2c-classes/[classId]", "page");
    return { success: "Đã thêm học viên vào lớp." };
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Không thêm được học viên. Vui lòng thử lại.",
    };
  }
}
