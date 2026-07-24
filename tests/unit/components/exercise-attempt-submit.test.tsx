import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { replace, saveExerciseAnswer, submitExerciseAttempt } = vi.hoisted(
  () => ({
    replace: vi.fn(),
    saveExerciseAnswer: vi.fn(),
    submitExerciseAttempt: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/features/exercises/server/actions", () => ({
  createExerciseSpeakingUploadUrl: vi.fn(),
  deleteExerciseSpeakingAnswer: vi.fn(),
  saveExerciseAnswer,
  submitExerciseAttempt,
  uploadExerciseSpeakingAnswer: vi.fn(),
}));

import { ConfirmationProvider } from "@/components/shared/confirmation-provider";
import { ExerciseAttempt } from "@/features/exercises/student/exercise-attempt";

describe("ExerciseAttempt submit", () => {
  it("hiển thị đủ ngữ cảnh bài và heading từng câu", () => {
    render(
      <ConfirmationProvider>
        <ExerciseAttempt
          payload={{
            attempt: {
              id: "attempt-structure",
              status: "in_progress",
              started_at: "2026-07-18T00:00:00Z",
              attempt_no: 1,
            },
            delivery: {
              id: "delivery-structure",
              title: "Bài luyện nghe",
              instructions: "Nghe kỹ trước khi chọn đáp án.",
              due_at: "2026-07-19T00:00:00Z",
              max_score: 10,
            },
            items: [
              {
                id: "item-1",
                order_index: 1,
                points: 2,
                required: true,
                answer: {},
                question: {
                  id: "question-1",
                  type: "single_choice",
                  prompt_text: "Chọn đáp án đúng",
                  prompt_content: {},
                  options: [
                    { option_key: "a", content: "Đáp án A" },
                    { option_key: "b", content: "Đáp án B" },
                  ],
                },
              },
            ],
          }}
        />
      </ConfirmationProvider>,
    );

    expect(
      screen.getByRole("heading", { name: "Bài luyện nghe", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nghe kỹ trước khi chọn đáp án."),
    ).toBeInTheDocument();
    expect(screen.getByText("10 điểm")).toBeInTheDocument();
    expect(screen.getByText("1 câu")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Câu 1", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 điểm · Bắt buộc")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Đã tải câu trả lời đã lưu",
    );
  });

  it("hiện loading rồi chuyển thẳng sang tab Đã nộp", async () => {
    let resolveSubmit:
      ((value: { ok: true; status: string }) => void) | undefined;
    submitExerciseAttempt.mockReturnValue(
      new Promise((resolve) => {
        resolveSubmit = resolve;
      }),
    );
    const user = userEvent.setup();

    render(
      <ConfirmationProvider>
        <ExerciseAttempt
          payload={{
            attempt: {
              id: "attempt-1",
              status: "in_progress",
              started_at: "2026-07-18T00:00:00Z",
              attempt_no: 1,
            },
            delivery: {
              id: "delivery-1",
              title: "Bài luyện tập",
              instructions: null,
              due_at: "2026-07-19T00:00:00Z",
              max_score: 10,
            },
            items: [],
          }}
        />
      </ConfirmationProvider>,
    );

    await user.click(screen.getAllByRole("button", { name: "Nộp bài" })[0]!);
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Nộp bài" }));

    expect(screen.getAllByText("Đang nộp bài…").length).toBeGreaterThan(0);
    expect(replace).not.toHaveBeenCalled();
    resolveSubmit?.({ ok: true, status: "submitted" });

    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/student/exercises?tab=submitted"),
    );
    expect(saveExerciseAnswer).not.toHaveBeenCalled();
  });
});
