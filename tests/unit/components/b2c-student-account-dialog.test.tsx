import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { B2CStudentAccountDialog } from "@/features/b2c/components/student-account-dialog";
import {
  readB2CStudentAccountAction,
  findB2CStudentLoginAction,
  saveB2CStudentAccountAction,
} from "@/features/b2c/server/student-account-actions";

vi.mock("@/features/b2c/server/student-account-actions", () => ({
  readB2CStudentAccountAction: vi.fn(),
  findB2CStudentLoginAction: vi.fn(),
  saveB2CStudentAccountAction: vi.fn(),
}));
const student = {
  student_id: "student",
  full_name: "Học viên An",
  phone: null,
  email: null,
  account: null,
};
const account = {
  id: "user",
  username: "an.hocvien",
  full_name: "Học viên An",
  email: null,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(readB2CStudentAccountAction).mockResolvedValue(student);
});
async function open() {
  const user = userEvent.setup();
  render(
    <B2CStudentAccountDialog studentId="student" fullName="Học viên An" />,
  );
  await user.click(
    screen.getByRole("button", { name: "Tài khoản Học viên An" }),
  );
  await screen.findByRole("heading", { name: "Tài khoản học viên" });
  return user;
}
describe("B2C account management", () => {
  it("shows an existing login without password reset or account creation", async () => {
    vi.mocked(readB2CStudentAccountAction).mockResolvedValue({
      ...student,
      account,
    });
    await open();
    expect(
      await screen.findByText("Tên đăng nhập: an.hocvien"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Mật khẩu")).not.toBeInTheDocument();
    expect(saveB2CStudentAccountAction).not.toHaveBeenCalled();
  });
  it("requires explicit exact lookup and selection before linking", async () => {
    vi.mocked(findB2CStudentLoginAction).mockResolvedValue(account);
    vi.mocked(saveB2CStudentAccountAction).mockResolvedValue({
      error: "Đã liên kết nơi khác",
    });
    const user = await open();
    await user.click(
      await screen.findByRole("button", { name: "Liên kết tài khoản có sẵn" }),
    );
    expect(
      screen.getByRole("button", { name: "Liên kết với học viên này" }),
    ).toBeDisabled();
    await user.type(
      screen.getByLabelText("Tên đăng nhập hoặc email chính xác"),
      "an.hocvien",
    );
    await user.click(screen.getByRole("button", { name: "Tìm tài khoản" }));
    await screen.findByText("Học viên An · an.hocvien");
    await user.click(
      screen.getByRole("button", { name: "Liên kết với học viên này" }),
    );
    await screen.findByRole("alert");
    const form = vi.mocked(saveB2CStudentAccountAction).mock.calls[0]![1];
    expect(form.get("user_id")).toBe("user");
    expect(form.get("mode")).toBe("link");
    expect(form.has("password")).toBe(false);
    await user.type(
      screen.getByLabelText("Tên đăng nhập hoặc email chính xác"),
      "x",
    );
    expect(
      screen.getByRole("button", { name: "Liên kết với học viên này" }),
    ).toBeDisabled();
  });
  it("retains entered values after failure and clears the password after success", async () => {
    vi.mocked(saveB2CStudentAccountAction)
      .mockResolvedValueOnce({ error: "Tên đăng nhập đã tồn tại" })
      .mockResolvedValueOnce({ success: "Đã cấp tài khoản học viên." });
    const user = await open();
    await user.type(
      await screen.findByLabelText(/^Tên đăng nhập$/),
      "an.hocvien",
    );
    await user.type(screen.getByLabelText("Mật khẩu"), "Temporary123!");
    await user.click(screen.getByRole("button", { name: "Cấp tài khoản" }));
    await screen.findByText("Tên đăng nhập đã tồn tại");
    expect(screen.getByLabelText("Mật khẩu")).toHaveValue("Temporary123!");
    vi.mocked(readB2CStudentAccountAction).mockResolvedValue({
      ...student,
      account,
    });
    await user.click(screen.getByRole("button", { name: "Cấp tài khoản" }));
    await screen.findByText("Đã cấp tài khoản học viên.");
    await waitFor(() =>
      expect(screen.queryByLabelText("Mật khẩu")).not.toBeInTheDocument(),
    );
  });
});
