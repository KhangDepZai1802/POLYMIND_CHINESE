import { render, screen, within, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/features/b2c/components/weekly-schedule-dialog", () => ({ WeeklyScheduleDialog: () => null }));
vi.mock("@/features/b2c/components/class-student-add-dialog", () => ({
  ClassStudentAddDialog: () => <button>Thêm học viên</button>,
}));
import { ClassWorkspaceContent } from "@/features/b2c/components/class-workspace-content";
import type { ComponentProps } from "react";
vi.mock("@/features/b2c/components/class-workspace-dialogs", () => ({
  ClassMeetingDialog: () => null,
  ClassCommentDialog: () => null,
  ClassAttendanceDialog: () => <button>Điểm danh</button>,
}));
vi.mock("@/features/b2c/components/structured-schedule-dialog", () => ({
  StructuredScheduleDialog: () => null,
}));
vi.mock("@/features/b2c/components/teacher-management-dialogs", () => ({
  TeacherClassManageDialog: () => null,
  TeacherStudentManageDialog: () => null,
}));
vi.mock("@/features/b2c/components/tuition-dialogs", () => ({
  TuitionPackageDialog: () => null,
  TuitionReceiptsDialog: () => null,
}));
type Model = ComponentProps<typeof ClassWorkspaceContent>["model"];
const model: Model = {
  classId: "class-a",
  base: "/teacher/b2c-classes/class-a",
  collector: "GV",
  today: "2026-10-15",
  schedules: [],
  cls: {
    id: "class-a",
    code: "B2C-A",
    name: "Lớp A",
    program_slug: "tieng-anh",
    capacity: 15,
    enrolled_count: 1,
    start_date: null,
    end_date: null,
    delivery_mode: "offline",
    campus: null,
    teacher_name: "GV",
    weekdays_text: null,
    time_text: null,
    notes: null,
  },
  filters: { tab: "attendance", page: 0, q: "" },
  meeting: {
    id: "meeting-a",
    class_id: "class-a",
    teaching_session_id: null,
    starts_at: "2026-10-14T10:00:00+07:00",
    ends_at: "2026-10-14T11:00:00+07:00",
    teacher_name: "GV",
    status: "completed",
    note: "",
    updated_at: "2026-10-14T04:00:00Z",
  },
  result: {
    total: 1,
    stats: { makeup: 1 },
    rows: [
      {
        enrollment_id: "enrollment-a",
        student_id: "student-a",
        student_code: "HV001",
        full_name: "Học viên A",
        phone: null,
        guardian_name: null,
        student_status: "studying",
        enrollment_date: null,
        tuition_end_date: null,
        registered_sessions: null,
        class_name: "Lớp A",
        attendance_id: "attendance-a",
        attendance_status: "makeup",
        attendance_note: "Học bù buổi trước",
        attendance_updated_at: null,
        package_id: null,
        sessions: null,
        unit_price: null,
        discount: null,
        discount_reason: null,
        total_due: null,
        paid_amount: null,
        balance: null,
      },
    ],
  },
};
afterEach(cleanup);
describe("B2C mobile attendance", () => {
  it.each([5, -1, null])("shows per-student attendance totals and remaining %s", (remaining) => {
    const next: Model = { ...model, filters: { tab: "students", page: 0, q: "" }, result: { ...model.result, rows: [{ ...model.result.rows[0], session_summary: { attended: 3, absent: 1, excused: 2, makeup: 1, remaining } } as Model["result"]["rows"][number]] } };
    render(<ClassWorkspaceContent model={next} />);
    expect(screen.getByText("Đã học: 3")).toBeInTheDocument();
    expect(screen.getByText("Nghỉ có phép: 2 · Không phép: 1")).toBeInTheDocument();
    expect(screen.getByText("Học bù: 1 (đã tính trong đã học)")).toBeInTheDocument();
    expect(screen.getByText(remaining === null ? "Còn lại: Chưa xác định" : remaining < 0 ? "Vượt đăng ký: 1" : "Còn lại: 5")).toBeInTheDocument();
  });
  it("shows the student's status, note and attendance action in a mobile card", () => {
    render(
      <ClassWorkspaceContent
        model={model}
        permissions={[
          "view_classes",
          "view_students",
          "view_schedule",
          "mark_attendance",
        ]}
      />,
    );
    const cards = within(screen.getByLabelText("Điểm danh trên điện thoại"));
    expect(cards.getByText("Học viên A")).toBeInTheDocument();
    expect(cards.getByText("Học bù")).toBeInTheDocument();
    expect(cards.getByText("Học bù buổi trước")).toBeInTheDocument();
    expect(
      cards.getByRole("button", { name: "Điểm danh" }),
    ).toBeInTheDocument();
  });
  it.each(["future", "cancelled", "revoked"])(
    "does not offer marking when %s",
    (reason) => {
      const next = { ...model, meeting: { ...model.meeting! } };
      if (reason === "future")
        next.meeting.starts_at = "2026-10-16T10:00:00+07:00";
      if (reason === "cancelled") next.meeting.status = "cancelled";
      render(
        <ClassWorkspaceContent
          model={next}
          permissions={
            reason === "revoked"
              ? ["view_classes", "view_students", "view_schedule"]
              : [
                  "view_classes",
                  "view_students",
                  "view_schedule",
                  "mark_attendance",
                ]
          }
        />,
      );
      expect(
        within(screen.getByLabelText("Điểm danh trên điện thoại")).queryByRole(
          "button",
          { name: "Điểm danh" },
        ),
      ).not.toBeInTheDocument();
    },
  );
});
