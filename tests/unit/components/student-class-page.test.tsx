import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StudentClassPage from "@/app/(dashboard)/student/class/page";
import { getStudentAssessmentOverview } from "@/features/assessment-results/server/overview";
import {
  getMyAttendanceSummary,
  getMyClassOverview,
  getMyEnrollment,
  getMyMaterials,
  getMyProgress,
  getMySchedule,
} from "@/features/student/server/queries";
import { requireRole } from "@/lib/auth/session";
import { readB2CHomeworkAction } from "@/features/b2c/server/homework-actions";

vi.mock("@/features/b2c/server/homework-actions", () => ({ readB2CHomeworkAction: vi.fn() }));

vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/features/assessment-results/server/overview", () => ({
  getStudentAssessmentOverview: vi.fn(),
}));
vi.mock("@/features/student/server/queries", () => ({
  getMyAttendanceSummary: vi.fn(),
  getMyClassOverview: vi.fn(),
  getMyEnrollment: vi.fn(),
  getMyMaterials: vi.fn(),
  getMyProgress: vi.fn(),
  getMySchedule: vi.fn(),
}));
vi.mock("@/features/schedules/components/schedule-manager", () => ({
  SessionCalendar: () => <div>Lịch buổi học</div>,
}));
vi.mock("@/features/student/components/material-list", () => ({
  MaterialList: () => <div>Tài liệu lớp</div>,
}));

describe("StudentClassPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readB2CHomeworkAction).mockResolvedValue({ linked_student: null } as never);
    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    vi.mocked(getMyEnrollment).mockResolvedValue({
      id: "enrollment-1",
      status: "active",
      class: {
        id: "class-1",
        code: "LOP-01",
        name: "Lớp thử nghiệm",
        course: { id: "course-1", code: "KH-01", title: "HSK 1" },
      },
    } as never);
    vi.mocked(getMyClassOverview).mockResolvedValue({
      id: "class-1",
      code: "LOP-01",
      name: "Lớp thử nghiệm",
      capacity: 20,
      status: "active",
      start_date: "2026-07-01",
      expected_end_date: "2026-12-01",
      planned_session_count: 35,
      session_duration_minutes: 90,
      target_audience: "Học viên HSK 1",
      delivery_mode: "offline",
      location_name: "POLYMIND",
      address: "TP. Hồ Chí Minh",
      location_note: null,
      meeting_url: null,
      course: { id: "course-1", code: "KH-01", title: "HSK 1" },
      class_teachers: {
        id: "assignment-1",
        teacher: {
          id: "teacher-1",
          teacher_code: "GV000001",
          specialization: "HSK",
          profile: { full_name: "Giáo viên Demo" },
        },
      },
      class_schedules: [],
    } as never);
    vi.mocked(getMySchedule).mockResolvedValue([]);
    vi.mocked(getMyMaterials).mockResolvedValue([]);
    vi.mocked(getMyAttendanceSummary).mockResolvedValue(null);
    vi.mocked(getMyProgress).mockResolvedValue({
      total_lessons: 10,
      completed_lessons: 2,
      total_exercises: 4,
      submitted_exercises: 1,
      avg_score: 80,
      attendance_rate: 100,
      progress_percent: 42,
      is_completion_ready: false,
    } as never);
    vi.mocked(getStudentAssessmentOverview).mockResolvedValue({
      exercises: [],
      exams: [],
    });
  });

  it("hiển thị 7 tab chỉ đọc và giáo viên phụ trách của lớp hiện tại", async () => {
    render(await StudentClassPage());

    expect(requireRole).toHaveBeenCalledWith("student");
    expect(getMyClassOverview).toHaveBeenCalledWith("class-1");
    expect(screen.getByText("Giáo viên Demo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Thông tin lớp", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Địa điểm học", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Giáo viên phụ trách", level: 2 }),
    ).toBeInTheDocument();

    for (const tab of [
      "Tổng quan",
      "Lịch/Buổi",
      "Bài tập",
      "Kiểm tra",
      "Tiến độ",
      "Chuyên cần",
      "Tài liệu",
    ]) {
      expect(screen.getByRole("tab", { name: tab })).toBeInTheDocument();
    }

    expect(screen.queryByText(/danh sách học viên/i)).not.toBeInTheDocument();
  });

  it("giữ điều hướng bàn phím/click qua các nhóm nội dung read-only", async () => {
    const user = userEvent.setup();
    render(await StudentClassPage());

    await user.click(screen.getByRole("tab", { name: "Lịch/Buổi" }));
    expect(
      screen.getByRole("heading", { name: "Lịch học lặp", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Danh sách buổi học (0)",
        level: 2,
      }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Tiến độ" }));
    expect(
      screen.getByRole("heading", { name: "Tiến độ của bạn", level: 2 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Chuyên cần" }));
    expect(
      screen.getByRole("heading", { name: "Chuyên cần", level: 2 }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Tài liệu" }));
    expect(
      screen.getByRole("heading", { name: "Tài liệu", level: 2 }),
    ).toBeInTheDocument();
  });

  it("hiển thị lớp trung tâm thay vì chuyển học viên B2C sang trang khác", async () => {
    vi.mocked(getMyEnrollment).mockResolvedValue(null);
    vi.mocked(readB2CHomeworkAction).mockResolvedValue({
      rows: [],
      total: 0,
      class: null,
      schedules: [],
      linked_student: { id: "student-b2c-1", full_name: "Lê Huỳnh Gia Hân" },
      classes: [
        {
          id: "class-b2c-1",
          code: "LMU-01",
          name: "Let's Move Up",
        },
      ],
      server_now: "2026-11-27T10:00:00.000Z",
    });

    render(await StudentClassPage());

    expect(screen.getByRole("heading", { name: "Let's Move Up" })).toBeInTheDocument();
    expect(screen.getByText("LMU-01 · Let's Move Up")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /xem bài tập của lớp/i }),
    ).toHaveAttribute("href", "/student/b2c-homework");
    expect(getMyClassOverview).not.toHaveBeenCalled();
  });
});
