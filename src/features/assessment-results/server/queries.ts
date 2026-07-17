import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getMyAssessmentResult(
  kind: "exercise" | "exam",
  attemptId: string,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_assessment_result", {
    p_kind: kind,
    p_attempt_id: attemptId,
  });
  if (error || !data) throw new Error("Kết quả chưa được công bố.");
  return data;
}
