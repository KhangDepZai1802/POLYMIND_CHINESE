import { z } from "zod";

export const QUESTION_TYPES = [
  "single_choice",
  "multiple_choice",
  "true_false",
  "fill_blank",
  "short_text",
  "ordering",
  "matching",
  "reading_group",
  "listening_choice",
  "dictation",
  "essay_translation",
] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_choice: "Trắc nghiệm một đáp án",
  multiple_choice: "Trắc nghiệm nhiều đáp án",
  true_false: "Đúng / Sai",
  fill_blank: "Điền vào chỗ trống",
  short_text: "Trả lời ngắn",
  ordering: "Sắp xếp từ thành câu",
  matching: "Nối cặp",
  reading_group: "Đọc hiểu với câu hỏi con",
  listening_choice: "Nghe và chọn đáp án",
  dictation: "Nghe chép chính tả",
  essay_translation: "Tự luận / Dịch",
};

const base = z.object({
  prompt: z.string().trim().min(1, "Nhập nội dung câu hỏi"),
});

const options = z.array(z.string().trim().min(1)).min(2);

export const questionContentSchema = z.discriminatedUnion("type", [
  base.extend({
    type: z.literal("single_choice"),
    options,
    correctKey: z.string().min(1),
  }),
  base.extend({
    type: z.literal("multiple_choice"),
    options,
    correctKeys: z.array(z.string()).min(1),
    partialCredit: z.boolean().default(false),
  }),
  base.extend({ type: z.literal("true_false"), correct: z.boolean() }),
  base.extend({
    type: z.literal("fill_blank"),
    acceptedAnswers: z.array(z.string().min(1)).min(1),
  }),
  base.extend({
    type: z.literal("short_text"),
    acceptedAnswers: z.array(z.string().min(1)).min(1),
  }),
  base.extend({
    type: z.literal("ordering"),
    tokens: z.array(z.string().min(1)).min(2),
  }),
  base.extend({
    type: z.literal("matching"),
    pairs: z
      .array(z.object({ left: z.string().min(1), right: z.string().min(1) }))
      .min(2),
  }),
  base.extend({
    type: z.literal("reading_group"),
    passage: z.string().trim().min(1),
    childConfig: z.record(z.string(), z.unknown()).default({}),
  }),
  base.extend({
    type: z.literal("listening_choice"),
    options,
    audioPath: z.string().min(1),
    correctKey: z.string().min(1),
    maxPlays: z.number().int().positive().default(2),
  }),
  base.extend({
    type: z.literal("dictation"),
    audioPath: z.string().min(1),
    acceptedAnswers: z.array(z.string().min(1)).min(1),
    maxPlays: z.number().int().positive().default(2),
  }),
  base.extend({
    type: z.literal("essay_translation"),
    rubric: z
      .array(
        z.object({
          criterion: z.string().min(1),
          points: z.number().positive(),
        }),
      )
      .min(1),
  }),
]);

export const questionAuthoringSchema = z.object({
  title: z.string().trim().min(2, "Nhập tiêu đề nội bộ"),
  question_type: z.enum(QUESTION_TYPES),
  skill: z.enum([
    "listening",
    "speaking",
    "reading",
    "writing",
    "vocabulary",
    "grammar",
  ]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  prompt_text: z.string().trim().min(1, "Nhập nội dung câu hỏi"),
  options_text: z.string().default(""),
  answer_text: z.string().default(""),
  explanation_text: z.string().default(""),
});

export function authoringPayload(
  input: z.infer<typeof questionAuthoringSchema>,
) {
  const optionsList = input.options_text
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  const optionsPayload = optionsList.map((content, index) => ({
    key: String(index + 1),
    content,
  }));
  const answers = input.answer_text
    .split(/\r?\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);

  if (
    ["single_choice", "multiple_choice", "listening_choice"].includes(
      input.question_type,
    ) &&
    optionsPayload.length < 2
  ) {
    throw new Error("Dạng trắc nghiệm cần ít nhất hai lựa chọn");
  }
  if (input.question_type !== "essay_translation" && answers.length === 0) {
    throw new Error("Câu hỏi cần đáp án chấm");
  }

  const answerKey =
    input.question_type === "multiple_choice"
      ? { values: answers }
      : ["fill_blank", "short_text", "dictation"].includes(input.question_type)
        ? { accepted: answers }
        : input.question_type === "essay_translation"
          ? { manual: true }
          : {
              value:
                input.question_type === "true_false"
                  ? answers[0] === "true"
                  : answers[0],
            };

  return {
    options: optionsPayload,
    answerKey,
    gradingConfig:
      input.question_type === "multiple_choice"
        ? { scoring_mode: "all_or_nothing" }
        : {},
  };
}
