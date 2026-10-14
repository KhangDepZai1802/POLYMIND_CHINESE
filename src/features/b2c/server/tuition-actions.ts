"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  b2cTuitionPackageSchema,
  b2cReceiptSchema,
} from "@/features/b2c/tuition-schema";
import { requireManager } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";

export async function saveB2CTuitionPackageAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireManager();
  const parsed = b2cTuitionPackageSchema.safeParse(
    Object.fromEntries(form.entries()),
  );
  if (!parsed.success) return zodToActionState(parsed.error);
  const v = parsed.data;
  const { error } = await (
    await createClient()
  ).rpc("save_b2c_tuition_package", {
    p_enrollment_id: v.enrollment_id,
    p_sessions: v.sessions,
    p_unit_price: v.unit_price,
    p_discount: v.discount,
    p_discount_reason: v.discount_reason,
  });
  if (error) return { error: dbErrorToMessage(error) };
  revalidatePath("/admin/b2c/tuition");
  revalidatePath("/admin/b2c/classes/[classId]", "page");
  const classId = form.get("class_id");
  if (typeof classId === "string" && z.uuid().safeParse(classId).success)
    revalidatePath(`/admin/b2c/classes/${classId}`);
  revalidatePath("/admin/b2c/history");
  return { success: "Đã lưu gói học phí." };
}
export async function recordB2CReceiptAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireManager();
  const parsed = b2cReceiptSchema.safeParse(Object.fromEntries(form.entries()));
  if (!parsed.success) return zodToActionState(parsed.error);
  const v = parsed.data;
  const { error } = await (
    await createClient()
  ).rpc("record_b2c_tuition_receipt", {
    p_package_id: v.package_id,
    p_request_id: v.request_id,
    p_paid_date: v.paid_date,
    p_amount: v.amount,
    p_method: v.method,
    p_collector_name: v.collector_name,
  });
  if (error) return { error: dbErrorToMessage(error) };
  revalidatePath("/admin/b2c/tuition");
  revalidatePath("/admin/b2c/classes/[classId]", "page");
  const classId = form.get("class_id");
  if (typeof classId === "string" && z.uuid().safeParse(classId).success)
    revalidatePath(`/admin/b2c/classes/${classId}`);
  revalidatePath("/admin/b2c/history");
  return { success: "Đã lưu phiếu thu." };
}
export async function getB2CReceiptsAction(packageId: string, page: number) {
  await requireManager();
  if (
    !/^[0-9a-f-]{36}$/i.test(packageId) ||
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 1000000
  )
    return { receipts: [], total: 0, error: "Bộ lọc không hợp lệ." };
  const { data, count, error } = await (
    await createClient()
  )
    .from("b2c_tuition_receipts")
    .select("id, code, paid_date, amount, method, collector_name", {
      count: "exact",
    })
    .eq("package_id", packageId)
    .order("created_at", { ascending: false })
    .order("id")
    .range(page * 20, page * 20 + 19);
  if (error)
    return { receipts: [], total: 0, error: "Không tải được phiếu thu." };
  return { receipts: data ?? [], total: count ?? 0 };
}
