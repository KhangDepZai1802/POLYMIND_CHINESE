import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WrongAnswerReview } from "@/features/wrong-answer-review/components/wrong-answer-review";
import { submitWrongAnswerReviewAction } from "@/features/wrong-answer-review/server/actions";

vi.mock("@/features/wrong-answer-review/server/actions", () => ({
  submitWrongAnswerReviewAction: vi.fn(),
}));

const item = {
  queue_id: "11111111-1111-4111-8111-111111111111",
  question_version_id: "22222222-2222-4222-8222-222222222222",
  question_type: "single_choice",
  prompt: "你好 nghĩa là gì?",
  prompt_content: {},
  options: [
    { option_key: "a", content: "Xin chào" },
    { option_key: "b", content: "Cảm ơn" },
  ],
  source_kind: "exercise",
  wrong_count: 2,
  first_seen_at: "2026-07-20T00:00:00Z",
  last_seen_at: "2026-07-21T00:00:00Z",
} as const;

describe("WrongAnswerReview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lưu lần sai, cho thử lại và loại câu khỏi danh sách sau khi đúng", async () => {
    const user = userEvent.setup();
    vi.mocked(submitWrongAnswerReviewAction)
      .mockResolvedValueOnce({
        success: "Chưa đúng — lần thử đã được lưu, bạn có thể làm lại.",
        isCorrect: false,
        score: 0,
      })
      .mockResolvedValueOnce({
        success: "Chính xác — câu này đã rời danh sách cần ôn.",
        isCorrect: true,
        score: 1,
      });

    render(<WrongAnswerReview initialItems={[item] as never} />);

    await user.click(screen.getByRole("radio", { name: "Cảm ơn" }));
    await user.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
    expect(
      await screen.findByText(
        "Chưa đúng — lần thử đã được lưu, bạn có thể làm lại.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("你好 nghĩa là gì?")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Xin chào" }));
    await user.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));
    expect(await screen.findByText("Bạn đã ôn xong")).toBeInTheDocument();

    expect(submitWrongAnswerReviewAction).toHaveBeenNthCalledWith(1, {
      queueId: item.queue_id,
      answerPayload: { value: "b" },
    });
    expect(submitWrongAnswerReviewAction).toHaveBeenNthCalledWith(2, {
      queueId: item.queue_id,
      answerPayload: { value: "a" },
    });
  });
});
