import "server-only";

import type {
  TuitionInvoiceRecord,
  TuitionStudentOption,
} from "@/features/tuition/types";
import { createClient } from "@/lib/supabase/server";

export async function getTuitionInvoices(): Promise<TuitionInvoiceRecord[]> {
  const supabase = await createClient();
  const [invoiceResult, balanceResult] = await Promise.all([
    supabase
      .from("tuition_invoices")
      .select(
        `id, invoice_code, student_id, enrollment_id, class_id,
         issue_date, due_date, subtotal, discount, total, status, note, created_at,
         student:students!tuition_invoices_student_id_fkey (id, student_code, full_name),
         enrollment:enrollments!tuition_invoices_enrollment_id_fkey (
           id, status, class:classes (id, code, name)
         ),
         tuition_invoice_items (id, description, quantity, unit_amount, line_total),
         tuition_payments (
           id, payment_code, amount, paid_at, method, reference, note,
           tuition_receipts (id, receipt_code, issued_at, snapshot)
         )`,
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("v_tuition_balance")
      .select("invoice_id, paid_amount, balance, is_overdue"),
  ]);

  if (invoiceResult.error) {
    throw new Error(
      `Không tải được danh sách hóa đơn: ${invoiceResult.error.message}`,
    );
  }
  if (balanceResult.error) {
    throw new Error(
      `Không tải được số dư học phí: ${balanceResult.error.message}`,
    );
  }

  const balances = new Map(
    balanceResult.data
      .filter((row) => row.invoice_id)
      .map((row) => [row.invoice_id!, row]),
  );

  return invoiceResult.data.map((invoice) => {
    const balance = balances.get(invoice.id);
    return {
      ...invoice,
      tuition_invoice_items: [...invoice.tuition_invoice_items].sort((a, b) =>
        a.id.localeCompare(b.id),
      ),
      tuition_payments: [...invoice.tuition_payments].sort(
        (a, b) => Date.parse(b.paid_at) - Date.parse(a.paid_at),
      ),
      paid_amount: Number(balance?.paid_amount ?? 0),
      balance: Number(balance?.balance ?? invoice.total),
      is_overdue: balance?.is_overdue ?? false,
    };
  });
}

export async function getTuitionStudentOptions(): Promise<
  TuitionStudentOption[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("students")
    .select(
      `id, student_code, full_name,
       enrollments (id, status, class:classes (id, code, name))`,
    )
    .is("archived_at", null)
    .order("student_code");

  if (error) {
    throw new Error(`Không tải được học viên để lập hóa đơn: ${error.message}`);
  }

  return data.map((student) => ({
    ...student,
    enrollments: [...student.enrollments].sort((a, b) => {
      const classA = a.class?.code ?? "";
      const classB = b.class?.code ?? "";
      return classA.localeCompare(classB);
    }),
  }));
}
