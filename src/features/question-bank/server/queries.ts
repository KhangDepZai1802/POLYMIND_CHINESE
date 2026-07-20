import "server-only";

import {
  clampQuestionPage,
  QUESTION_PAGE_SIZE,
} from "@/features/question-bank/domain/pagination";
import { createClient } from "@/lib/supabase/server";

export type QuestionFilters = {
  q?: string;
  skill?: string;
  visibility?: string;
  page?: string;
};
export async function getQuestions(
  kind?: "exercise" | "exam",
  filters: QuestionFilters = {},
) {
  const supabase = await createClient();
  let countQuery = supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .neq("status", "archived");
  if (filters.q?.trim())
    countQuery = countQuery.or(
      `title.ilike.%${filters.q.trim()}%,code.ilike.%${filters.q.trim()}%`,
    );
  if (filters.skill)
    countQuery = countQuery.eq("skill", filters.skill as never);
  if (filters.visibility)
    countQuery = countQuery.eq("visibility", filters.visibility as never);
  const { count, error: countError } = await countQuery;
  if (countError) throw new Error("Không tải được số lượng câu hỏi.");

  const normalizedCount = count ?? 0;
  const { page, totalPages } = clampQuestionPage(filters.page, normalizedCount);
  let questionQuery = supabase
    .from("questions")
    .select(
      `id,code,title,skill,difficulty,visibility,status,owner_id,created_at,current_version:question_versions!fk_questions_current_version(
          id,question_type,prompt_text,prompt_content,explanation_text,
          question_options(id,option_key,content,order_index),
          answer_key:question_answer_keys(answer_key,grading_config),
          media:question_media(id,media_role,object_path)
        )`,
    )
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .range((page - 1) * QUESTION_PAGE_SIZE, page * QUESTION_PAGE_SIZE - 1);
  if (filters.q?.trim())
    questionQuery = questionQuery.or(
      `title.ilike.%${filters.q.trim()}%,code.ilike.%${filters.q.trim()}%`,
    );
  if (filters.skill)
    questionQuery = questionQuery.eq("skill", filters.skill as never);
  if (filters.visibility)
    questionQuery = questionQuery.eq("visibility", filters.visibility as never);
  const [{ data, error }, { data: teachers }, { data: auth }] =
    await Promise.all([
      questionQuery,
      supabase
        .from("teachers")
        .select(
          "id,teacher_code,profile:profiles!fk_teachers_profile!inner(full_name)",
        )
        .eq("is_active", true)
        .order("teacher_code"),
      supabase.auth.getUser(),
    ]);
  if (error) throw new Error("Không tải được Ngân hàng câu hỏi.");
  const questions = await Promise.all(
    (data ?? []).map(async (question) => {
      if (!question.current_version) return question;
      const media = await Promise.all(
        question.current_version.media.map(async (item) => {
          if (item.media_role !== "prompt_audio") {
            return { ...item, signed_url: null };
          }
          const { data: signed } = await supabase.storage
            .from("question-media")
            .createSignedUrl(item.object_path, 300);
          return { ...item, signed_url: signed?.signedUrl ?? null };
        }),
      );
      return {
        ...question,
        current_version: { ...question.current_version, media },
      };
    }),
  );
  return {
    questions,
    teachers: (teachers ?? []).map((teacher) => ({
      id: teacher.id,
      teacher_code: teacher.teacher_code,
      full_name: teacher.profile.full_name,
    })),
    currentUserId: auth.user?.id,
    count: normalizedCount,
    page,
    totalPages,
    kind,
  };
}

export async function getQuestionReviewRequests() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("question_review_requests")
    .select(
      "id,status,submitted_at,review_reason,question:questions(id,code,title,visibility)",
    )
    .eq("status", "pending")
    .order("submitted_at");
  if (error) throw new Error("Không tải được hàng chờ duyệt câu hỏi.");
  return data ?? [];
}
