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
