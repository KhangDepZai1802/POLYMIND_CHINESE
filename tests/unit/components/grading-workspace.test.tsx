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
                question_version: { id: "version-1", question_type: "essay_translation", prompt_text: "Dịch câu sau", options: [] },
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

  it("hiện cả audio đề và bản ghi Nói của học viên", () => {
    const { container } = render(
      <GradingWorkspace
        kind="exam"
        delivery={{
          id: "delivery-audio",
          title: "Bài thi nghe nói",
          status: "closed",
          class: { code: "HSK2", name: "Lớp nghe nói" },
          attempts: [{
            id: "attempt-audio",
            status: "pending_manual_grading",
            submitted_at: "2026-07-18T06:00:00Z",
            raw_score: 0,
            final_score_100: 0,
            enrollment: { student: { student_code: "HV002", full_name: "Trần Bình" } },
            answers: [
              {
                id: "answer-listening",
                answer_payload: { value: "1" },
                prompt_audio_url: "https://signed.test/question.mp3",
                auto_score: 2,
                manual_score: null,
                final_score: 2,
                feedback: null,
                override_reason: null,
                item: {
                  points: 2,
                  order_index: 1,
                  question_version: {
                    id: "version-listening",
                    question_type: "listening_choice",
                    prompt_text: "Nghe và chọn",
                    options: [{ option_key: "1", content: "Đáp án một" }],
                  },
                },
              },
              {
                id: "answer-speaking",
                answer_payload: { audio_path: "student/answer.webm" },
                audio_url: "https://signed.test/answer.webm",
                auto_score: null,
                manual_score: null,
                final_score: null,
                feedback: null,
                override_reason: null,
                item: {
                  points: 3,
                  order_index: 2,
                  question_version: {
                    id: "version-speaking",
                    question_type: "speaking",
                    prompt_text: "Đọc câu sau",
                    options: [],
                  },
                },
              },
            ],
          }],
        }}
      />,
    );

    expect(screen.getByText("Audio đề bài")).toBeInTheDocument();
    expect(screen.getByText("Bản ghi âm học viên đã nộp")).toBeInTheDocument();
    expect(container.querySelectorAll("audio")).toHaveLength(2);
  });
});
