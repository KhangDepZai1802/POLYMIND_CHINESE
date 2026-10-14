import { z } from "zod";
import { B2C_STUDENT_STATUS_LABELS } from "@/features/b2c/domain/student-status";
import { formatCurrency } from "@/lib/dates";

export const b2cHistoryFilterSchema = z
  .object({
    q: z.string().trim().max(200).default(""),
    actor: z.string().trim().max(200).default(""),
    kind: z
      .enum(["all", "enrollment", "tuition_package", "tuition_receipt"])
      .default("all"),
    enrollment: z.union([z.literal(""), z.uuid()]).default(""),
    from: z.union([z.literal(""), z.iso.date()]).default(""),
    to: z.union([z.literal(""), z.iso.date()]).default(""),
    page: z.coerce.number().int().min(0).max(1000000).default(0),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.",
    path: ["to"],
  });
export type B2CHistoryFilters = z.infer<typeof b2cHistoryFilterSchema>;
export const HISTORY_ENTITY_LABELS = {
  enrollment: "Ghi danh / trạng thái",
  tuition_package: "Gói học phí",
  tuition_receipt: "Phiếu thu",
};
const fields: Record<string, string> = {
  status: "Trạng thái",
  withdrawal_reason: "Lý do nghỉ",
  class_id: "Mã định danh lớp",
  enrollment_date: "Ngày nhập học",
  payment_date: "Ngày đóng tiền",
  learning_start_date: "Ngày bắt đầu học",
  tuition_end_date: "Ngày hết học phí",
  registered_sessions: "Số buổi đăng ký",
  sessions_per_week: "Buổi / tuần",
  salesperson: "Người chốt",
  learning_goal: "Mục tiêu học",
  certificate_goal: "Chứng chỉ",
  notes: "Ghi chú",
  sessions: "Số buổi",
  unit_price: "Đơn giá / buổi",
  discount: "Chiết khấu",
  discount_reason: "Lý do chiết khấu",
  total_due: "Tổng phải thu",
  code: "Mã phiếu",
  paid_date: "Ngày thu",
  amount: "Số tiền thu",
  method: "Hình thức thu",
  collector_name: "Người thu khai báo",
};
function object(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function historyChanges(before: unknown, after: unknown) {
  const old = object(before),
    next = object(after);
  return [...new Set([...Object.keys(old), ...Object.keys(next)])]
    .filter(
      (key) =>
        JSON.stringify(old[key] ?? null) !== JSON.stringify(next[key] ?? null),
    )
    .map((key) => ({
      key,
      label: fields[key] ?? key,
      before: historyValue(key, old[key]),
      after: historyValue(key, next[key]),
    }));
}
export function historyValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (key === "status")
    return (
      B2C_STUDENT_STATUS_LABELS[
        value as keyof typeof B2C_STUDENT_STATUS_LABELS
      ] ?? String(value)
    );
  if (
    ["unit_price", "discount", "total_due", "amount"].includes(key) &&
    Number.isFinite(Number(value))
  )
    return formatCurrency(Number(value));
  if (key === "method")
    return value === "cash"
      ? "Tiền mặt"
      : value === "bank_transfer"
        ? "Chuyển khoản"
        : String(value);
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value.split("-").reverse().join("/");
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
