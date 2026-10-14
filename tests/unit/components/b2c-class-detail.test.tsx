import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
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
