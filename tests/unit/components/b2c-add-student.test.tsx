import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  add: vi.fn(),
  find: vi.fn(),
  refresh: vi.fn(),
  added: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/b2c/server/enrollment-actions", () => ({
  addB2CClassStudentAction: mocks.add,
  findB2CEnrollmentStudentsAction: mocks.find,
}));
import { ClassStudentAddDialog } from "@/features/b2c/components/class-student-add-dialog";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.add.mockResolvedValue({ success: "Đã thêm học viên vào lớp." });
  mocks.find.mockResolvedValue({
    total: 1,
    rows: [
      {
        id: "existing",
        code: "B2C-HV000001",
        full_name: "Học viên có sẵn",
        phone: "0901234567",
        guardian_name: "Phụ huynh",
        date_of_birth: "2016-01-01",
      },
    ],
  });
});
afterEach(cleanup);
function open() {
  render(
    <ClassStudentAddDialog
      classId="class-a"
      className="Lớp A"
      today="2026-10-16"
      onAdded={mocks.added}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Thêm học viên" }));
}
function fillEnrollment() {
  fireEvent.change(screen.getByLabelText("Người chốt *"), {
    target: { value: "Tư vấn A" },
  });
}
describe("add B2C student in class", () => {
  it("offers optional parent Zalo in the new student form", async () => {
    open();
    fillEnrollment();
    const input = screen.getByLabelText("Số Zalo phụ huynh");
    expect(input).not.toBeRequired();
    fireEvent.change(input, { target: { value: "0912345678" } });
    fireEvent.change(screen.getByLabelText("Họ tên học viên *"), {
      target: { value: "Học viên mới" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu học viên vào lớp" }),
    );
    await waitFor(() => expect(mocks.add).toHaveBeenCalledOnce());
    const payload = mocks.add.mock.calls[0]?.[0] as FormData;
    expect(payload.get("guardian_zalo")).toBe("0912345678");
  });
  it("supports choosing a class from the central student page", async () => {
    render(
      <ClassStudentAddDialog
        today="2026-10-16"
        classes={[
          { id: "class-a", code: "A", name: "Lớp A", status: "active" },
          { id: "closed", code: "B", name: "Lớp đã hủy", status: "cancelled" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Thêm học viên" }));
    expect(
      screen.getByRole("button", { name: "Lưu học viên vào lớp" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("option", { name: /Lớp đã hủy/ }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lớp ghi danh *"), {
      target: { value: "class-a" },
    });
    fillEnrollment();
    fireEvent.change(screen.getByLabelText("Họ tên học viên *"), {
      target: { value: "Học viên mới" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu học viên vào lớp" }),
    );
    await waitFor(() => expect(mocks.add).toHaveBeenCalledOnce());
    const payload = mocks.add.mock.calls[0]?.[0] as FormData;
    expect(payload.get("class_id")).toBe("class-a");
  });
  it("clears the selected existing student when the target class changes", async () => {
    render(
      <ClassStudentAddDialog
        today="2026-10-16"
        classes={[
          { id: "class-a", code: "A", name: "Lớp A", status: "active" },
          { id: "class-b", code: "B", name: "Lớp B", status: "active" },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Thêm học viên" }));
    fireEvent.change(screen.getByLabelText("Lớp ghi danh *"), {
      target: { value: "class-a" },
    });
    fireEvent.change(screen.getByLabelText("Cách thêm học viên"), {
      target: { value: "existing" },
    });
    await screen.findByRole("radio");
    fireEvent.click(screen.getByRole("radio"));
    fireEvent.change(screen.getByLabelText("Lớp ghi danh *"), {
      target: { value: "class-b" },
    });
    await waitFor(() =>
      expect(mocks.find).toHaveBeenLastCalledWith("class-b", "", 0),
    );
    expect(
      screen.getByRole("button", { name: "Lưu học viên vào lớp" }),
    ).toBeDisabled();
  });
  it("creates a profile and enrollment with target class and default date", async () => {
    open();
    fillEnrollment();
    fireEvent.change(screen.getByLabelText("Họ tên học viên *"), {
      target: { value: "Học viên mới" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu học viên vào lớp" }),
    );
    await waitFor(() => expect(mocks.add).toHaveBeenCalledOnce());
    const payload = mocks.add.mock.calls[0]?.[0];
    if (!(payload instanceof FormData)) throw new Error("Expected form");
    expect(Object.fromEntries(payload)).toMatchObject({
      class_id: "class-a",
      mode: "new",
      full_name: "Học viên mới",
      enrollment_date: "2026-10-16",
      salesperson: "Tư vấn A",
    });
    expect(payload.get("request_id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.added).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("finds an existing student and enrolls the selected ID without a new profile", async () => {
    open();
    fireEvent.change(screen.getByLabelText("Cách thêm học viên"), {
      target: { value: "existing" },
    });
    await screen.findByText(/B2C-HV000001/);
    fillEnrollment();
    expect(
      screen.getByRole("button", { name: "Lưu học viên vào lớp" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("radio"));
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu học viên vào lớp" }),
    );
    await waitFor(() => expect(mocks.add).toHaveBeenCalledOnce());
    const payload = mocks.add.mock.calls[0]?.[0];
    if (!(payload instanceof FormData)) throw new Error("Expected form");
    expect(Object.fromEntries(payload)).toMatchObject({
      mode: "existing",
      student_id: "existing",
    });
    expect(payload.has("full_name")).toBe(false);
  });
  it("keeps rejected requests open with form values and the same retry ID", async () => {
    mocks.add.mockResolvedValue({ error: "Lớp đã đủ sĩ số tối đa." });
    open();
    fillEnrollment();
    fireEvent.change(screen.getByLabelText("Họ tên học viên *"), {
      target: { value: "Học viên mới" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu học viên vào lớp" }),
    );
    await screen.findByText("Lớp đã đủ sĩ số tối đa.");
    expect(screen.getByLabelText("Họ tên học viên *")).toHaveValue(
      "Học viên mới",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu học viên vào lớp" }),
    );
    await waitFor(() => expect(mocks.add).toHaveBeenCalledTimes(2));
    const first = mocks.add.mock.calls[0]?.[0] as FormData,
      second = mocks.add.mock.calls[1]?.[0] as FormData;
    expect(first.get("request_id")).toBe(second.get("request_id"));
    expect(mocks.added).not.toHaveBeenCalled();
  });
  it("provides retry when student lookup fails", async () => {
    mocks.find.mockRejectedValueOnce(new Error("Không tải được học viên"));
    open();
    fireEvent.change(screen.getByLabelText("Cách thêm học viên"), {
      target: { value: "existing" },
    });
    await screen.findByText("Không tải được học viên");
    fireEvent.click(screen.getByRole("button", { name: "Thử tìm lại" }));
    await screen.findByText(/B2C-HV000001/);
    expect(mocks.find).toHaveBeenCalledTimes(2);
  });
  it("does not submit the enrollment when Enter is used in student search", async () => {
    open();
    fireEvent.change(screen.getByLabelText("Cách thêm học viên"), {
      target: { value: "existing" },
    });
    await screen.findByText(/B2C-HV000001/);
    const input = screen.getByLabelText("Tìm theo mã, tên, SĐT hoặc phụ huynh");
    fireEvent.change(input, { target: { value: "B2C-HV000001" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(mocks.find).toHaveBeenLastCalledWith("class-a", "B2C-HV000001", 0),
    );
    expect(mocks.add).not.toHaveBeenCalled();
  });
  it("ignores old search results after switching back to creating a new profile", async () => {
    let resolve!: (v: { rows: never[]; total: number }) => void;
    mocks.find.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    open();
    fireEvent.change(screen.getByLabelText("Cách thêm học viên"), {
      target: { value: "existing" },
    });
    fireEvent.change(screen.getByLabelText("Cách thêm học viên"), {
      target: { value: "new" },
    });
    await act(async () => {
      resolve({ rows: [], total: 0 });
    });
    expect(screen.getByLabelText("Họ tên học viên *")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
