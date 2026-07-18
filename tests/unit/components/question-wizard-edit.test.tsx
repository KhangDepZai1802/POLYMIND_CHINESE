import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { refresh, saveQuestionAction } = vi.hoisted(() => ({
  refresh: vi.fn(),
  saveQuestionAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/question-bank/server/actions", () => ({
  saveQuestionAction,
}));

import { QuestionWizard } from "@/features/question-bank/components/question-wizard";

describe("QuestionWizard edit", () => {
  it("nạp lại đầy đủ đáp án/cấu hình cũ và lưu câu hiện tại", async () => {
    saveQuestionAction.mockResolvedValue({ success: "Đã cập nhật câu hỏi." });
    const user = userEvent.setup();

    render(
      <QuestionWizard
        trigger={<button>Chỉnh sửa</button>}
        version={{
          questionId: "46000000-0000-0000-0000-000000000001",
          sourceVersionId: "47000000-0000-0000-0000-000000000001",
          skill: "reading",
          type: "multiple_choice",
          title: "Chọn nghĩa đúng",
          difficulty: "hard",
          prompt: "你好 nghĩa là gì?",
          explanation: "你好 là xin chào.",
          choices: [
            { key: "1", content: "Tạm biệt" },
            { key: "2", content: "Xin chào" },
            { key: "3", content: "Cảm ơn" },
          ],
          answerKey: { values: ["2"] },
          gradingConfig: {
            scoring_mode: "partial_credit",
            wrong_selection_zero: true,
          },
          promptContent: {},
          hasAudio: false,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Chỉnh sửa" }));

    expect(screen.getByLabelText("Độ khó")).toHaveValue("hard");
    expect(screen.getByLabelText("Đáp án đúng 1")).not.toBeChecked();
    expect(screen.getByLabelText("Đáp án đúng 2")).toBeChecked();
    expect(screen.getByLabelText(/Chấm một phần/)).toBeChecked();
    expect(screen.getByLabelText(/Chọn sai bất kỳ đáp án nào/)).toBeChecked();

    await user.click(screen.getByRole("button", { name: "Tiếp tục" }));
    await user.click(screen.getByRole("button", { name: "Lưu chỉnh sửa" }));

    await waitFor(() => expect(saveQuestionAction).toHaveBeenCalledOnce());
    const submitted = saveQuestionAction.mock.calls[0]![1] as FormData;
    expect(submitted.get("question_id")).toBe(
      "46000000-0000-0000-0000-000000000001",
    );
    expect(submitted.get("difficulty")).toBe("hard");
    expect(JSON.parse(String(submitted.get("content")))).toMatchObject({
      correctIndexes: [1],
      partialCredit: true,
      wrongSelectionZero: true,
    });
    expect(refresh).toHaveBeenCalledOnce();
  });
});
