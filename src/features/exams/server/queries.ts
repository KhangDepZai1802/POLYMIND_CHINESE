import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  signAttemptPayloadAudio,
  signGradingAudio,
} from "@/features/assessment-results/server/audio-signing";
import { getStudentAssessmentOverview } from "@/features/assessment-results/server/overview";
export async function getExamTeacherData() {
  const supabase = await createClient();
  const [
    { data: deliveries, error },
    { data: classes, error: classesError },
    { data: sets, error: setsError },
  ] =
    await Promise.all([
      supabase
        .from("exam_deliveries")
        .select(
          "id,title,exam_type,status,opens_at,closes_at,duration_minutes,results_published_at,class:classes(id,code,name),attempts:exam_attempts(id,status,started_at,submitted_at,final_score_100)",
        )
        .order("opens_at", { ascending: false }),
      supabase
        .from("class_teachers")
        .select("class:classes(id,code,name,status)"),
      supabase
        .from("question_set_versions")
        .select(
          "id,version_no,title_snapshot,question_set:question_sets!question_set_versions_question_set_id_fkey!inner(id,title,kind,status)",
        )
        .not("locked_at", "is", null),
    ]);
  if (error || classesError || setsError) {
    throw new Error(
      `Không tải được kỳ thi: ${error?.message ?? classesError?.message ?? setsError?.message}`,
    );
  }
  return {
    deliveries: deliveries ?? [],
    classes: (classes ?? []).map((row) => row.class).filter(Boolean),
    sets: (sets ?? []).filter((set) => set.question_set.kind === "exam"),
  };
}
export async function getStudentExams() {
  return (await getStudentAssessmentOverview()).exams;
}

export function getCurrentTimestamp() {
  return Date.now();
}
export async function getExamAttemptPayload(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_exam_attempt_payload", {
    p_attempt_id: id,
  });
  if (error || !data) throw new Error("Không tải được lượt thi.");
  return signAttemptPayloadAudio(supabase, data);
}

export async function getExamGradingData(deliveryId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exam_deliveries")
    .select(
      `id,title,status,results_published_at,class:classes(code,name),
       attempts:exam_attempts(
         id,status,submitted_at,submission_reason,raw_score,final_score_100,graded_at,
         enrollment:enrollments(id,student:students(id,student_code,full_name)),
         answers:exam_answers(
           id,set_item_id,answer_payload,auto_score,manual_score,final_score,feedback,override_reason,
           item:question_set_items(points,order_index,question_version:question_versions(question_type,prompt_text))
         ),
         integrity_events:exam_integrity_events(id,event_type,occurred_at)
       )`,
    )
    .eq("id", deliveryId)
    .maybeSingle();
  if (error) throw new Error(`Không tải được dữ liệu chấm thi: ${error.message}`);
  return signGradingAudio(supabase, data);
}
