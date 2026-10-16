import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), change: vi.fn() }));
vi.mock("@/features/teachers/server/account-actions", () => ({
  readTeacherAccountAction: mocks.read,
  changeTeacherPasswordAction: mocks.change,
}));
import { TeacherAccountDialog } from "@/features/teachers/components/teacher-account-dialog";
const target = {
  kind: "b2c" as const,
  id: "16100000-0000-4000-8000-000000000001",
};
const account = {
  teacher_id: "teacher",
  user_id: "user",
  full_name: "Giáo viên A",
  username: "gv.a",
  login: "gv.a",
  role: "teacher",
  account_active: false,
  teacher_active: false,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue({ account });
  mocks.change.mockResolvedValue({ success: "Đã đổi mật khẩu giáo viên." });
});
afterEach(cleanup);
async function open() {
  render(<TeacherAccountDialog target={target} />);
  fireEvent.click(screen.getByRole("button", { name: "Tài khoản" }));
  await screen.findByText("gv.a");
}
describe("teacher account dialog", () => {
  it("shows account details and submits a password-only request with confirmation", async () => {
    await open();
    expect(screen.getByText("Đã khóa")).toBeInTheDocument();
    expect(screen.getByLabelText("Mật khẩu mới *")).toHaveAttribute(
      "type",
      "password",
    );
    fireEvent.change(screen.getByLabelText("Mật khẩu mới *"), {
      target: { value: "NewPass@2026" },
    });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới *"), {
      target: { value: "NewPass@2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
    await waitFor(() =>
      expect(mocks.change).toHaveBeenCalledWith(expect.any(FormData)),
    );
    const sent = mocks.change.mock.calls[0]?.[0];
    if (!(sent instanceof FormData)) throw new Error("Expected form payload");
    expect(Object.fromEntries(sent)).toEqual({
      ...target,
      expected_user_id: "user",
      password: "NewPass@2026",
      confirm_password: "NewPass@2026",
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("keeps the dialog open with a clear error on rejected password change", async () => {
    mocks.change.mockResolvedValue({ error: "Mật khẩu xác nhận chưa khớp." });
    await open();
    fireEvent.change(screen.getByLabelText("Mật khẩu mới *"), {
      target: { value: "NewPass@2026" },
    });
    fireEvent.change(screen.getByLabelText("Xác nhận mật khẩu mới *"), {
      target: { value: "Different@2026" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Đổi mật khẩu" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("shows a link to assign an existing account when B2C is unlinked", async () => {
    mocks.read.mockResolvedValue({ account: null });
    render(<TeacherAccountDialog target={target} />);
    fireEvent.click(screen.getByRole("button", { name: "Tài khoản" }));
    await screen.findByText("Hồ sơ B2C chưa liên kết tài khoản giáo viên.");
    expect(screen.getByRole("link", { name: /Mở Phân quyền/ })).toHaveAttribute(
      "href",
      "/admin/b2c/permissions",
    );
    expect(
      screen.queryByRole("button", { name: "Đổi mật khẩu" }),
    ).not.toBeInTheDocument();
  });
  it("supports retry after account loading fails", async () => {
    mocks.read.mockRejectedValueOnce(new Error("network"));
    render(<TeacherAccountDialog target={target} />);
    fireEvent.click(screen.getByRole("button", { name: "Tài khoản" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("gv.a");
    expect(mocks.read).toHaveBeenCalledTimes(2);
  });
  it("clears password fields after closing and reopening", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Mật khẩu mới *"), {
      target: { value: "NewPass@2026" },
    });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tài khoản" }));
    await screen.findByText("gv.a");
    expect(screen.getByLabelText("Mật khẩu mới *")).toHaveValue("");
  });
});
