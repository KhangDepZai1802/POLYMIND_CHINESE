import "server-only";

import { createClient } from "@/lib/supabase/server";

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
  await Promise.all(
    (sets ?? []).flatMap((set) =>
      (set.current_version?.question_set_items ?? []).map(async (item) => {
        const question = item.question_version;
        if (!question) return;
        const content =
          question.prompt_content &&
          typeof question.prompt_content === "object" &&
          !Array.isArray(question.prompt_content)
            ? question.prompt_content
            : {};
        const audio = question?.media.find(
          (media) => media.media_role === "prompt_audio",
        );
        if (audio) {
          const { data } = await supabase.storage
            .from("question-media")
            .createSignedUrl(audio.object_path, 5 * 60);
          question.prompt_content = {
            ...content,
            ...(data?.signedUrl ? { audio_url: data.signedUrl } : {}),
          };
        } else {
          question.prompt_content = content;
        }
        question.media = [];
      }),
    ),
  );
  return { sets: sets ?? [], questions: questions ?? [] };
}
