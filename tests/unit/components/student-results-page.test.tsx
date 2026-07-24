import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StudentResultsPage from "@/app/(dashboard)/student/results/page";
import { getMyEnrollment } from "@/features/student/server/queries";
import { getMyResults } from "@/features/student/server/result-queries";
import { requireRole } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/features/student/server/queries", () => ({
  getMyEnrollment: vi.fn(),
}));
vi.mock("@/features/student/server/result-queries", () => ({
  getMyResults: vi.fn(),
}));

const progress = {
  total_lessons: 20,
  completed_lessons: 12,
  total_exercises: 8,
  submitted_exercises: 6,
  avg_score: 8.5,
  attendance_rate: 92,
  progress_percent: 60,
  is_completion_ready: false,
};

function renderPage(tab?: string) {
  return StudentResultsPage({ searchParams: Promise.resolve({ tab }) });
}

describe("StudentResultsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    vi.mocked(getMyEnrollment).mockResolvedValue({
      id: "enrollment-1",
      class: { id: "class-1" },
    } as never);
    vi.mocked(getMyResults).mockResolvedValue({
      results: [
        {
          id: "attempt-1",
          title: "Kiểm tra giữa khóa",
          kind: "Kỳ thi",
          score: 75,
          maxScore: 100,
          publishedAt: "2026-07-10T00:00:00Z",
          href: "/student/exams/results/attempt-1",
        },
      ],
      evaluations: [],
      notes: [],
      progress,
    } as never);
  });

  it("khóa role học viên và hiện chuyên cần — dữ liệu trước đây bị truy vấn rồi bỏ không", async () => {
    render(await renderPage());

    expect(requireRole).toHaveBeenCalledWith("student");
    expect(getMyResults).toHaveBeenCalledWith("enrollment-1");
    expect(screen.getAllByText("Chuyên cần").length).toBeGreaterThan(0);
    expect(screen.getAllByText("92%").length).toBeGreaterThan(0);
  });

  it("mỗi khu vực có heading cấp 2 thật để trình đọc màn hình nhảy được", async () => {
    render(await renderPage());

    expect(
      screen.getByRole("heading", { name: "Tổng quan học tập", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Điểm đã công bố", level: 2 }),
    ).toBeInTheDocument();
  });

  it("điểm có thanh tỉ lệ với aria đúng và link chi tiết bấm được", async () => {
    render(await renderPage());

    const bar = screen.getByRole("progressbar", {
      name: "Tỉ lệ điểm của Kiểm tra giữa khóa",
    });
    expect(bar).toHaveAttribute("aria-valuenow", "75");
    expect(bar).toHaveAttribute("aria-valuetext", "75 trên 100 điểm");
    expect(
      screen.getByRole("link", {
        name: "Xem chi tiết điểm, feedback và đáp án",
      }),
    ).toHaveAttribute("href", "/student/exams/results/attempt-1");
  });

  it("không vẽ thanh tỉ lệ khi không có thang điểm để so — tránh chia cho 0", async () => {
    vi.mocked(getMyResults).mockResolvedValue({
      results: [
        {
          id: "attempt-2",
          title: "Bài tập không thang điểm",
          kind: "Bài tập",
          score: 5,
          maxScore: 0,
          publishedAt: "2026-07-11T00:00:00Z",
          href: "/student/exercises/results/attempt-2",
        },
      ],
      evaluations: [],
      notes: [],
      progress,
    } as never);

    render(await renderPage());

    expect(
      screen.queryByRole("progressbar", {
        name: "Tỉ lệ điểm của Bài tập không thang điểm",
      }),
    ).not.toBeInTheDocument();
  });

  it("tab Tiến độ có thanh tiến độ khóa học kẹp đúng 0–100", async () => {
    render(await renderPage("progress"));

    const bar = screen.getByRole("progressbar", {
      name: "Tiến độ khóa học",
    });
    expect(bar).toHaveAttribute("aria-valuenow", "60");
    expect(bar).toHaveAttribute("aria-valuetext", "60% tiến độ khóa học");
  });

  it("điểm trung bình luôn kèm thang 100 vì view đã quy đổi sẵn", async () => {
    render(await renderPage());

    // Không được in "8,5" trần: ngay bên dưới là thẻ điểm dạng `8/10`, số trần
    // sẽ bị đọc nhầm là điểm trên thang 10.
    expect(screen.getByText("8,5/100")).toBeInTheDocument();
  });

  it("chưa xếp lớp thì không gọi truy vấn kết quả", async () => {
    vi.mocked(getMyEnrollment).mockResolvedValue(null as never);

    render(await renderPage());

    expect(getMyResults).not.toHaveBeenCalled();
    expect(screen.getByText("Bạn chưa được xếp lớp")).toBeInTheDocument();
  });
});
