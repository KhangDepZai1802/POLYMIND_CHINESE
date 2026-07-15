import type { Database } from "@/types/database";

export type InvoiceStatus = Database["public"]["Enums"]["invoice_status"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];

export type TuitionInvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unit_amount: number;
  line_total: number;
};

export type TuitionEnrollmentOption = {
  id: string;
  status: Database["public"]["Enums"]["enrollment_status"];
  class: { id: string; code: string; name: string } | null;
};

export type TuitionStudentOption = {
  id: string;
  student_code: string;
  full_name: string;
  enrollments: TuitionEnrollmentOption[];
};

export type TuitionReceipt = {
  id: string;
  receipt_code: string;
  issued_at: string;
  snapshot: Database["public"]["Tables"]["tuition_receipts"]["Row"]["snapshot"];
};

export type TuitionPayment = {
  id: string;
  payment_code: string;
  amount: number;
  paid_at: string;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  tuition_receipts: TuitionReceipt | null;
};

export type TuitionInvoiceRecord = {
  id: string;
  invoice_code: string;
  student_id: string;
  enrollment_id: string | null;
  class_id: string | null;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  discount: number;
  total: number;
  status: InvoiceStatus;
  note: string | null;
  created_at: string;
  student: { id: string; student_code: string; full_name: string } | null;
  enrollment: TuitionEnrollmentOption | null;
  tuition_invoice_items: TuitionInvoiceItem[];
  tuition_payments: TuitionPayment[];
  paid_amount: number;
  balance: number;
  is_overdue: boolean;
};
