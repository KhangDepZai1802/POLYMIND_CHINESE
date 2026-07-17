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
  "speaking",
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
  speaking: "Nói (thu âm)",
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

// ─────────────────────────────────────────────────────────────────────────
// P-B/P-C — Wizard soạn câu hỏi theo kỹ năng
// Chỉ mở các dạng câu render + chấm được trọn vẹn ở renderer hiện tại.
// `reading_group` (renderer chưa render câu con) và `matching` (chấm exact
// string không ổn định) tạm loại khỏi wizard — cần nâng renderer trước.
// `speaking` (P-C): đề bằng chữ, học viên thu âm trả lời, GV chấm tay.
// ─────────────────────────────────────────────────────────────────────────

export const QUESTION_SKILLS = [
  "listening",
  "speaking",
  "reading",
  "writing",
  "vocabulary",
  "grammar",
] as const;

export type QuestionSkill = (typeof QUESTION_SKILLS)[number];

export const QUESTION_SKILL_LABELS: Record<QuestionSkill, string> = {
  listening: "Nghe",
  speaking: "Nói",
  reading: "Đọc",
  writing: "Viết",
  vocabulary: "Từ vựng",
  grammar: "Ngữ pháp",
};

/** Kỹ năng có thể soạn trong wizard (Nói mở từ P-C). */
export const WIZARD_SKILLS = [
  "listening",
  "speaking",
  "reading",
  "writing",
  "vocabulary",
  "grammar",
] as const satisfies readonly QuestionSkill[];

/** Dạng câu hợp lệ cho từng kỹ năng trong wizard. Thứ tự = gợi ý ưu tiên. */
export const SKILL_QUESTION_TYPES: Record<
  (typeof WIZARD_SKILLS)[number],
  readonly QuestionType[]
> = {
  listening: ["listening_choice", "dictation"],
  speaking: ["speaking"],
  reading: ["single_choice", "multiple_choice", "true_false", "short_text"],
  writing: ["essay_translation", "fill_blank", "short_text"],
  vocabulary: ["single_choice", "multiple_choice", "fill_blank", "short_text"],
  grammar: ["single_choice", "multiple_choice", "true_false", "fill_blank", "ordering"],
};

/** Dạng câu cần media audio (upload + player trong editor). */
export const AUDIO_QUESTION_TYPES: readonly QuestionType[] = [
  "listening_choice",
  "dictation",
];

const optionText = z.string().trim().min(1, "Nhập nội dung lựa chọn");
const acceptedList = z
  .array(z.string().trim().min(1))
  .min(1, "Cần ít nhất một đáp án chấp nhận");
const maxPlays = z.number().int().min(1).max(20).default(2);

/**
 * Nội dung có cấu trúc do wizard gửi lên (JSON trong field `content`).
 * Builder chuyển thành đúng shape mà `create_question_version` +
 * `app.auto_score_answer` mong đợi.
 */
export const structuredContentSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.enum(["single_choice", "listening_choice"]),
    options: z.array(optionText).min(2, "Cần ít nhất hai lựa chọn"),
    correctIndex: z.number().int().min(0),
    maxPlays: maxPlays.optional(),
  }),
  z.object({
    type: z.literal("multiple_choice"),
    options: z.array(optionText).min(2, "Cần ít nhất hai lựa chọn"),
    correctIndexes: z.array(z.number().int().min(0)).min(1, "Chọn ít nhất một đáp án đúng"),
    partialCredit: z.boolean().default(false),
    wrongSelectionZero: z.boolean().default(false),
  }),
  z.object({ type: z.literal("true_false"), correct: z.boolean() }),
  z.object({
    type: z.enum(["fill_blank", "short_text"]),
    accepted: acceptedList,
  }),
  z.object({ type: z.literal("dictation"), accepted: acceptedList, maxPlays: maxPlays.optional() }),
  z.object({
    type: z.literal("ordering"),
    tokens: z.array(z.string().trim().min(1)).min(2, "Cần ít nhất hai token"),
  }),
  z.object({
    type: z.literal("essay_translation"),
    rubric: z
      .array(z.object({ criterion: z.string().trim().min(1), points: z.number().positive() }))
      .min(1, "Cần ít nhất một tiêu chí rubric"),
  }),
  z.object({
    // Nói: chỉ có đề bằng chữ; HV thu âm trả lời (không giới hạn thời lượng),
    // GV chấm tay điểm tự do.
    type: z.literal("speaking"),
  }),
]);

export type StructuredContent = z.infer<typeof structuredContentSchema>;

export type BuiltQuestionPayload = {
  options: Array<{ key: string; content: string }>;
  answerKey: Record<string, unknown>;
  gradingConfig: Record<string, unknown>;
  promptContent: Record<string, unknown>;
};

/** option_key 1-based để khớp renderer/answer payload `{ value: option_key }`. */
function toOptions(values: string[]): BuiltQuestionPayload["options"] {
  return values.map((content, index) => ({ key: String(index + 1), content: content.trim() }));
}

export function buildStructuredPayload(content: StructuredContent): BuiltQuestionPayload {
  switch (content.type) {
    case "single_choice":
    case "listening_choice": {
      if (content.correctIndex >= content.options.length) {
        throw new Error("Đáp án đúng nằm ngoài danh sách lựa chọn");
      }
      return {
        options: toOptions(content.options),
        answerKey: { value: String(content.correctIndex + 1) },
        gradingConfig: {},
        promptContent:
          content.type === "listening_choice" ? { max_plays: content.maxPlays ?? 2 } : {},
      };
    }
    case "multiple_choice": {
      const keys = [...new Set(content.correctIndexes)].sort((a, b) => a - b);
      if (keys.some((index) => index >= content.options.length)) {
        throw new Error("Đáp án đúng nằm ngoài danh sách lựa chọn");
      }
      return {
        options: toOptions(content.options),
        answerKey: { values: keys.map((index) => String(index + 1)) },
        gradingConfig: {
          scoring_mode: content.partialCredit ? "partial_credit" : "all_or_nothing",
          wrong_selection_zero: content.wrongSelectionZero,
        },
        promptContent: {},
      };
    }
    case "true_false":
      // Renderer gửi option_key dạng chuỗi "true"/"false" → answer_key phải là chuỗi.
      return {
        options: [],
        answerKey: { value: content.correct ? "true" : "false" },
        gradingConfig: {},
        promptContent: {},
      };
    case "fill_blank":
    case "short_text":
      return {
        options: [],
        answerKey: { accepted: content.accepted.map((value) => value.trim()) },
        gradingConfig: {},
        promptContent: {},
      };
    case "dictation":
      return {
        options: [],
        answerKey: { accepted: content.accepted.map((value) => value.trim()) },
        gradingConfig: {},
        promptContent: { max_plays: content.maxPlays ?? 2 },
      };
    case "ordering":
      // Hiển thị token qua options; đáp án = đúng thứ tự token (so khớp mảng JSONB).
      return {
        options: toOptions(content.tokens),
        answerKey: { value: content.tokens.map((token) => token.trim()) },
        gradingConfig: {},
        promptContent: {},
      };
    case "essay_translation":
      return {
        options: [],
        answerKey: { manual: true },
        gradingConfig: { rubric: content.rubric },
        promptContent: {},
      };
    case "speaking":
      return {
        options: [],
        answerKey: { manual: true },
        gradingConfig: {},
        promptContent: {},
      };
  }
}

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
