import "server-only";

import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/supabase/signed-urls";

export async function getQuestionSets(kind: "exercise" | "exam") {
  const supabase = await createClient();
  const [{ data: sets, error }, { data: questions }] = await Promise.all([
    supabase
      .from("question_sets")
      .select(
        "id,title,description,status,current_version:question_set_versions!fk_question_sets_current_version(id,version_no,raw_max_score,locked_at,question_set_sections(id,title,instructions,order_index),question_set_items(id,section_id,points,order_index,question_version:question_versions(id,question_id,question_type,prompt_text,prompt_content,media:question_media(media_role,object_path),question_options(id,option_key,content,order_index))))",
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
  const builderItems = (sets ?? []).flatMap(
    (set) => set.current_version?.question_set_items ?? [],
  );

  // Ký audio đề của mọi câu trong mọi bộ bằng MỘT request.
  const signedByPath = await signPaths(
    supabase,
    "question-media",
    builderItems.map(
      (item) =>
        item.question_version?.media.find(
          (media) => media.media_role === "prompt_audio",
        )?.object_path,
    ),
    5 * 60,
  );

  for (const item of builderItems) {
    const question = item.question_version;
    if (!question) continue;
    const content =
      question.prompt_content &&
      typeof question.prompt_content === "object" &&
      !Array.isArray(question.prompt_content)
        ? question.prompt_content
        : {};
    const audio = question.media.find(
      (media) => media.media_role === "prompt_audio",
    );
    const signedUrl = audio ? signedByPath.get(audio.object_path) : undefined;
    question.prompt_content = {
      ...content,
      ...(signedUrl ? { audio_url: signedUrl } : {}),
    };
    question.media = [];
  }
  return { sets: sets ?? [], questions: questions ?? [] };
}
