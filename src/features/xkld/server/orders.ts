import "server-only";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { XKLD_READ_ROLES } from "@/features/xkld/domain/candidates";
import {
  orderFiltersSchema,
  type OrderFilters,
} from "@/features/xkld/domain/orders";
export async function getOrders(filters: OrderFilters) {
  const actor = await requireRole(...XKLD_READ_ROLES);
  const parsed = orderFiltersSchema.parse(filters);
  const client = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  let query = client
    .from("xkld_orders")
    .select(
      "id,code,market_id,employer,industry,recruitment_quantity,salary_amount,salary_currency,salary_period,conditions,recruitment_deadline,partner,status,created_at,updated_at",
      { count: "exact" },
    );
  if (parsed.q)
    query = query.ilike(
      "search_text",
      `%${parsed.q.replace(/[\\%_]/g, "\\$&")}%`,
    );
  if (parsed.market) query = query.eq("market_id", parsed.market);
  if (parsed.status) query = query.eq("status", parsed.status);
  if (parsed.deadline === "current")
    query = query.gte("recruitment_deadline", today);
  if (parsed.deadline === "expired")
    query = query.lt("recruitment_deadline", today);
  const [result, markets] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(parsed.page * 25, parsed.page * 25 + 24),
    client
      .from("xkld_markets")
      .select("id,country_code,country_name,currency_code,is_active,updated_at")
      .order("country_name"),
  ]);
  if (result.error || markets.error)
    throw new Error("Không tải được thị trường và đơn hàng. Vui lòng thử lại.");
  return {
    actor,
    rows: result.data ?? [],
    total: result.count ?? 0,
    markets: markets.data ?? [],
    today,
  };
}
