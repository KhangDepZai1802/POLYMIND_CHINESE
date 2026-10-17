"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireManager } from "@/lib/auth/session";
import { enrollmentLifecycleSchema, type EnrollmentLifecycleContext } from "../domain/enrollment-lifecycle";
import { permissionRpc } from "./permission-rpc";

export async function readEnrollmentLifecycleAction(enrollmentId: string, page = 0) {
  await requireManager();
  const input = z.object({ enrollmentId: z.uuid(), page: z.number().int().min(0).max(1000000) }).parse({ enrollmentId, page });
  return permissionRpc<EnrollmentLifecycleContext>("read_b2c_enrollment_lifecycle", { p_enrollment_id: input.enrollmentId, p_page: input.page });
}

export async function saveEnrollmentLifecycleAction(input: unknown) {
  await requireManager();
  const parsed = enrollmentLifecycleSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Kiểm tra thông tin." };
  try {
    const enrollmentId = await permissionRpc<string>("write_b2c_enrollment_lifecycle", { p_data: parsed.data });
    revalidatePath("/admin/b2c", "layout");
    revalidatePath("/teacher/classes");
    revalidatePath("/teacher/attendance");
    revalidatePath("/teacher/b2c-classes/[classId]", "page");
    return { enrollmentId };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Không lưu được thao tác. Vui lòng thử lại." };
  }
}
