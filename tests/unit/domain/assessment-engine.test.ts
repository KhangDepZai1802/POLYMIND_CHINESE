import { describe, expect, it } from "vitest";

import {
  matchesAcceptedAnswer,
  normalizeChineseAnswer,
} from "@/features/chinese-input/normalization";
import { examDeadline, isSameVietnamDate } from "@/features/exams/domain/time";
import {
  authoringPayload,
  QUESTION_TYPES,
  questionContentSchema,
} from "@/features/question-builder/domain/questions";
import {
  partialMultiSelectScore,
  scaleScore,
} from "@/features/question-builder/domain/scoring";

describe("assessment engine domain", () => {
  it("đăng ký đủ 11 dạng câu", () => expect(QUESTION_TYPES).toHaveLength(11));
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
  it("tính deadline theo mốc đến trước và cùng ngày Việt Nam", () => {
    const opens = new Date("2026-07-25T01:00:00Z");
    const closes = new Date("2026-07-25T15:00:00Z");
    expect(isSameVietnamDate(opens, closes)).toBe(true);
    expect(
      examDeadline(new Date("2026-07-25T14:40:00Z"), closes, 45).toISOString(),
    ).toBe(closes.toISOString());
  });
});
