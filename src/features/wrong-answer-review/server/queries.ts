import "server-only";

import {
  wrongAnswerReviewListSchema,
  type WrongAnswerReviewItem,
} from "@/features/wrong-answer-review/schema";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/supabase/signed-urls";

const REVIEW_MEDIA_TTL_SECONDS = 15 * 60;

export async function getMyWrongAnswerReviews(): Promise<
  WrongAnswerReviewItem[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_wrong_answer_reviews");
  if (error) throw new Error("Không tải được danh sách câu cần ôn.");

  const parsed = wrongAnswerReviewListSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error("Dữ liệu ôn câu sai không đúng định dạng an toàn.");
  }
  if (parsed.data.length === 0) return [];

  const versionIds = parsed.data.map((item) => item.question_version_id);
  const { data: media, error: mediaError } = await supabase
    .from("question_media")
    .select("question_version_id,object_path,media_role")
    .in("question_version_id", versionIds)
    .eq("media_role", "prompt_audio");

  if (mediaError) throw new Error("Không tải được audio của câu cần ôn.");
  const signed = await signPaths(
    supabase,
    "question-media",
    (media ?? []).map((item) => item.object_path),
    REVIEW_MEDIA_TTL_SECONDS,
  );
  const audioByVersion = new Map<string, string>();
  for (const item of media ?? []) {
    const url = signed.get(item.object_path);
    if (url && !audioByVersion.has(item.question_version_id)) {
      audioByVersion.set(item.question_version_id, url);
    }
  }

  return parsed.data.map((item) => {
    const audioUrl = audioByVersion.get(item.question_version_id);
    return {
      ...item,
      prompt_content: audioUrl
        ? { ...item.prompt_content, audio_url: audioUrl }
        : item.prompt_content,
    };
  });
}
