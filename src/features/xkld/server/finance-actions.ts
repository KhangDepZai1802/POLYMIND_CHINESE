"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { dbErrorToMessage } from "@/lib/action-state";
import { XKLD_READ_ROLES } from "../domain/candidates";
import {
  FINANCE_PATH,
  FINANCE_EDIT_ROLES,
  installmentSchema,
  transactionSchema,
  voidTransactionSchema,
  type FinanceTransaction,
  type FinanceHistory,
} from "../domain/finance";
import type { Json } from "@/types/database";
async function write(action: string, input: Json) {
  const { error } = await (
    await createClient()
  ).rpc("write_xkld_finance", { p_action: action, p_data: input });
  if (error) return { error: dbErrorToMessage(error) };
  revalidatePath(FINANCE_PATH);
  revalidatePath(`${FINANCE_PATH}/[candidateId]`, "page");
  return { success: true };
}
export async function saveFinanceInstallmentAction(input: unknown) {
  await requireRole(...FINANCE_EDIT_ROLES);
  const parsed = installmentSchema.safeParse(input);
  return !parsed.success
    ? {
        error:
          "Đợt phí không hợp lệ. Kiểm tra tên, đối tượng, số nguyên VNĐ và ngày hạn.",
      }
    : write("save_installment", parsed.data);
}
export async function recordFinanceTransactionAction(input: unknown) {
  await requireRole(...FINANCE_EDIT_ROLES);
  const parsed = transactionSchema.safeParse(input);
  return !parsed.success
    ? {
        error:
          "Phiếu không hợp lệ. Hoàn phí cần phiếu thu gốc và lý do; số tiền nguyên VNĐ lớn hơn 0.",
      }
    : write("record_transaction", parsed.data);
}
export async function voidFinanceTransactionAction(input: unknown) {
  await requireRole(...FINANCE_EDIT_ROLES);
  const parsed = voidTransactionSchema.safeParse(input);
  return !parsed.success
    ? { error: "Nhập lý do hủy phiếu (tối đa 2.000 ký tự)." }
    : write("void_transaction", parsed.data);
}
export async function getFinanceTransactionsAction(
  installmentId: string,
  page: number,
) {
  await requireRole(...FINANCE_EDIT_ROLES);
  if (
    !z.uuid().safeParse(installmentId).success ||
    !z.number().int().min(0).max(1000000).safeParse(page).success
  )
    return { error: "Bộ lọc không hợp lệ." };
  const { data, error } = await (
    await createClient()
  ).rpc("read_xkld_finance", {
    p_action: "transactions",
    p_data: { installment_id: installmentId, page },
  });
  return error
    ? { error: "Không tải được phiếu thu/chi." }
    : {
        data: data as unknown as { rows: FinanceTransaction[]; total: number },
      };
}
export async function getFinanceHistoryAction(
  candidateId: string,
  page: number,
) {
  await requireRole(...FINANCE_EDIT_ROLES);
  if (
    !z.uuid().safeParse(candidateId).success ||
    !z.number().int().min(0).max(1000000).safeParse(page).success
  )
    return { error: "Bộ lọc không hợp lệ." };
  const { data, error } = await (
    await createClient()
  ).rpc("read_xkld_finance", {
    p_action: "history",
    p_data: { candidate_id: candidateId, page },
  });
  return error
    ? { error: "Không tải được lịch sử tài chính." }
    : { data: data as unknown as { rows: FinanceHistory[]; total: number } };
}
export async function readFinanceAction(
  action: "overview" | "detail",
  input: Json,
) {
  await requireRole(...XKLD_READ_ROLES);
  const { data, error } = await (
    await createClient()
  ).rpc("read_xkld_finance", { p_action: action, p_data: input });
  if (error) throw new Error("Không tải được tài chính XKLĐ.");
  return data;
}
