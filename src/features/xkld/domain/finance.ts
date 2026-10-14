import { z } from "zod";
import type { UserRole } from "@/types/roles";
export const FINANCE_PATH = "/workspace/xkld/finance";
export const FINANCE_EDIT_ROLES = ["super_admin", "executive"] as const;
export const FINANCE_KINDS = {
  candidate_fee: "Phí dịch vụ ứng viên",
  partner_fee: "Phí đối tác/chủ sử dụng",
  commission: "Hoa hồng CTV",
} as const;
export type FinanceKind = keyof typeof FINANCE_KINDS;
export const TRANSACTION_KINDS = {
  receipt: "Thu tiền",
  refund: "Hoàn phí",
  commission_payment: "Chi hoa hồng",
} as const;
export type TransactionKind = keyof typeof TRANSACTION_KINDS;
export function canManageFinance(role: UserRole) {
  return (FINANCE_EDIT_ROLES as readonly string[]).includes(role);
}
const amount = z.coerce.number().int().min(0).max(999999999999);
const date = z.iso
  .date()
  .refine((v) => v >= "1900-01-01", "Ngày phải từ năm 1900.");
export const installmentSchema = z
  .object({
    id: z.uuid().optional(),
    request_id: z.uuid(),
    candidate_id: z.uuid(),
    kind: z.enum(["candidate_fee", "partner_fee", "commission"]),
    title: z.string().trim().min(1).max(200),
    counterparty: z.string().trim().min(1).max(200),
    amount,
    due_date: date,
    note: z.string().max(2000),
    expected_updated_at: z.string().optional(),
  })
  .refine((v) => v.id || v.amount > 0, "Phí mới phải lớn hơn 0.");
export const transactionSchema = z
  .object({
    request_id: z.uuid(),
    installment_id: z.uuid(),
    kind: z.enum(["receipt", "refund", "commission_payment"]),
    receipt_id: z.uuid().optional(),
    amount: amount.refine((v) => v > 0),
    reduce_fee: z.boolean(),
    occurred_on: date,
    method: z.enum(["cash", "bank_transfer"]),
    note: z.string().trim().max(2000),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "refund" && (!v.receipt_id || !v.note))
      ctx.addIssue({
        code: "custom",
        message: "Hoàn phí cần phiếu thu gốc và lý do.",
      });
    if (v.kind !== "refund" && (v.receipt_id || v.reduce_fee))
      ctx.addIssue({ code: "custom", message: "Loại phiếu không hợp lệ." });
  });
export const voidTransactionSchema = z.object({
  id: z.uuid(),
  request_id: z.uuid(),
  reason: z.string().trim().min(1).max(2000),
});
export type FinanceTotals = {
  amount: number;
  paid: number;
  refunded: number;
  net_paid: number;
  balance: number;
  overdue: number;
};
export type FinanceCandidate = FinanceTotals & {
  id: string;
  code: string;
  full_name: string;
};
export type FinanceInstallment = FinanceTotals & {
  id: string;
  code: string;
  candidate_id: string;
  kind: FinanceKind;
  title: string;
  counterparty?: string;
  due_date: string;
  note?: string;
  updated_at?: string;
};
export type FinanceTransaction = {
  id: string;
  code: string;
  installment_id: string;
  kind: TransactionKind;
  receipt_id: string | null;
  amount: number;
  fee_reduction: number;
  occurred_on: string;
  method: "cash" | "bank_transfer";
  note: string;
  created_at: string;
  actor_name: string;
  voided_at: string | null;
  void_reason: string | null;
};
export type FinanceHistory = {
  id: string;
  action: string;
  before_data: unknown;
  after_data: unknown;
  actor_name: string;
  created_at: string;
};
export type FinanceOverview = {
  rows: FinanceCandidate[];
  total: number;
  totals: FinanceTotals;
};
export type FinanceDetail = {
  candidate: { id: string; code: string; full_name: string };
  rows: FinanceInstallment[];
  total: number;
  totals: FinanceTotals;
};
export function moneyVnd(value: number) {
  return (
    new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(value) +
    " ₫"
  );
}
export const financeFiltersSchema = z.object({
  q: z.string().trim().max(200).default(""),
  page: z.coerce.number().int().min(0).max(1000000).default(0),
  kind: z
    .enum(["candidate_fee", "partner_fee", "commission"])
    .default("candidate_fee"),
});
