import "server-only";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { XKLD_READ_ROLES } from "@/features/xkld/domain/candidates";
import {
  pipelineFiltersSchema,
  type PipelineFilters,
  type PipelineGroup,
} from "@/features/xkld/domain/pipeline";
export async function getPipeline(filters: PipelineFilters) {
  const actor = await requireRole(...XKLD_READ_ROLES);
  const parsed = pipelineFiltersSchema.parse(filters);
  const client = await createClient();
  const [board, owners] = await Promise.all([
    client.rpc("get_xkld_pipeline", {
      p_query: parsed.q,
      p_assignee: parsed.assignee || undefined,
      p_stage: parsed.stage,
      p_page: parsed.stage ? parsed.page : 0,
    }),
    client.rpc("get_xkld_assignees"),
  ]);
  if (board.error || owners.error)
    throw new Error("Không tải được pipeline. Vui lòng thử lại.");
  return {
    actor,
    groups: board.data as unknown as PipelineGroup[],
    assignees: owners.data ?? [],
  };
}
