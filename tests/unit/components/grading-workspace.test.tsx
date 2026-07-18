import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/exercises/server/actions", () => ({
  gradeExerciseAnswersBulkAction: vi.fn(),
  publishExerciseResultsAction: vi.fn(),
}));
vi.mock("@/features/exams/server/actions", () => ({
  gradeExamAnswersBulkAction: vi.fn(),
  lockExamResultsAction: vi.fn(),
  publishExamResultsAction: vi.fn(),
  runExamRegradeAction: vi.fn(),
}));

import { GradingWorkspace } from "@/features/assessment-results/components/grading-workspace";

describe("GradingWorkspace", () => {
  it("để câu chưa chấm trống và chỉ có một nút lưu toàn bộ", () => {
    render(
      <GradingWorkspace
        kind="exercise"
        delivery={{
          id: "delivery-1",
          title: "Bài tập cuối tuần",
          status: "published",
          class: { code: "HSK1", name: "Lớp căn bản" },
          attempts: [{
            id: "attempt-1",
            status: "pending_manual_grading",
            submitted_at: "2026-07-18T06:00:00Z",
            raw_score: 0,
            final_score: 0,
            enrollment: { student: { student_code: "HV001", full_name: "Nguyễn An" } },
            answers: [{
              id: "answer-1",
              answer_payload: { value: "你好" },
              auto_score: null,
              manual_score: null,
              final_score: null,
              feedback: null,
              override_reason: null,
              item: {
                points: 2,
                order_index: 1,
                question_version: { question_type: "essay_translation", prompt_text: "Dịch câu sau", options: [] },
              },
            }],
          }],
        }}
      />,
    );

    expect(screen.getByPlaceholderText("Chưa chấm")).toHaveValue(null);
    expect(screen.getAllByRole("button", { name: "Lưu tất cả điểm đã nhập" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Lưu điểm câu/ })).not.toBeInTheDocument();
    expect(screen.getAllByText(/chưa chấm/i).length).toBeGreaterThan(0);
    expect(screen.getByText("你好")).toBeInTheDocument();
    expect(screen.queryByText(/"value"/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Feedback|override|integrity/i)).not.toBeInTheDocument();
  });
});
