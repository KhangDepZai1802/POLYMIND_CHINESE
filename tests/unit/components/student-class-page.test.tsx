import { render, screen } from "@testing-library/react";
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
});
