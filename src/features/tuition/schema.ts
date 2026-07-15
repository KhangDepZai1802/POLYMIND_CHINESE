import { z } from "zod";

const optionalUuid = z
  .union([z.literal(""), z.literal("none"), z.uuid()])
  .nullish()
  .transform((value) =>
    value === undefined || value === null || value === "" || value === "none"
      ? null
      : value,
  );

const optionalText = z
  .string()
  .trim()
  .max(2000, { message: "Ghi chú tối đa 2.000 ký tự" })
  .transform((value) => (value === "" ? null : value))
  .nullable();

export const tuitionInvoiceItemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(1, { message: "Nội dung khoản mục không được để trống" })
    .max(300, { message: "Nội dung khoản mục tối đa 300 ký tự" }),
  quantity: z.coerce
    .number()
    .positive({ message: "Số lượng phải lớn hơn 0" })
    .max(999999.99, { message: "Số lượng quá lớn" }),
  unit_amount: z.coerce
    .number()
    .min(0, { message: "Đơn giá không được âm" })
    .max(999999999999.99, { message: "Đơn giá quá lớn" }),
});

export const tuitionInvoiceSchema = z
  .object({
    invoice_id: optionalUuid,
    student_id: z.uuid({ message: "Vui lòng chọn học viên" }),
    enrollment_id: optionalUuid,
    issue_date: z.iso.date({ message: "Ngày lập hóa đơn không hợp lệ" }),
    due_date: z
      .union([z.literal(""), z.iso.date()])
      .transform((value) => (value === "" ? null : value)),
    discount: z.coerce
      .number()
      .min(0, { message: "Giảm trừ không được âm" })
      .max(999999999999.99, { message: "Giảm trừ quá lớn" }),
    note: optionalText,
    items: z
      .array(tuitionInvoiceItemSchema)
      .min(1, { message: "Hóa đơn phải có ít nhất một khoản mục" })
      .max(50, { message: "Hóa đơn tối đa 50 khoản mục" }),
  })
  .superRefine((value, ctx) => {
    if (value.due_date && value.due_date < value.issue_date) {
      ctx.addIssue({
        code: "custom",
        path: ["due_date"],
        message: "Hạn thanh toán không được trước ngày lập hóa đơn",
      });
    }

    const subtotal = value.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_amount,
      0,
    );
    if (subtotal > 999999999999.99) {
      ctx.addIssue({
        code: "custom",
        path: ["items"],
        message: "Tạm tính vượt giới hạn cho phép",
      });
    }
    if (value.discount > subtotal) {
      ctx.addIssue({
        code: "custom",
        path: ["discount"],
        message: "Giảm trừ không được vượt tạm tính",
      });
    }
  });

const paymentMethodSchema = z.enum([
  "cash",
  "bank_transfer",
  "card",
  "e_wallet",
  "other",
]);

const localDateTimeSchema = z
  .string()
  .trim()
  .refine((value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), {
    message: "Thời điểm thanh toán không hợp lệ",
  });

export const tuitionPaymentSchema = z.object({
  invoice_id: z.uuid({ message: "Mã hóa đơn không hợp lệ" }),
  amount: z.coerce
    .number()
    .positive({ message: "Số tiền thanh toán phải lớn hơn 0" })
    .max(999999999999.99, { message: "Số tiền thanh toán quá lớn" }),
  method: paymentMethodSchema,
  paid_at: localDateTimeSchema,
  reference: z
    .string()
    .trim()
    .max(300, { message: "Mã tham chiếu tối đa 300 ký tự" })
    .transform((value) => (value === "" ? null : value))
    .nullable(),
  note: optionalText,
});

export type TuitionInvoiceInput = z.infer<typeof tuitionInvoiceSchema>;
export type TuitionInvoiceItemInput = z.infer<typeof tuitionInvoiceItemSchema>;
export type TuitionPaymentInput = z.infer<typeof tuitionPaymentSchema>;
