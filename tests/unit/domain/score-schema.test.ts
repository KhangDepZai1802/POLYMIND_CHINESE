import { describe, expect, it } from "vitest";

import { assessmentResultSchema } from "@/features/assessments/schema";
import { evaluationCreateSchema } from "@/features/evaluations/schema";

const IDS = {
  assessment_id: "11111111-1111-4111-8111-111111111111",
  class_id: "22222222-2222-4222-8222-222222222222",
  enrollment_id: "33333333-3333-4333-8333-333333333333",
};

/**
 * `z.coerce.number()` biến chuỗi rỗng thành **0**.
 *
 * Nếu form nhập điểm dùng nó, mọi kỹ năng giáo viên CHƯA chấm sẽ được ghi 0 vào
 * học bạ học viên — im lặng, không có lỗi nào bật lên. Đây là bài test canh đúng
 * chỗ đó.
 */
describe("assessmentResultSchema — ô trống là 'chưa chấm', không phải 0", () => {
  it("map ô điểm rỗng về null, không phải 0", () => {
    const parsed = assessmentResultSchema.safeParse({
      ...IDS,
      overall_score: "85",
      listening_score: "",
      speaking_score: "",
      reading_score: "",
      writing_score: "",
      vocabulary_score: "",
      grammar_score: "",
      feedback: "",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.overall_score).toBe(85);
    expect(parsed.data?.listening_score).toBeNull();
    expect(parsed.data?.listening_score).not.toBe(0);
    expect(parsed.data?.feedback).toBeNull();
  });

  it("giữ đúng 0 khi giáo viên CỐ Ý cho 0 điểm", () => {
    const parsed = assessmentResultSchema.safeParse({
      ...IDS,
      overall_score: "0",
      listening_score: "",
      speaking_score: "",
      reading_score: "",
      writing_score: "",
      vocabulary_score: "",
      grammar_score: "",
      feedback: "",
    });

    // 0 điểm là một quyết định chấm bài hợp lệ — phải phân biệt được với "bỏ trống".
    expect(parsed.data?.overall_score).toBe(0);
  });

  it("từ chối điểm âm và điểm ngoài thang 0..100", () => {
    for (const bad of ["-1", "101"]) {
      const parsed = assessmentResultSchema.safeParse({
        ...IDS,
        overall_score: bad,
        listening_score: "",
        speaking_score: "",
        reading_score: "",
        writing_score: "",
        vocabulary_score: "",
        grammar_score: "",
        feedback: "",
      });
      expect(parsed.success).toBe(false);
    }
  });
});

describe("evaluationCreateSchema — rating bỏ trống là 'chưa đánh giá'", () => {
  const base = {
    enrollment_id: IDS.enrollment_id,
    evaluation_date: "2026-07-20",
    period_start: "",
    period_end: "",
    strengths: "",
    areas_for_improvement: "",
    action_plan: "",
    teacher_comment: "Tốt",
  };

  it("map rating 'none'/rỗng về null, KHÔNG phải 'weak'", () => {
    const parsed = evaluationCreateSchema.safeParse({
      ...base,
      overall_rating: "good",
      listening_rating: "none",
      speaking_rating: "",
      reading_rating: "none",
      writing_rating: "none",
      vocabulary_rating: "none",
      grammar_rating: "none",
    });

    expect(parsed.success).toBe(true);
    expect(parsed.data?.overall_rating).toBe("good");
    expect(parsed.data?.listening_rating).toBeNull();
    expect(parsed.data?.speaking_rating).toBeNull();
    // "chưa đánh giá" bị hiểu thành "Yếu" là vu oan cho học viên.
    expect(parsed.data?.listening_rating).not.toBe("weak");
  });

  it("từ chối kỳ đánh giá kết thúc trước khi bắt đầu", () => {
    const parsed = evaluationCreateSchema.safeParse({
      ...base,
      period_start: "2026-07-20",
      period_end: "2026-07-01",
      overall_rating: "none",
      listening_rating: "none",
      speaking_rating: "none",
      reading_rating: "none",
      writing_rating: "none",
      vocabulary_rating: "none",
      grammar_rating: "none",
    });

    expect(parsed.success).toBe(false);
  });
});
