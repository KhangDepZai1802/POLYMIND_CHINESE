import { z } from "zod";

import { QUESTION_TYPES } from "@/features/question-builder/domain/questions";

const objectiveQuestionTypeSchema = z
  .enum(QUESTION_TYPES)
  .refine(
    (type) => type !== "essay_translation" && type !== "speaking",
    "Dạng câu chấm tay không được đưa vào ôn câu sai.",
  );

export const wrongAnswerReviewItemSchema = z.object({
  queue_id: z.uuid(),
  question_version_id: z.uuid(),
  question_type: objectiveQuestionTypeSchema,
  prompt: z.string().min(1),
  prompt_content: z.record(z.string(), z.unknown()),
  options: z.array(
    z.object({
      option_key: z.string(),
      content: z.string(),
    }),
  ),
  source_kind: z.enum(["exercise", "exam"]),
  wrong_count: z.number().int().positive(),
  first_seen_at: z.string(),
  last_seen_at: z.string(),
});

export const wrongAnswerReviewListSchema = z.array(wrongAnswerReviewItemSchema);

export const submitWrongAnswerReviewSchema = z.object({
  queueId: z.uuid(),
  answerPayload: z.record(z.string(), z.unknown()),
});

export const submitWrongAnswerReviewResultSchema = z.object({
  is_correct: z.boolean(),
  score: z.number().nullable(),
  resolved: z.boolean(),
});

export type WrongAnswerReviewItem = z.infer<
  typeof wrongAnswerReviewItemSchema
> & {
  prompt_content: Record<string, unknown> & { audio_url?: string };
};
