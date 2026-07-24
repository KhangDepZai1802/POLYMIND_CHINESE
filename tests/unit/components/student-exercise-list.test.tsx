import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StudentExerciseList } from "@/features/exercises/student/exercise-list";

vi.mock("@/features/exercises/server/actions", () => ({
  startExerciseAction: vi.fn(),
}));

const future = new Date(Date.now() + 86_400_000).toISOString();
const past = new Date(Date.now() - 86_400_000).toISOString();

const deliveries = [
  delivery("todo", "Bài cần làm", future),
  delivery("doing", "Bài đang làm", future, [
    attempt("attempt-doing", "in_progress"),
  ]),
  delivery("submitted", "Bài chờ chấm", future, [
    { ...attempt("attempt-submitted", "submitted"), submitted_at: past },
  ]),
  delivery("graded", "Bài có kết quả", future, [
    {
      ...attempt("attempt-graded", "graded"),
      submitted_at: past,
      final_score: 8,
      results_published_at: past,
    },
  ]),
  delivery("overdue", "Bài quá hạn", past),
];

describe("StudentExerciseList", () => {
  it("hiển thị tổng quan thật và giữ đúng hành động của từng nhóm", async () => {
    const user = userEvent.setup();
    render(<StudentExerciseList deliveries={deliveries} />);

    expect(
      screen.getByRole("heading", { name: "Tổng quan bài tập", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 cần làm · 1 quá hạn")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Bài cần làm", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Bắt đầu làm/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /Đang làm/ }));
    expect(screen.getByRole("link", { name: /Tiếp tục làm/ })).toHaveAttribute(
      "href",
      "/student/exercises/doing/attempt/attempt-doing",
    );

    await user.click(screen.getByRole("tab", { name: /Đã nộp/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Đã nộp — chờ chấm");

    await user.click(screen.getByRole("tab", { name: /Đã chấm/ }));
    expect(screen.getByText("Điểm: 8/10")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Xem kết quả/ })).toHaveAttribute(
      "href",
      "/student/exercises/results/attempt-graded",
    );
  });

  it("dùng manual activation để phím mũi tên chỉ dời focus", async () => {
    const user = userEvent.setup();
    render(<StudentExerciseList deliveries={deliveries} />);

    const todo = screen.getByRole("tab", { name: /Cần làm/ });
    const doing = screen.getByRole("tab", { name: /Đang làm/ });
    await user.click(todo);
    await user.keyboard("{ArrowRight}");

    expect(doing).toHaveFocus();
    expect(todo).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", { name: "Bài cần làm", level: 2 }),
    ).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(doing).toHaveAttribute("aria-selected", "true");
    expect(
      screen.getByRole("heading", { name: "Bài đang làm", level: 2 }),
    ).toBeInTheDocument();
  });
});

function delivery(
  id: string,
  title: string,
  dueAt: string,
  attempts: ReturnType<typeof attempt>[] = [],
) {
  return {
    id,
    title,
    instructions: null,
    status: "published",
    available_from: past,
    due_at: dueAt,
    max_score: 10,
    attempt_limit: 1,
    allow_late_submission: true,
    class: { code: "LOP-02", name: "Tiếng Trung ngân hàng" },
    attempts,
  };
}

function attempt(id: string, status: string) {
  return {
    id,
    attempt_no: 1,
    status,
    started_at: past,
    submitted_at: null as string | null,
    final_score: null as number | null,
    results_published_at: null as string | null,
  };
}
