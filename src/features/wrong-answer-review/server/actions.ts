"use server";

import { revalidatePath } from "next/cache";

import {
  submitWrongAnswerReviewResultSchema,
  submitWrongAnswerReviewSchema,
} from "@/features/wrong-answer-review/schema";
import { dbErrorToMessage } from "@/lib/action-state";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type SubmitWrongAnswerReviewResult =
  | { error: string }
  | {
      success: string;
      isCorrect: boolean;
      score: number | null;
    };

export async function submitWrongAnswerReviewAction(
  input: unknown,
): Promise<SubmitWrongAnswerReviewResult> {
  await requireRole("student");
  const parsed = submitWrongAnswerReviewSchema.safeParse(input);
  if (!parsed.success) return { error: "Câu trả lời ôn tập không hợp lệ." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("submit_wrong_answer_review", {
    p_queue_id: parsed.data.queueId,
    p_answer_payload: parsed.data.answerPayload as Json,
  });
  if (error) {
    return {
      error: dbErrorToMessage(error, "Không chấm được câu trả lời lúc này."),
    };
  }

  const result = submitWrongAnswerReviewResultSchema.safeParse(data);
  if (!result.success) {
    return { error: "Kết quả chấm từ hệ thống không hợp lệ." };
  }

  revalidatePath("/student/review");
  return {
    success: result.data.is_correct
      ? "Chính xác — câu này đã rời danh sách cần ôn."
      : "Chưa đúng — lần thử đã được lưu, bạn có thể làm lại.",
    isCorrect: result.data.is_correct,
    score: result.data.score,
  };
}
