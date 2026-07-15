import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

export type RateLimitScope =
  | "material_upload"
  | "assignment_upload"
  | "submission_upload"
  | "report_export";

export async function consumeRateLimit(
  supabase: SupabaseClient<Database>,
  scope: RateLimitScope,
) {
  const { data, error } = await supabase.rpc("consume_rate_limit", { p_scope: scope });
  return !error && data === true;
}
