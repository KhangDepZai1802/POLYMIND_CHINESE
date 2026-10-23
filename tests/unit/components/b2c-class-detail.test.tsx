import {
  fireEvent,
  render,
  screen,
  within,
  waitFor,
  act,
} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
vi.mock("@/features/b2c/server/monthly-comment-actions", () => ({ readMonthlyCommentsAction: vi.fn(), readMonthlyCommentDetailAction: vi.fn(), saveMonthlyCommentAction: vi.fn(), confirmMonthlyCommentDeliveryAction: vi.fn() }));
vi.mock("@/features/b2c/server/assessment-actions", () => ({ readB2CAssessmentsAction: vi.fn(), readB2CAssessmentHistoryAction: vi.fn(), saveB2CAssessmentAction: vi.fn() }));
vi.mock("@/features/b2c/server/enrollment-lifecycle-actions", () => ({
  readEnrollmentLifecycleAction: vi.fn(), saveEnrollmentLifecycleAction: vi.fn(),
}));
vi.mock("@/features/b2c/components/weekly-schedule-dialog", () => ({ WeeklyScheduleDialog: () => null }));
vi.mock("@/features/b2c/components/class-student-add-dialog", () => ({
  ClassStudentAddDialog: () => <button>Thêm học viên</button>,
}));
vi.mock("@/features/b2c/components/teacher-management-dialogs", () => ({
  TeacherClassManageDialog: () => <button>Sửa thông tin lớp</button>,
  TeacherStudentManageDialog: () => null,
}));
import { readClassWorkspaceAction } from "@/features/b2c/server/class-workspace-read";
vi.mock("@/features/b2c/server/class-workspace-read", () => ({
  readClassWorkspaceAction: vi.fn(),
}));
vi.mock("@/features/b2c/server/teacher-management-actions", () => ({
  readTeacherClassEditAction: vi.fn(), readTeacherStudentEditAction: vi.fn(),
  saveTeacherClassAction: vi.fn(), saveTeacherStudentAction: vi.fn(),
}));
vi.mock("@/features/b2c/components/class-workspace-dialogs", () => ({
  ClassMeetingDialog: () => null,
  ClassAttendanceDialog: () => null,
  ClassCommentDialog: () => null,
}));
vi.mock("@/features/b2c/components/tuition-dialogs", () => ({
  TuitionPackageDialog: () => null,
  TuitionReceiptsDialog: () => null,
}));
vi.mock("@/features/b2c/components/structured-schedule-dialog", () => ({
  StructuredScheduleDialog: () => null,
}));
import {
  B2CProgramWorkspace,
  type ClassRow,
  type StudentRow,
} from "@/features/b2c/components/program-workspace";
vi.mock("@/features/b2c/components/class-form-dialog", () => ({
  B2CClassFormDialog: () => null,
}));
vi.mock("@/features/b2c/components/student-status-dialog", () => ({
  B2CStudentStatusDialog: () => null,
}));
const first: ClassRow = {
  id: "class-a",
  code: "B2C-A",
  name: "Lớp A",
  program_slug: "tieng-anh",
  capacity: 15,
  enrolled_count: 1,
  status: "active",
  start_date: "2026-10-01",
  end_date: null,
  delivery_mode: "offline",
  campus: null,
  level_name: "A1",
  teacher_name: "Cô Tú",
  weekdays_text: "T2-T4",
  time_text: "18h-19h30",
  notes: "Ghi chú lớp A",
};
function student(
  classCode: string,
  fullName: string,
  index: number,
): StudentRow {
  return {
    id: String(index),
    studentId: String(index),
    studentCode: `HV-${index}`,
    classCode,
    className: classCode,
    programSlug: "tieng-anh",
    fullName,
    studentStatus: "studying",
    customerSource: null,
    referrerName: null,
    learningGoal: null,
    certificateGoal: null,
    withdrawalReason: null,
    dateOfBirth: null,
    birthYear: null,
    guardianName: "Phụ huynh A",
    email: null,
    address: null,
    phone: "0901234567",
    enrollmentDate: "2026-10-01",
    paymentDate: null,
    learningStartDate: null,
    tuitionEndDate: "2026-12-01",
    registeredSessions: 24,
    sessionsPerWeek: 2,
    salesperson: null,
    notes: null,
  };
}
function setup(
  students = [
    student("B2C-A", "Học viên A", 1),
    student("B2C-B", "Học viên B", 2),
  ],
) {
  render(
    <B2CProgramWorkspace
      program={{ slug: "tieng-anh", title: "Tiếng Anh", description: "" }}
      classes={[
        first,
        { ...first, id: "class-b", code: "B2C-B", name: "Lớp B" },
      ]}
      students={students}
    />,
  );
}
describe("B2C class details", () => {
  it("keeps search, pagination and links inside the popup", async () => {
    vi.mocked(readClassWorkspaceAction).mockImplementation(
      async (classId, filters) => ({
        classId,
        base: `/admin/b2c/classes/${classId}`,
        cls: { ...first, notes: null },
        schedules: [],
        result: { rows: [], total: 26, stats: null },
        meeting: null,
        today: "2026-10-15",
        collector: "Quản lý",
        filters: {
          tab: filters.tab as "attendance",
          page: Number(filters.page ?? 0),
          q: String(filters.q ?? ""),
        },
      }),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Lớp A" }));
    const dialog = within(screen.getByRole("dialog"));
    const url = window.location.href;
    fireEvent.click(dialog.getByRole("button", { name: "Điểm danh" }));
    await dialog.findByRole("link", { name: "Chọn buổi học theo ngày" });
    fireEvent.change(dialog.getByLabelText("Tìm học viên của lớp"), {
      target: { value: "HV-1" },
    });
    fireEvent.submit(
      dialog.getByRole("button", { name: "Tìm" }).closest("form")!,
    );
    await waitFor(() =>
      expect(readClassWorkspaceAction).toHaveBeenLastCalledWith("class-a", {
        tab: "attendance",
        q: "HV-1",
      }),
    );
    fireEvent.click(await dialog.findByRole("link", { name: "Trang sau" }));
    await waitFor(() =>
      expect(readClassWorkspaceAction).toHaveBeenLastCalledWith("class-a", {
        tab: "attendance",
        q: "HV-1",
        page: "1",
      }),
    );
    fireEvent.click(await dialog.findByRole("link", { name: "Chọn buổi học theo ngày" }));
    await waitFor(() =>
      expect(readClassWorkspaceAction).toHaveBeenLastCalledWith("class-a", {
        tab: "schedule",
        q: "HV-1",
        page: "0",
      }),
    );
    expect(window.location.href).toBe(url);
  });
  it("ignores a delayed tab response after returning to students", async () => {
    let resolve!: (
      value: Awaited<ReturnType<typeof readClassWorkspaceAction>>,
    ) => void;
    vi.mocked(readClassWorkspaceAction).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Lớp A" }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: "Lịch học" }));
    expect(dialog.getByRole("status")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Học viên" }));
    await act(async () =>
      resolve({
        classId: first.id,
        base: `/admin/b2c/classes/${first.id}`,
        cls: { ...first, notes: null },
        schedules: [],
        result: { rows: [], total: 0, stats: null },
        meeting: null,
        today: "2026-10-15",
        collector: "Quản lý",
        filters: { tab: "schedule", page: 0, q: "" },
      }),
    );
    expect(dialog.getByText("Học viên A")).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Học viên" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("switches all workspace sections inside the same dialog and returns to the roster", async () => {
    vi.mocked(readClassWorkspaceAction).mockImplementation(
      async (classId, filters) => ({
        classId,
        base: `/admin/b2c/classes/${classId}`,
        cls: { ...first, notes: null },
        schedules: [],
        result: { rows: [], total: 0, stats: null },
        meeting: null,
        today: "2026-10-15",
        filters: { tab: filters.tab as "schedule", page: 0, q: "" },
        collector: "Quản lý",
      }),
    );
    setup();
    fireEvent.click(screen.getByText("B2C-A"));
    const dialog = screen.getByRole("dialog");
    const url = window.location.href;
    for (const label of ["Lịch học", "Điểm danh", "Học phí", "Nhận xét"]) {
      fireEvent.click(within(dialog).getByRole("button", { name: label }));
      await waitFor(() =>
        expect(within(dialog).queryByRole("status")).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("dialog")).toBe(dialog);
      expect(
        within(dialog).getByRole("button", { name: label }),
      ).toHaveAttribute("aria-pressed", "true");
      expect(window.location.href).toBe(url);
    }
    fireEvent.click(within(dialog).getByRole("button", { name: "Học viên" }));
    expect(within(dialog).getByText("Học viên A")).toBeInTheDocument();
    expect(within(dialog).queryByText("Học viên B")).not.toBeInTheDocument();
  });
  it("shows load errors inside the popup and allows retry", async () => {
    vi.mocked(readClassWorkspaceAction).mockRejectedValue(new Error("offline"));
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Lớp A" }));
    const dialog = within(screen.getByRole("dialog"));
    fireEvent.click(dialog.getByRole("button", { name: "Lịch học" }));
    expect(await dialog.findByRole("alert")).toHaveTextContent(
      "Không tải được nội dung lớp",
    );
    const calls = vi.mocked(readClassWorkspaceAction).mock.calls.length;
    fireEvent.click(dialog.getByRole("button", { name: "Thử lại" }));
    await waitFor(() =>
      expect(readClassWorkspaceAction).toHaveBeenCalledTimes(calls + 1),
    );
    fireEvent.click(dialog.getByRole("button", { name: "Học viên" }));
    expect(dialog.getByText("Học viên A")).toBeInTheDocument();
  });
  it("opens from name and eye and only shows the selected class roster", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Lớp A" }));
    const d = screen.getByRole("dialog");
    expect(within(d).getByText("Học viên A")).toBeInTheDocument();
    expect(within(d).queryByText("Học viên B")).not.toBeInTheDocument();
    expect(within(d).getByText("Ghi chú lớp A")).toBeInTheDocument();
    fireEvent.click(within(d).getByRole("button", { name: "Close" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Xem chi tiết lớp Lớp B" }),
    );
    expect(
      within(screen.getByRole("dialog")).getByText("Học viên B"),
    ).toBeInTheDocument();
  });
  it("paginates and searches the class roster without mixing other classes", () => {
    setup(
      Array.from({ length: 21 }, (_, i) =>
        student("B2C-A", `Học viên ${i + 1}`, i + 1),
      ),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Xem chi tiết lớp Lớp A" }),
    );
    const d = within(screen.getByRole("dialog"));
    expect(d.queryByText("Học viên 21")).not.toBeInTheDocument();
    fireEvent.click(d.getByRole("button", { name: "Sau" }));
    expect(d.getByText("Học viên 21")).toBeInTheDocument();
    fireEvent.change(d.getByLabelText("Tìm học viên trong lớp"), {
      target: { value: "HV-1" },
    });
    expect(d.getByText("Học viên 1")).toBeInTheDocument();
    expect(d.queryByText("Học viên 21")).not.toBeInTheDocument();
  });
});
