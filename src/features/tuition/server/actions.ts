"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  tuitionInvoiceSchema,
  tuitionPaymentSchema,
  type TuitionInvoiceInput,
} from "@/features/tuition/schema";
import {
  dbErrorToMessage,
  zodToActionState,
  type ActionState,
} from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { fromLocalInput } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";

const invoiceIdSchema = z.uuid({ message: "Mã hóa đơn không hợp lệ" });

function revalidateTuitionPaths() {
  revalidatePath("/admin/tuition");
  revalidatePath("/admin");
  revalidatePath("/student");
}

function parseInvoiceForm(
  formData: FormData,
): { data: TuitionInvoiceInput } | { state: ActionState } {
  const rawItems = formData.get("items_json");
  let items: unknown = [];
  if (typeof rawItems === "string") {
    try {
      items = JSON.parse(rawItems);
    } catch {
      return { state: { error: "Danh sách khoản mục không hợp lệ." } };
    }
  }

  const parsed = tuitionInvoiceSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
    student_id: formData.get("student_id"),
    enrollment_id: formData.get("enrollment_id"),
    issue_date: formData.get("issue_date"),
    due_date: formData.get("due_date"),
    discount: formData.get("discount"),
    note: formData.get("note"),
    items,
  });

  if (!parsed.success) return { state: zodToActionState(parsed.error) };
  return { data: parsed.data };
}

export async function saveTuitionInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const result = parseInvoiceForm(formData);
  if ("state" in result) return result.state;

  const input = result.data;
  const args: Database["public"]["Functions"]["save_tuition_invoice"]["Args"] =
    {
      p_student_id: input.student_id,
      p_issue_date: input.issue_date,
      p_discount: input.discount,
      p_items: input.items as Json,
      ...(input.invoice_id ? { p_invoice_id: input.invoice_id } : {}),
      ...(input.enrollment_id ? { p_enrollment_id: input.enrollment_id } : {}),
      ...(input.due_date ? { p_due_date: input.due_date } : {}),
      ...(input.note ? { p_note: input.note } : {}),
    };

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_tuition_invoice", args);
  if (error) return { error: dbErrorToMessage(error) };

  revalidateTuitionPaths();
  return {
    success: input.invoice_id
      ? "Đã cập nhật hóa đơn nháp."
      : "Đã tạo hóa đơn nháp.",
  };
}

export async function issueTuitionInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = invoiceIdSchema.safeParse(formData.get("invoice_id"));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("issue_tuition_invoice", {
    p_invoice_id: parsed.data,
  });
  if (error) return { error: dbErrorToMessage(error) };

  revalidateTuitionPaths();
  return { success: "Đã phát hành hóa đơn và gửi thông báo cho học viên." };
}

export async function recordTuitionPaymentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = tuitionPaymentSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    paid_at: formData.get("paid_at"),
    reference: formData.get("reference"),
    note: formData.get("note"),
  });
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_tuition_payment", {
    p_invoice_id: parsed.data.invoice_id,
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_paid_at: fromLocalInput(parsed.data.paid_at).toISOString(),
    ...(parsed.data.reference ? { p_reference: parsed.data.reference } : {}),
    ...(parsed.data.note ? { p_note: parsed.data.note } : {}),
  });
  if (error) return { error: dbErrorToMessage(error) };

  revalidateTuitionPaths();
  return { success: "Đã ghi nhận thanh toán và sinh phiếu thu." };
}

export async function deleteTuitionInvoiceDraftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole("super_admin");
  const parsed = invoiceIdSchema.safeParse(formData.get("invoice_id"));
  if (!parsed.success) return zodToActionState(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_tuition_invoice_draft", {
    p_invoice_id: parsed.data,
  });
  if (error) return { error: dbErrorToMessage(error) };

  revalidateTuitionPaths();
  return { success: "Đã xóa hóa đơn nháp." };
}
