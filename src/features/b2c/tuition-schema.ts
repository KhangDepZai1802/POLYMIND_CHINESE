import { z } from "zod";
import {
  tuitionInvoiceItemSchema,
  tuitionPaymentSchema,
} from "@/features/tuition/schema";

export const b2cTuitionPackageSchema = z
  .object({
    enrollment_id: z.uuid(),
    sessions: tuitionInvoiceItemSchema.shape.quantity.int().max(100000),
    unit_price: tuitionInvoiceItemSchema.shape.unit_amount.int(),
    discount: z.coerce.number().int().min(0).max(1000000000000),
    discount_reason: z.string().trim().max(1000),
  })
  .superRefine((v, ctx) => {
    if (v.sessions * v.unit_price > 1000000000000)
      ctx.addIssue({
        code: "custom",
        path: ["unit_price"],
        message: "Tạm tính vượt giới hạn cho phép.",
      });
    if (v.discount > v.sessions * v.unit_price)
      ctx.addIssue({
        code: "custom",
        path: ["discount"],
        message: "Chiết khấu không được vượt tạm tính.",
      });
    if (v.discount > 0 && !v.discount_reason)
      ctx.addIssue({
        code: "custom",
        path: ["discount_reason"],
        message: "Vui lòng nhập lý do chiết khấu.",
      });
  });
export const b2cReceiptSchema = z.object({
  package_id: z.uuid(),
  request_id: z.uuid(),
  paid_date: z.iso.date({ message: "Ngày thu không hợp lệ." }),
  amount: tuitionPaymentSchema.shape.amount.int(),
  method: z.enum(["cash", "bank_transfer"]),
  collector_name: z.string().trim().min(1, "Vui lòng nhập người thu.").max(200),
});
export type B2CTuitionRow = {
  enrollment_id: string;
  student_code: string;
  full_name: string;
  class_name: string;
  package_id: string | null;
  sessions: number | null;
  unit_price: number | null;
  discount: number | null;
  discount_reason: string | null;
  total_due: number | null;
  paid_amount: number;
  balance: number;
};

export const b2cCorrectionSchema = z
  .object({
    request_id: z.uuid(),
    package_id: z.uuid(),
    receipt_id: z.uuid().nullable(),
    kind: z.enum(["cancel", "refund", "adjust"]),
    amount: z.coerce.number().int().min(0).max(1000000000000),
    reason: z.string().trim().min(1, "Vui lòng nhập lý do.").max(1000),
    effective_date: z.iso.date(),
    method: z.enum(["cash", "bank_transfer"]),
    reduce_fee: z.boolean(),
    expected_due: z.number().int().min(0).max(1000000000000),
    expected_paid: z.number().int().min(0).max(1000000000000),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== "adjust" && !v.receipt_id)
      ctx.addIssue({
        code: "custom",
        path: ["receipt_id"],
        message: "Vui lòng chọn phiếu thu.",
      });
    if (v.kind === "refund" && v.amount <= 0)
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message: "Số hoàn phải lớn hơn 0.",
      });
  });

export type B2CReceipt = {
  id: string;
  code: string;
  paid_date: string;
  amount: number;
  method: string;
  collector_name: string;
  refunded_amount?: number;
  cancelled_at?: string | null;
  correction_reason?: string | null;
  effective_amount?: number;
};
export type B2CCorrectionHistory = {
  total: number;
  rows: {
    id: string;
    kind: "cancel" | "refund" | "adjust";
    amount: number;
    reason: string;
    effective_date: string;
    method: string;
    reduce_fee: boolean;
    receipt_code: string | null;
    actor_name: string | null;
    created_at: string;
    before_data: { total_due: number; paid_amount: number };
    after_data: { total_due: number; paid_amount: number };
  }[];
};
