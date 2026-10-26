"use server";
import { revalidateB2CViews } from "./revalidate-views";
import { z } from "zod";
import {
  b2cTuitionPackageSchema,
  b2cReceiptSchema,
  b2cCorrectionSchema,
  type B2CReceipt,
  type B2CCorrectionHistory,
} from "@/features/b2c/tuition-schema";
import { requireTeaching } from "@/lib/auth/session";
import { permissionRpc } from "./permission-rpc";
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
  await requireTeaching("super_admin");
  const parsed = b2cTuitionPackageSchema.safeParse(
    Object.fromEntries(form.entries()),
  );
  if (!parsed.success) return zodToActionState(parsed.error);
  const v = parsed.data;
  const reason = form.get("adjustment_reason");
  const expectedDue = form.get("expected_due");
  const expectedPaid = form.get("expected_paid");
  const money = z.coerce.number().int().min(0).max(1000000000000);
  const due =
    expectedDue === "" || expectedDue === null
      ? null
      : money.safeParse(expectedDue);
  const paid = money.safeParse(expectedPaid ?? 0);
  if (
    (due !== null && !due.success) ||
    !paid.success ||
    (reason !== null && typeof reason !== "string")
  )
    return { error: "Dữ liệu điều chỉnh không hợp lệ." };
  try {
    await permissionRpc<string>("save_b2c_tuition_package_with_reason", {
      p_enrollment_id: v.enrollment_id,
      p_sessions: v.sessions,
      p_unit_price: v.unit_price,
      p_discount: v.discount,
      p_discount_reason: v.discount_reason,
      p_reason: typeof reason === "string" ? reason : "",
      p_expected_due: due?.success ? due.data : null,
      p_expected_paid: paid.data,
    });
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Không lưu được học phí.",
    };
  }
  revalidateB2CViews();
  return { success: "Đã lưu gói học phí." };
}
export async function recordB2CReceiptAction(
  _: ActionState,
  form: FormData,
): Promise<ActionState> {
  await requireTeaching("super_admin");
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
  revalidateB2CViews();
  return { success: "Đã lưu phiếu thu." };
}
export async function getB2CReceiptsAction(packageId: string, page: number) {
  await requireTeaching("super_admin");
  if (
    !/^[0-9a-f-]{36}$/i.test(packageId) ||
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 1000000
  )
    return { receipts: [], total: 0, error: "Bộ lọc không hợp lệ." };
  try {
    return await permissionRpc<{
      receipts: B2CReceipt[];
      total: number;
      error?: string;
    }>("read_b2c_permitted_receipts", {
      p_package_id: packageId,
      p_page: page,
    });
  } catch {
    return {
      receipts: [],
      total: 0,
      error: "Không tải được phiếu thu hoặc bạn chưa được cấp quyền xem.",
    };
  }
}

export async function correctB2CTuitionAction(input: unknown) {
  await requireTeaching("super_admin");
  const parsed = b2cCorrectionSchema.safeParse(input);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.",
    };
  try {
    await permissionRpc<string>("correct_b2c_tuition", {
      p_payload: parsed.data,
    });
    revalidateB2CViews();
    return { success: true };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Không lưu được điều chỉnh.",
    };
  }
}

export async function getB2CCorrectionsAction(packageId: string, page: number) {
  await requireTeaching("super_admin");
  if (
    !z.uuid().safeParse(packageId).success ||
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 1000000
  )
    throw new Error("Bộ lọc không hợp lệ.");
  return permissionRpc<B2CCorrectionHistory>("read_b2c_tuition_corrections", {
    p_package_id: packageId,
    p_page: page,
  });
}
