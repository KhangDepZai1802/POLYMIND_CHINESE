import "server-only";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { fromLocalInput } from "@/lib/dates";
import {
  b2cHistoryFilterSchema,
  type B2CHistoryFilters,
} from "@/features/b2c/domain/change-history";

export async function getB2CChangeHistory(input: B2CHistoryFilters) {
  await requireRole("super_admin");
  const filters = b2cHistoryFilterSchema.parse(input);
  const client = await createClient();
  let request = client
    .from("b2c_change_history")
    .select(
      "id,created_at,actor_id,actor_name,actor_role,entity_type,entity_id,operation,enrollment_id,student_code,student_name,class_code,class_name,before_data,after_data",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(filters.page * 30, filters.page * 30 + 29);
  const pattern = (value: string) => `%${value.replace(/[\\%_]/g, "\\$&")}%`;
  if (filters.q) request = request.ilike("search_text", pattern(filters.q));
  if (filters.actor)
    request = request.ilike("actor_name", pattern(filters.actor));
  if (filters.kind !== "all") request = request.eq("entity_type", filters.kind);
  if (filters.enrollment)
    request = request.eq("enrollment_id", filters.enrollment);
  if (filters.from)
    request = request.gte(
      "created_at",
      fromLocalInput(`${filters.from}T00:00`).toISOString(),
    );
  if (filters.to)
    request = request.lt(
      "created_at",
      new Date(
        fromLocalInput(`${filters.to}T00:00`).getTime() + 86400000,
      ).toISOString(),
    );
  const { data, error, count } = await request;
  if (error)
    throw new Error("Không tải được nhật ký thay đổi B2C. Vui lòng thử lại.");
  return { rows: data ?? [], total: count ?? 0 };
}
