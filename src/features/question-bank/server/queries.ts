import "server-only";

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
  const page = Math.max(1, Number(filters.page) || 1);
  let questionQuery = supabase
    .from("questions")
    .select(
      `id,code,title,skill,difficulty,visibility,status,owner_id,created_at,current_version:question_versions!fk_questions_current_version(
          id,question_type,prompt_text,prompt_content,explanation_text,
          question_options(id,option_key,content,order_index),
          answer_key:question_answer_keys(answer_key,grading_config),
          media:question_media(id,media_role)
        )`,
      { count: "exact" },
    )
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .range((page - 1) * 20, page * 20 - 1);
  if (filters.q?.trim())
    questionQuery = questionQuery.or(
      `title.ilike.%${filters.q.trim()}%,code.ilike.%${filters.q.trim()}%`,
    );
  if (filters.skill)
    questionQuery = questionQuery.eq("skill", filters.skill as never);
  if (filters.visibility)
    questionQuery = questionQuery.eq("visibility", filters.visibility as never);
  const [{ data, error, count }, { data: teachers }, { data: auth }] =
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
  return {
    questions: data,
    teachers: (teachers ?? []).map((teacher) => ({
      id: teacher.id,
      teacher_code: teacher.teacher_code,
      full_name: teacher.profile.full_name,
    })),
    currentUserId: auth.user?.id,
    count: count ?? 0,
    page,
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
