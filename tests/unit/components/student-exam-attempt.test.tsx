import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/features/exams/server/actions", () => ({
  createExamSpeakingUploadUrl: vi.fn(),
  deleteExamSpeakingAnswer: vi.fn(),
  saveExamAnswer: vi.fn(),
  submitExamAttempt: vi.fn(),
  uploadExamSpeakingAnswer: vi.fn(),
}));
vi.mock("@/features/exams/integrity/exam-integrity-boundary", () => ({
  ExamIntegrityBoundary: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="integrity-boundary">{children}</div>
  ),
}));

import { ConfirmationProvider } from "@/components/shared/confirmation-provider";
import { ExamAttempt } from "@/features/exams/student/exam-attempt";

describe("ExamAttempt layout", () => {
  it("giữ integrity wrapper và trình bày context, timer, heading câu hỏi", () => {
    const { unmount } = render(
      <ConfirmationProvider>
        <ExamAttempt
          payload={{
            attempt: {
              id: "attempt-exam",
              status: "in_progress",
              started_at: "2026-07-22T00:00:00Z",
              server_time: "2026-07-22T00:00:00Z",
              deadline_at: "2026-07-22T00:10:00Z",
            },
            delivery: {
              id: "delivery-exam",
              title: "Kiểm tra từ vựng",
              closes_at: "2026-07-22T01:00:00Z",
              duration_minutes: 10,
            },
            items: [
              {
                id: "item-exam",
                order_index: 0,
                points: 10,
                answer: {},
                question: {
                  id: "question-exam",
                  type: "single_choice",
                  prompt_text: "学习 nghĩa là gì?",
                  prompt_content: {},
                  options: [
                    { option_key: "a", content: "Học tập" },
                    { option_key: "b", content: "Làm việc" },
                  ],
                },
              },
            ],
          }}
        />
      </ConfirmationProvider>,
    );

    expect(screen.getByTestId("integrity-boundary")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Kiểm tra từ vựng", level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveAccessibleName(
      "Thời gian còn lại 10 phút 0 giây",
    );
    expect(
      screen.getByRole("heading", { name: "Câu 1", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Đã tải dữ liệu");
    unmount();
  });
});
