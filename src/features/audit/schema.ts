import { z } from "zod";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const auditFilterSchema = z
  .object({
    action: z.string().trim().max(100).optional(),
    resource_type: z.string().trim().max(100).optional(),
    actor_id: z.uuid().optional(),
    from: z.string().regex(datePattern).optional(),
    to: z.string().regex(datePattern).optional(),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .refine((value) => !value.from || !value.to || value.from <= value.to, {
    message: "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.",
    path: ["to"],
  });

export type AuditFilters = z.infer<typeof auditFilterSchema>;

type SearchParams = Record<string, string | string[] | undefined>;

export function parseAuditFilters(input: SearchParams) {
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;

  return auditFilterSchema.safeParse({
    action: first(input.action) || undefined,
    resource_type: first(input.resource_type) || undefined,
    actor_id: first(input.actor_id) || undefined,
    from: first(input.from) || undefined,
    to: first(input.to) || undefined,
    page: first(input.page) || 1,
  });
}

export function auditFilterSearchParams(filters: AuditFilters) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && !(key === "page" && value === 1)) params.set(key, String(value));
  }
  return params;
}
