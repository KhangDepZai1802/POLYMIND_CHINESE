import "server-only";

import { createClient } from "@/lib/supabase/server";

export type StudentExerciseOverview = {
  id: string;
  title: string;
  instructions: string | null;
  status: string;
  available_from: string;
  due_at: string;
  max_score: number;
  attempt_limit: number;
  allow_late_submission: boolean;
  class: { code: string; name: string };
  attempts: Array<{
    id: string;
    attempt_no: number;
    status: string;
    started_at: string;
    submitted_at: string | null;
    final_score: number | null;
    results_published_at: string | null;
  }>;
};

export type StudentExamOverview = {
  id: string;
  title: string;
  status: string;
  opens_at: string;
  closes_at: string;
  duration_minutes: number;
  requires_microphone: boolean;
  results_published_at: string | null;
  class: { code: string; name: string };
  attempts: Array<{
    id: string;
    status: string;
    started_at: string;
    deadline_at: string;
    submitted_at: string | null;
    final_score_100: number | null;
  }>;
};

export async function getStudentAssessmentOverview() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_student_assessment_overview");
  if (error || !data)
    throw new Error("Không tải được tổng quan bài tập và kỳ thi.");
  return data as unknown as {
    exercises: StudentExerciseOverview[];
    exams: StudentExamOverview[];
  };
}
