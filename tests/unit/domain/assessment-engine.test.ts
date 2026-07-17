import { describe, expect, it } from "vitest";

import {
  matchesAcceptedAnswer,
  normalizeChineseAnswer,
} from "@/features/chinese-input/normalization";
import { examDeadline, isSameVietnamDate } from "@/features/exams/domain/time";
import {
  authoringPayload,
  buildStructuredPayload,
  QUESTION_TYPES,
  questionContentSchema,
  SKILL_QUESTION_TYPES,
  structuredContentSchema,
  WIZARD_SKILLS,
} from "@/features/question-builder/domain/questions";
import {
  partialMultiSelectScore,
  scaleScore,
} from "@/features/question-builder/domain/scoring";

describe("assessment engine domain", () => {
  it("đăng ký đủ 12 dạng câu (thêm speaking ở P-C)", () =>
    expect(QUESTION_TYPES).toHaveLength(12));
  it("không nhận single choice thiếu lựa chọn", () =>
    expect(
      questionContentSchema.safeParse({
        type: "single_choice",
        prompt: "选",
        options: ["一"],
        correctKey: "1",
      }).success,
    ).toBe(false));
  it("tạo answer key tách khỏi options", () =>
    expect(
      authoringPayload({
        title: "Q",
        question_type: "single_choice",
        skill: "reading",
        difficulty: "easy",
        prompt_text: "你好",
        options_text: "A\nB",
        answer_text: "1",
        explanation_text: "",
      }).answerKey,
    ).toEqual({ value: "1" }));
  it("chuẩn hóa Unicode/Pinyin và dấu câu theo config", () => {
    expect(
      normalizeChineseAnswer("  Ni3, hao3! ", {
        ignorePunctuation: true,
        caseInsensitiveLatin: true,
      }),
    ).toBe("ni3 hao3");
    expect(
      matchesAcceptedAnswer("nu:3", ["nü3"], { normalizeUmlaut: true }),
    ).toBe(true);
  });
  it("quy đổi điểm và partial credit không âm", () => {
    expect(scaleScore(8, 10, 100, 10)).toBe(72);
    expect(partialMultiSelectScore(2, 4, 10)).toBe(5);
    expect(partialMultiSelectScore(2, 4, 10, true, true)).toBe(0);
  });
  it("wizard: mọi dạng câu theo kỹ năng đều nằm trong dạng chuẩn", () => {
    for (const skill of WIZARD_SKILLS) {
      for (const type of SKILL_QUESTION_TYPES[skill]) {
        expect(QUESTION_TYPES).toContain(type);
      }
    }
    // P-C: Nói đã mở trong wizard, chỉ có một dạng câu `speaking`.
    expect(WIZARD_SKILLS).toContain("speaking");
    expect(SKILL_QUESTION_TYPES.speaking).toEqual(["speaking"]);
  });
  it("buildStructuredPayload: single_choice tách answer key theo option_key 1-based", () => {
    const built = buildStructuredPayload({
      type: "single_choice",
      options: ["一", "二", "三"],
      correctIndex: 2,
    });
    expect(built.options).toEqual([
      { key: "1", content: "一" },
      { key: "2", content: "二" },
      { key: "3", content: "三" },
    ]);
    expect(built.answerKey).toEqual({ value: "3" });
  });
  it("buildStructuredPayload: true_false lưu chuỗi để khớp renderer", () => {
    expect(buildStructuredPayload({ type: "true_false", correct: true }).answerKey).toEqual(
      { value: "true" },
    );
    expect(buildStructuredPayload({ type: "true_false", correct: false }).answerKey).toEqual(
      { value: "false" },
    );
  });
  it("buildStructuredPayload: multiple_choice values + grading_config", () => {
    const built = buildStructuredPayload({
      type: "multiple_choice",
      options: ["A", "B", "C"],
      correctIndexes: [2, 0, 0],
      partialCredit: true,
      wrongSelectionZero: true,
    });
    expect(built.answerKey).toEqual({ values: ["1", "3"] });
    expect(built.gradingConfig).toEqual({
      scoring_mode: "partial_credit",
      wrong_selection_zero: true,
    });
  });
  it("buildStructuredPayload: listening/dictation gắn max_plays vào prompt_content", () => {
    expect(
      buildStructuredPayload({
        type: "listening_choice",
        options: ["A", "B"],
        correctIndex: 0,
        maxPlays: 3,
      }).promptContent,
    ).toEqual({ max_plays: 3 });
    expect(
      buildStructuredPayload({ type: "dictation", accepted: ["你好"], maxPlays: 1 }).promptContent,
    ).toEqual({ max_plays: 1 });
  });
  it("buildStructuredPayload: ordering lưu đáp án là mảng token đúng thứ tự", () => {
    expect(
      buildStructuredPayload({ type: "ordering", tokens: ["我", "爱", "你"] }).answerKey,
    ).toEqual({ value: ["我", "爱", "你"] });
  });
  it("buildStructuredPayload: speaking là câu chấm tay, không kèm cấu hình đề", () => {
    const built = buildStructuredPayload({ type: "speaking" });
    expect(built.answerKey).toEqual({ manual: true });
    expect(built.gradingConfig).toEqual({});
    expect(built.promptContent).toEqual({});
    expect(built.options).toEqual([]);
  });
  it("structuredContentSchema chấp nhận speaking chỉ với type", () => {
    expect(structuredContentSchema.safeParse({ type: "speaking" }).success).toBe(true);
  });
  it("structuredContentSchema từ chối single_choice thiếu lựa chọn", () => {
    expect(
      structuredContentSchema.safeParse({
        type: "single_choice",
        options: ["một"],
        correctIndex: 0,
      }).success,
    ).toBe(false);
  });
  it("tính deadline theo mốc đến trước và cùng ngày Việt Nam", () => {
    const opens = new Date("2026-07-25T01:00:00Z");
    const closes = new Date("2026-07-25T15:00:00Z");
    expect(isSameVietnamDate(opens, closes)).toBe(true);
    expect(
      examDeadline(new Date("2026-07-25T14:40:00Z"), closes, 45).toISOString(),
    ).toBe(closes.toISOString());
  });
});
