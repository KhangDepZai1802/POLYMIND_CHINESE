import { render, screen, within } from "@testing-library/react";
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

  it("dùng player tốc độ cho audio nguồn khi ôn câu sai", () => {
    render(
      <WrongAnswerReview
        initialItems={
          [
            {
              ...item,
              question_type: "listening_choice",
              prompt_content: {
                audio_url: "https://signed.test/review-question.mp3",
              },
            },
          ] as never
        }
      />,
    );

    expect(
      screen.getByRole("group", {
        name: "Tốc độ phát Audio câu hỏi: 你好 nghĩa là gì?",
      }),
    ).toBeInTheDocument();
  });

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

  it("hiện tổng quan theo nguồn và số câu sai nhiều lần", () => {
    render(
      <WrongAnswerReview
        initialItems={
          [
            item,
            {
              ...item,
              queue_id: "33333333-3333-4333-8333-333333333333",
              source_kind: "exam",
              wrong_count: 1,
            },
          ] as never
        }
      />,
    );

    // Nhãn "Từ Bài tập" xuất hiện cả ở thẻ tổng quan lẫn badge của câu đang
    // mở, nên phải khoanh vùng vào đúng section tổng quan.
    const overview = within(
      screen.getByRole("region", { name: "Tổng quan câu cần ôn" }),
    );
    expect(overview.getByText("Còn cần ôn").nextSibling).toHaveTextContent("2");
    expect(overview.getByText("Từ Bài tập").nextSibling).toHaveTextContent("1");
    expect(overview.getByText("Từ Bài thi").nextSibling).toHaveTextContent("1");
    // Chỉ câu `wrong_count: 2` mới vào nhóm ưu tiên.
    expect(overview.getByText("Sai nhiều lần").nextSibling).toHaveTextContent(
      "1",
    );
    expect(
      screen.getByRole("heading", { name: "Câu 1/2", level: 2 }),
    ).toBeInTheDocument();
  });

  it("đo tiến độ phiên ôn bằng progressbar và giữ vùng thông báo thường trú", async () => {
    const user = userEvent.setup();
    vi.mocked(submitWrongAnswerReviewAction).mockResolvedValueOnce({
      success: "Chính xác — câu này đã rời danh sách cần ôn.",
      isCorrect: true,
      score: 1,
    });

    render(
      <WrongAnswerReview
        initialItems={
          [
            item,
            {
              ...item,
              queue_id: "44444444-4444-4444-8444-444444444444",
            },
          ] as never
        }
      />,
    );

    // Vùng live phải có sẵn trong DOM TRƯỚC khi có thông báo nào — nếu chỉ
    // render kèm nội dung thì trình đọc màn hình bỏ qua kết quả chấm.
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
    expect(liveRegion).toBeEmptyDOMElement();

    const bar = screen.getByRole("progressbar", {
      name: "Tiến độ ôn câu sai",
    });
    expect(bar).toHaveAttribute("aria-valuenow", "0");
    expect(bar).toHaveAttribute("aria-valuetext", "0 trên 2 câu đã ôn xong");

    await user.click(screen.getByRole("radio", { name: "Xin chào" }));
    await user.click(screen.getByRole("button", { name: "Kiểm tra đáp án" }));

    expect(
      await screen.findByRole("progressbar", { name: "Tiến độ ôn câu sai" }),
    ).toHaveAttribute("aria-valuenow", "50");
  });

  it("cho lối đi tiếp khi đã ôn hết", () => {
    render(<WrongAnswerReview initialItems={[]} />);

    expect(screen.getByText("Bạn đã ôn xong")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Về Tổng quan" })).toHaveAttribute(
      "href",
      "/student",
    );
    expect(screen.getByRole("link", { name: "Sang Bài tập" })).toHaveAttribute(
      "href",
      "/student/exercises",
    );
    // Không có câu nào từ đầu thì không dựng thanh tiến độ rỗng.
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });
});
