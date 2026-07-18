import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  signAttemptPayloadAudio,
  signGradingAudio,
} from "@/features/assessment-results/server/audio-signing";
import { getStudentAssessmentOverview } from "@/features/assessment-results/server/overview";

export async function getExerciseTeacherData() {
  const supabase = await createClient();
  const [
    { data: deliveries, error },
    { data: classes, error: classesError },
    { data: sets, error: setsError },
  ] = await Promise.all([
    supabase
      .from("exercise_deliveries")
      .select(
        "id,title,status,available_from,due_at,max_score,class:classes(id,code,name),attempts:exercise_attempts(id,status,is_late,final_score,results_published_at)",
      )
      .order("due_at", { ascending: false }),
    supabase
      .from("class_teachers")
      .select("class:classes(id,code,name,status)")
      .order("created_at"),
    supabase
      .from("question_set_versions")
      .select(
        "id,version_no,title_snapshot,raw_max_score,question_set:question_sets!question_set_versions_question_set_id_fkey!inner(id,title,kind,status)",
      )
      .not("locked_at", "is", null),
  ]);
  if (error || classesError || setsError) {
    throw new Error(
      `Không tải được bài tập: ${error?.message ?? classesError?.message ?? setsError?.message}`,
    );
  }
  return {
    deliveries: deliveries ?? [],
    classes: (classes ?? []).map((row) => row.class).filter(Boolean),
    sets: (sets ?? []).filter((set) => set.question_set.kind === "exercise"),
  };
}

export async function getStudentExerciseDeliveries() {
  return (await getStudentAssessmentOverview()).exercises;
}

export async function getExerciseAttemptPayload(attemptId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_exercise_attempt_payload", {
    p_attempt_id: attemptId,
  });
  if (error || !data) throw new Error("Không tải được lượt làm.");
  return signAttemptPayloadAudio(supabase, data);
}

export async function getExerciseGradingData(deliveryId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exercise_deliveries")
    .select(
      `id,title,status,max_score,results_published_at:published_at,class:classes(code,name),
       attempts:exercise_attempts(
         id,attempt_no,status,is_late,submitted_at,raw_score,final_score,results_published_at,
         enrollment:enrollments(id,student:students(id,student_code,full_name)),
         answers:exercise_answers(
           id,set_item_id,answer_payload,auto_score,manual_score,final_score,feedback,override_reason,
           item:question_set_items(points,order_index,question_version:question_versions(question_type,prompt_text))
         )
       )`,
    )
    .eq("id", deliveryId)
    .maybeSingle();
  if (error)
    throw new Error(`Không tải được dữ liệu chấm bài: ${error.message}`);
  return signGradingAudio(supabase, data);
}
