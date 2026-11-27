import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  role: vi.fn(), rpc: vi.fn(), provision: vi.fn(), revalidate: vi.fn(), path: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.role }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: mocks.rpc }));
vi.mock("@/features/users/server/account", () => ({ provisionPasswordAccount: mocks.provision }));
vi.mock("@/features/b2c/server/revalidate-views", () => ({ revalidateB2CViews: mocks.revalidate }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path }));

import {
  findB2CStudentLoginAction,
  readB2CStudentAccountAction,
  saveB2CStudentAccountAction,
} from "@/features/b2c/server/student-account-actions";

const studentId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const student = {
  student_id: studentId,
  full_name: "Học viên từ hồ sơ",
  phone: "0900000000",
  email: "contact@example.test",
  account: null,
};
const login = { id: userId, username: "student.test", full_name: student.full_name, email: student.email };
function form(changes: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    mode: "create", student_id: studentId, username: "student.test", password: "OnlyATest123!", ...changes,
  })) result.set(key, value);
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role.mockResolvedValue({ id: "admin", role: "super_admin" });
  mocks.rpc.mockImplementation(async (name: string) => name === "read_b2c_student_account" ? student : name === "find_b2c_student_login" ? login : userId);
  mocks.provision.mockResolvedValue({ ok: true, userId, created: true });
});

describe("B2C student account access", () => {
  it.each([
    () => readB2CStudentAccountAction(studentId),
    () => findB2CStudentLoginAction("student.test"),
    () => saveB2CStudentAccountAction({}, form()),
  ])("requires super-admin before any lookup or account mutation", async (action) => {
    mocks.role.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(action()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.role).toHaveBeenCalledWith("super_admin");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.provision).not.toHaveBeenCalled();
  });

  it("looks up only the exact provided student identity/login", async () => {
    expect(await readB2CStudentAccountAction(studentId)).toEqual(student);
    expect(mocks.rpc).toHaveBeenCalledWith("read_b2c_student_account", { p_student_id: studentId });
    expect(await findB2CStudentLoginAction(" student.test ")).toEqual(login);
    expect(mocks.rpc).toHaveBeenLastCalledWith("find_b2c_student_login", { p_login: "student.test" });
  });

  it("rejects malformed student IDs, missing passwords and invalid link targets", async () => {
    const cases: Record<string, string>[] = [{ student_id: "not-id" }, { password: "short" }, { mode: "link", user_id: "not-id" }];
    for (const changes of cases) {
      expect(await saveB2CStudentAccountAction({}, form(changes))).toHaveProperty("fieldErrors");
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.provision).not.toHaveBeenCalled();
  });
});

describe("B2C account provision and explicit link", () => {
  it("creates only a new student login using authoritative profile data", async () => {
    expect(await saveB2CStudentAccountAction({}, form({ full_name: "Injected name", email: "attacker@example.test", role: "super_admin", user_id: otherId }))).toHaveProperty("success");
    expect(mocks.provision).toHaveBeenCalledWith({
      userId: null, username: "student.test", password: "OnlyATest123!", role: "student",
      fullName: student.full_name, phone: student.phone, contactEmail: student.email,
    });
    expect(mocks.rpc).toHaveBeenLastCalledWith("link_b2c_student_account", { p_student_id: studentId, p_user_id: userId });
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
    expect(mocks.path).toHaveBeenCalledWith("/student", "layout");
  });

  it("links an existing selected user without changing credentials", async () => {
    expect(await saveB2CStudentAccountAction({}, form({ mode: "link", user_id: userId, password: "InjectedReset123!" }))).toHaveProperty("success");
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenLastCalledWith("link_b2c_student_account", { p_student_id: studentId, p_user_id: userId });
  });

  it("returns success for an already committed link without resetting a password", async () => {
    mocks.rpc.mockResolvedValue({ ...student, account: login });
    expect(await saveB2CStudentAccountAction({}, form({ mode: "link", user_id: userId }))).toHaveProperty("success");
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("refuses to replace an existing account when the selected target differs", async () => {
    mocks.rpc.mockResolvedValue({ ...student, account: login });
    expect(await saveB2CStudentAccountAction({}, form({ mode: "link", user_id: otherId }))).toHaveProperty("error");
    expect(await saveB2CStudentAccountAction({}, form())).toHaveProperty("error");
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("does not create an account when the student's authoritative profile cannot be read", async () => {
    mocks.rpc.mockRejectedValue(new Error("DB unavailable"));
    expect(await saveB2CStudentAccountAction({}, form())).toHaveProperty("error");
    expect(mocks.provision).not.toHaveBeenCalled();
  });

  it("does not link or claim success after a provisioning failure", async () => {
    mocks.provision.mockResolvedValue({ ok: false, error: "Tên đăng nhập đã được sử dụng." });
    expect(await saveB2CStudentAccountAction({}, form())).toEqual({ error: "Tên đăng nhập đã được sử dụng." });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("recognizes a committed link after losing the mutation response", async () => {
    mocks.rpc.mockResolvedValueOnce(student).mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce({ ...student, account: login });
    expect(await saveB2CStudentAccountAction({}, form())).toHaveProperty("success");
    expect(mocks.provision).toHaveBeenCalledTimes(1);
    expect(mocks.rpc).toHaveBeenLastCalledWith("read_b2c_student_account", { p_student_id: studentId });
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });

  it("keeps a newly created account when the link result remains uncertain", async () => {
    mocks.rpc.mockResolvedValueOnce(student).mockRejectedValueOnce(new Error("Connection lost"))
      .mockRejectedValueOnce(new Error("Read unavailable"));
    const result = await saveB2CStudentAccountAction({}, form());
    expect(result).toEqual({ error: "Chưa xác nhận được liên kết. Vui lòng tải lại tài khoản trước khi thử tiếp." });
    expect(mocks.provision).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("retains the new account and directs explicit linking after a failed link", async () => {
    mocks.rpc.mockResolvedValueOnce(student).mockRejectedValueOnce(new Error("Link race"))
      .mockResolvedValueOnce({ ...student, account: { ...login, id: otherId } });
    const result = await saveB2CStudentAccountAction({}, form());
    expect(result.error).toContain("Chọn liên kết tài khoản có sẵn");
    expect(mocks.provision).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("returns failed existing links without creating or resetting any account", async () => {
    mocks.rpc.mockResolvedValueOnce(student).mockRejectedValueOnce(new Error("Inactive student"))
      .mockResolvedValueOnce(student);
    expect(await saveB2CStudentAccountAction({}, form({ mode: "link", user_id: userId }))).toHaveProperty("error");
    expect(mocks.provision).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
