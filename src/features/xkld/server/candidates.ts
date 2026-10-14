import "server-only";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { candidateFiltersSchema, XKLD_READ_ROLES, type CandidateFilters } from "@/features/xkld/domain/candidates";

export async function getCandidates(filters: CandidateFilters) {
  const actor = await requireRole(...XKLD_READ_ROLES);
  const parsed = candidateFiltersSchema.parse(filters);
  const client = await createClient();
  let query = client.from("xkld_candidates").select("id,code,full_name,date_of_birth,phone,zalo,hometown,education,occupation,health_status,source,assignee_id,stage,created_at,updated_at", { count: "exact" });
  if (parsed.q) query = query.ilike("search_text", `%${parsed.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (parsed.source) query = query.eq("source", parsed.source);
  if (parsed.health) query = query.eq("health_status", parsed.health);
  if (parsed.assignee) query = query.eq("assignee_id", parsed.assignee);
  const [result, owners] = await Promise.all([
    query.order("created_at", { ascending: false }).order("id", { ascending: false }).range(parsed.page * 25, parsed.page * 25 + 24),
    client.rpc("get_xkld_assignees"),
  ]);
  if (result.error || owners.error) throw new Error("Không tải được danh sách ứng viên. Vui lòng thử lại.");
  return { actor, rows: result.data ?? [], total: result.count ?? 0, assignees: owners.data ?? [] };
}
