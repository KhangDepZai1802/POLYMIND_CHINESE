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
