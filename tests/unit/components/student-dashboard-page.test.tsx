import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StudentDashboardPage from "@/app/(dashboard)/student/page";
import { getStudentDashboard } from "@/features/dashboard/server/student-queries";
import { requireRole } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/features/dashboard/server/student-queries", () => ({
  getStudentDashboard: vi.fn(),
}));

describe("StudentDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({
      fullName: "Học viên Demo",
    } as never);
  });

  it("ưu tiên hành trình học và giữ đủ dữ liệu, hành động hiện có", async () => {
    vi.mocked(getStudentDashboard).mockResolvedValue({
      enrollment: {
        id: "enrollment-1",
        status: "active",
        class: { id: "class-1", code: "LOP-01", name: "HSK 1" },
      },
      sessions: [
        {
          id: "session-1",
          session_number: 3,
          starts_at: "2099-08-01T12:00:00.000Z",
          ends_at: "2099-08-01T13:30:00.000Z",
          topic: "Chào hỏi",
          status: "scheduled",
        },
      ],
      pendingExercises: [
        {
          id: "exercise-1",
          title: "Luyện nghe bài 3",
          due_at: "2099-08-02T12:00:00.000Z",
          max_score: 10,
          attempts: [],
        },
      ],
      attendance: {
        present_count: 8,
        absent_count: 1,
      },
      results: [
        {
          id: "attempt-1",
          title: "Kiểm tra bài 2",
          kind: "Kỳ thi",
          score: 85,
          maxScore: 100,
          publishedAt: "2026-07-20T12:00:00.000Z",
          href: "/student/exams/results/attempt-1",
        },
      ],
      invoices: [
        {
          invoice_id: "invoice-1",
          invoice_code: "HP-01",
          due_date: "2026-07-01",
          total: 1_000_000,
          balance: 500_000,
          is_overdue: true,
        },
      ],
    } as never);

    render(await StudentDashboardPage());

    expect(requireRole).toHaveBeenCalledWith("student");
    expect(
      screen.getByRole("heading", {
        name: "Xin chào, Học viên Demo",
        level: 1,
      }),
    ).toBeInTheDocument();

    for (const heading of [
      "Buổi học kế tiếp",
      "Bài tập cần nộp (1)",
      "Buổi học sắp tới",
      "Kết quả mới công bố",
    ]) {
      expect(
        screen.getByRole("heading", { name: heading, level: 2 }),
      ).toBeInTheDocument();
    }

    expect(screen.getByText("Luyện nghe bài 3")).toBeInTheDocument();
    expect(screen.getAllByText(/Chào hỏi/)).toHaveLength(2);
    expect(screen.getByText("8 có mặt · 1 vắng")).toBeInTheDocument();
    expect(screen.getByText(/1 hóa đơn quá hạn/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Làm bài" })).toHaveAttribute(
      "href",
      "/student/exercises",
    );
    expect(screen.getByRole("link", { name: "Xem" })).toHaveAttribute(
      "href",
      "/student/exams/results/attempt-1",
    );
  });

  it("giữ empty state rõ ràng khi học viên chưa được xếp lớp", async () => {
    vi.mocked(getStudentDashboard).mockResolvedValue({
      enrollment: null,
    } as never);

    render(await StudentDashboardPage());

    expect(screen.getByText("Bạn chưa được xếp lớp")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Khi trung tâm xếp lớp cho bạn, lịch học và bài tập sẽ hiện ở đây.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Bài chưa nộp")).not.toBeInTheDocument();
  });
});
