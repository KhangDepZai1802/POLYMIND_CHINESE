import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/question-builder/server/actions", () => ({
  addQuestionSetItemsAction: vi.fn(async () => ({})),
}));

import { QuestionPicker } from "@/features/question-builder/components/question-picker";

describe("QuestionPicker", () => {
  it("ghi chú và khóa câu đã có trong bộ, đồng thời không điền sẵn điểm", async () => {
    const user = userEvent.setup();
    render(
      <QuestionPicker
        setVersionId="59000000-0000-0000-0000-000000000001"
        sections={[]}
        selectedQuestionIds={["56000000-0000-0000-0000-000000000001"]}
        questions={[
          {
            id: "56000000-0000-0000-0000-000000000001",
            code: "CH-001",
            title: "Câu đã chọn",
            skill: "reading",
            current_version: {
              id: "57000000-0000-0000-0000-000000000002",
              question_type: "single_choice",
              prompt_text: "Đây là version mới của câu đã chọn",
            },
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Thêm câu hỏi/i }));

    expect(
      screen.getByText("Câu này đã được chọn vào bộ này rồi"),
    ).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByLabelText("Điểm mỗi câu")).toHaveValue(null);
    expect(screen.getByPlaceholderText("Chưa nhập")).toBeRequired();
  });
});
