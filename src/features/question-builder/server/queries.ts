import "server-only";

import { createClient } from "@/lib/supabase/server";

export async function getQuestionSets(kind: "exercise" | "exam") {
  const supabase = await createClient();
  const [{ data: sets, error }, { data: questions }] = await Promise.all([
    supabase
      .from("question_sets")
      .select(
        "id,title,description,status,current_version:question_set_versions!fk_question_sets_current_version(id,version_no,raw_max_score,locked_at,question_set_sections(id,title,instructions,order_index),question_set_items(id,section_id,points,order_index,question_version:question_versions(id,question_type,prompt_text,question_options(id,option_key,content,order_index))))",
      )
      .eq("kind", kind)
      .neq("status", "archived")
      .order("created_at", { ascending: false }),
    supabase
      .from("questions")
      .select(
        "id,code,title,skill,current_version:question_versions!fk_questions_current_version(id,question_type,prompt_text)",
      )
      .eq("status", "ready")
      .order("title"),
  ]);
  if (error) throw new Error("Không tải được danh sách bộ câu hỏi.");
  return { sets: sets ?? [], questions: questions ?? [] };
}
