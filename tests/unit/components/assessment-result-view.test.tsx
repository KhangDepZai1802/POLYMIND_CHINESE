import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AssessmentResultView } from "@/features/assessment-results/components/result-view";

describe("AssessmentResultView", () => {
  it("trình bày kết quả bằng nội dung dễ đọc, không lộ JSON hoặc trạng thái kỹ thuật", () => {
    render(
      <AssessmentResultView
        kind="exercise"
        result={{
          status: "graded",
          raw_score: 2,
          final_score: 8,
          max_score: 10,
          published_at: "2026-07-18T06:47:00Z",
          answers: [{
            set_item_id: "item-1",
            order_index: 1,
            points: 2,
            question_type: "multiple_choice",
            prompt_text: "Chọn các số đúng",
            options: [
              { option_key: "1", content: "Một" },
              { option_key: "2", content: "Hai" },
              { option_key: "3", content: "Ba" },
            ],
            answer: { values: ["2"] },
            score: 1,
            feedback: "Em cần chọn thêm một đáp án.",
            answer_key: { values: ["1", "2", "3"] },
            explanation: "Đây là ba đáp án đúng.",
          }],
        }}
      />,
    );

    expect(screen.getByText("Đã công bố kết quả")).toBeInTheDocument();
    expect(screen.getByText("Chọn các số đúng")).toBeInTheDocument();
    expect(screen.getByText("Hai")).toBeInTheDocument();
    expect(screen.getByText("Một; Hai; Ba")).toBeInTheDocument();
    expect(screen.getByText("Nhận xét của giáo viên")).toBeInTheDocument();
    expect(screen.queryByText("graded")).not.toBeInTheDocument();
    expect(screen.queryByText(/"values"/)).not.toBeInTheDocument();
  });

  it("hiện audio đề và bản ghi Nói trong kết quả đã công bố", () => {
    const { container } = render(
      <AssessmentResultView
        kind="exam"
        result={{
          status: "graded",
          raw_score: 8,
          final_score: 80,
          max_score: 100,
          published_at: "2026-07-18T06:47:00Z",
          answers: [
            {
              set_item_id: "item-listening",
              question_version_id: "version-listening",
              order_index: 1,
              points: 2,
              question_type: "listening_choice",
              prompt_text: "Nghe và chọn đáp án",
              prompt_audio_url: "https://signed.test/question.mp3",
              answer: { value: "1" },
              score: 2,
              feedback: null,
              answer_key: null,
              explanation: null,
            },
            {
              set_item_id: "item-speaking",
              question_version_id: "version-speaking",
              order_index: 2,
              points: 3,
              question_type: "speaking",
              prompt_text: "Đọc câu sau",
              answer: { audio_path: "student/answer.webm" },
              audio_url: "https://signed.test/answer.webm",
              score: 3,
              feedback: null,
              answer_key: null,
              explanation: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Audio đề bài")).toBeInTheDocument();
    expect(screen.getByText("Bản ghi âm đã nộp")).toBeInTheDocument();
    expect(container.querySelectorAll("audio")).toHaveLength(2);
  });
});
