import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/question-builder/server/actions", () => ({
  createQuestionSetSectionAction: vi.fn(),
  createQuestionSetAction: vi.fn(),
  deleteQuestionSetAction: vi.fn(),
  lockQuestionSetAction: vi.fn(),
  moveQuestionSetItemAction: vi.fn(),
  removeQuestionSetItemAction: vi.fn(),
  unlockQuestionSetForEditAction: vi.fn(),
}));
vi.mock("@/lib/use-form-action", () => ({
  useFormAction: () => ({ formAction: vi.fn() }),
}));

import { ConfirmationProvider } from "@/components/shared/confirmation-provider";
import { SetManager } from "@/features/question-builder/components/set-manager";

describe("question set preview audio", () => {
  it("truyền signed URL của audio câu hỏi vào renderer khi preview bộ đề", async () => {
    const user = userEvent.setup();
    render(
      <ConfirmationProvider>
        <SetManager
          kind="exercise"
          questions={[]}
          sets={[
            {
              id: "set-1",
              title: "Bộ nghe",
              description: null,
              status: "ready",
              current_version: {
                id: "version-1",
                version_no: 1,
                raw_max_score: 2,
                locked_at: "2026-07-18T00:00:00Z",
                question_set_sections: [],
                question_set_items: [
                  {
                    id: "item-1",
                    section_id: null,
                    points: 2,
                    order_index: 1,
                    question_version: {
                      id: "question-version-1",
                      question_id: "question-1",
                      question_type: "listening_choice",
                      prompt_text: "Nghe và chọn đáp án",
                      prompt_content: {
                        audio_url: "https://signed.example/audio.mp3",
                      },
                      question_options: [
                        { id: "option-1", option_key: "a", content: "你好", order_index: 1 },
                      ],
                    },
                  },
                ],
              },
            },
          ]}
        />
      </ConfirmationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Preview" }));
    const source = document.querySelector("audio source");
    expect(source).toHaveAttribute("src", "https://signed.example/audio.mp3");
  });
});
