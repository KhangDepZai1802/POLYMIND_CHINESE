import "server-only";

import { fromLocalInput } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

import type { AuditFilters } from "../schema";

export const AUDIT_PAGE_SIZE = 30;

export async function getAuditLogPage(filters: AuditFilters) {
  const supabase = await createClient();
  const offset = (filters.page - 1) * AUDIT_PAGE_SIZE;
  let query = supabase
    .from("audit_logs")
    .select(
      "id, actor_id, actor_role, action, resource_type, resource_id, before, after, ip, user_agent, created_at",
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range(offset, offset + AUDIT_PAGE_SIZE - 1);

  if (filters.action) query = query.ilike("action", `%${filters.action}%`);
  if (filters.resource_type) {
    query = query.ilike("resource_type", `%${filters.resource_type}%`);
  }
  if (filters.actor_id) query = query.eq("actor_id", filters.actor_id);
  if (filters.from) {
    query = query.gte(
      "created_at",
      fromLocalInput(`${filters.from}T00:00`).toISOString(),
    );
  }
  if (filters.to) {
    const endExclusive = new Date(
      fromLocalInput(`${filters.to}T00:00`).getTime() + 24 * 60 * 60 * 1000,
    );
    query = query.lt("created_at", endExclusive.toISOString());
  }

  const result = await query;
  if (result.error) throw new Error(`Không tải được audit log: ${result.error.message}`);

  const actorIds = [
    ...new Set(
      (result.data ?? [])
        .map((row) => row.actor_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const actors = actorIds.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", actorIds)
    : { data: [], error: null };
  if (actors.error) throw new Error(`Không tải được actor audit: ${actors.error.message}`);
  const actorById = new Map((actors.data ?? []).map((actor) => [actor.id, actor]));

  return {
    rows: (result.data ?? []).map((row) => ({
      ...row,
      actor: row.actor_id ? (actorById.get(row.actor_id) ?? null) : null,
    })),
    total: result.count ?? 0,
    page: filters.page,
    pageCount: Math.max(1, Math.ceil((result.count ?? 0) / AUDIT_PAGE_SIZE)),
  };
}

export async function getAuditActors() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role")
    .order("full_name");
  if (error) throw new Error(`Không tải được danh sách actor: ${error.message}`);
  return data ?? [];
}
