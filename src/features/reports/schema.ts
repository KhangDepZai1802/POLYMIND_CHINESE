import { z } from "zod";

import type { Database } from "@/types/database";

const invoiceStatuses = [
  "draft",
  "issued",
  "partial",
  "paid",
  "overdue",
  "cancelled",
  "refunded",
] as const satisfies readonly Database["public"]["Enums"]["invoice_status"][];

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const adminReportFilterSchema = z
  .object({
    from: z.string().regex(datePattern).optional(),
    to: z.string().regex(datePattern).optional(),
    status: z.enum(invoiceStatuses).optional(),
    class_id: z.uuid().optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.",
    path: ["to"],
  });

export type AdminReportFilters = z.infer<typeof adminReportFilterSchema>;

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseAdminReportFilters(input: SearchParams) {
  return adminReportFilterSchema.safeParse({
    from: first(input.from) || undefined,
    to: first(input.to) || undefined,
    status: first(input.status) || undefined,
    class_id: first(input.class_id) || undefined,
  });
}

export function reportFilterSearchParams(filters: AdminReportFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) params.set(key, value);
  }
  return params;
}

/**
 * Filter của báo cáo HỌC TẬP (`REPORT-REDESIGN-1`).
 *
 * `range=all` là cờ tường minh cho "Toàn khóa": vắng cả ba tham số nghĩa là
 * "chưa chọn gì" và mỗi trang tự quyết kỳ mặc định (admin = Tháng này, giáo
 * viên = Toàn khóa) — nếu dùng "không có from/to" làm nghĩa Toàn khóa thì
 * không còn cách nào phân biệt hai trạng thái đó trên URL.
 */
export const learningReportFilterSchema = z
  .object({
    from: z.string().regex(datePattern).optional(),
    to: z.string().regex(datePattern).optional(),
    range: z.literal("all").optional(),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.",
    path: ["to"],
  });

export type LearningReportFilters = z.infer<typeof learningReportFilterSchema>;

export function parseLearningReportFilters(input: SearchParams) {
  return learningReportFilterSchema.safeParse({
    from: first(input.from) || undefined,
    to: first(input.to) || undefined,
    range: first(input.range) || undefined,
  });
}

export function learningFilterSearchParams(filters: LearningReportFilters) {
  const params = new URLSearchParams();
  if (filters.range === "all") params.set("range", "all");
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params;
}
