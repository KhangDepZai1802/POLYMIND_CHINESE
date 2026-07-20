import "server-only";

import {
  clampQuestionPage,
  QUESTION_PAGE_SIZE,
} from "@/features/question-bank/domain/pagination";
import { getVerifiedIdentity } from "@/lib/auth/verified-identity";
import { createClient } from "@/lib/supabase/server";
import { signPaths } from "@/lib/supabase/signed-urls";

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
  const [{ data, error }, { data: teachers }, identity] = await Promise.all([
    questionQuery,
    supabase
      .from("teachers")
      .select(
        "id,teacher_code,profile:profiles!fk_teachers_profile!inner(full_name)",
      )
      .eq("is_active", true)
      .order("teacher_code"),
    getVerifiedIdentity(supabase.auth),
  ]);
  if (error) throw new Error("Không tải được Ngân hàng câu hỏi.");
  // Ký toàn bộ audio đề của cả trang trong MỘT request (trước đây: một request
  // mỗi file → số request tăng theo số câu hiển thị).
  const signedByPath = await signPaths(
    supabase,
    "question-media",
    (data ?? []).flatMap((question) =>
      (question.current_version?.media ?? [])
        .filter((item) => item.media_role === "prompt_audio")
        .map((item) => item.object_path),
    ),
    300,
  );

  const questions = (data ?? []).map((question) => {
    if (!question.current_version) return question;
    const media = question.current_version.media.map((item) => ({
      ...item,
      signed_url:
        item.media_role === "prompt_audio"
          ? (signedByPath.get(item.object_path) ?? null)
          : null,
    }));
    return {
      ...question,
      current_version: { ...question.current_version, media },
    };
  });
  return {
    questions,
    teachers: (teachers ?? []).map((teacher) => ({
      id: teacher.id,
      teacher_code: teacher.teacher_code,
      full_name: teacher.profile.full_name,
    })),
    currentUserId: identity?.id,
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
