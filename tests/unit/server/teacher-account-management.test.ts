import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  role: vi.fn(),
  from: vi.fn(),
  admin: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  audit: vi.fn(),
  b2c: vi.fn(),
  teacher: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.role }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mocks.from }),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/audit", () => ({ logAudit: mocks.audit }));
import {
  readTeacherAccountAction,
  changeTeacherPasswordAction as changePasswordFormAction,
} from "@/features/teachers/server/account-actions";
function changeTeacherPasswordAction(input: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(input)) form.set(key, value);
  return changePasswordFormAction(form);
}
const teacherId = "16100000-0000-4000-8000-000000000001";
const b2cId = "16100000-0000-4000-8000-000000000002";
const userId = "16100000-0000-4000-8000-000000000003";
const target = { kind: "b2c", id: b2cId };
const passwordInput = {
  ...target,
  expected_user_id: userId,
  password: "NewPass@2026",
  confirm_password: "NewPass@2026",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.role.mockResolvedValue({ role: "super_admin" });
  mocks.b2c.mockResolvedValue({
    data: { source_teacher_id: teacherId },
    error: null,
  });
  mocks.teacher.mockResolvedValue({
    data: {
      id: teacherId,
      user_id: userId,
      is_active: false,
      profile: {
        full_name: "Giáo vụ A",
        username: "gv.a",
        role: "academic_manager",
        is_active: false,
      },
    },
    error: null,
  });
  mocks.from.mockImplementation((table: string) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: table === "b2c_teachers" ? mocks.b2c : mocks.teacher,
  }));
  mocks.getUser.mockResolvedValue({
    data: { user: { id: userId, email: "gv.a@accounts.example" } },
    error: null,
  });
  mocks.updateUser.mockResolvedValue({ data: {}, error: null });
  mocks.admin.mockReturnValue({
    auth: {
      admin: { getUserById: mocks.getUser, updateUserById: mocks.updateUser },
    },
  });
  mocks.audit.mockResolvedValue(undefined);
});
describe("admin manages linked teacher credentials", () => {
  it("resolves B2C IDs to shared accounts and shows username/locked state without passwords", async () => {
    const result = await readTeacherAccountAction(target);
    expect(mocks.role).toHaveBeenCalledWith("super_admin");
    expect(result.account).toMatchObject({
      teacher_id: teacherId,
      user_id: userId,
      login: "gv.a",
      role: "academic_manager",
      account_active: false,
    });
    expect(JSON.stringify(result)).not.toMatch(/password/);
  });
  it("changes only the password of a locked academic manager and excludes secrets from audit", async () => {
    const result = await changeTeacherPasswordAction(passwordInput);
    expect(result.success).toBeTruthy();
    expect(mocks.updateUser).toHaveBeenCalledExactlyOnceWith(userId, {
      password: "NewPass@2026",
    });
    expect(mocks.admin.mock.results[0]?.value.from).toBeUndefined();
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "teacher.password_reset",
        resourceId: teacherId,
      }),
    );
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(
      "NewPass@2026",
    );
    expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(
      "confirm_password",
    );
  });
  it("rejects nonadmins before resolving any account or using Auth admin", async () => {
    mocks.role.mockRejectedValue(new Error("denied"));
    await expect(readTeacherAccountAction(target)).rejects.toThrow("denied");
    await expect(changeTeacherPasswordAction(passwordInput)).rejects.toThrow(
      "denied",
    );
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("rejects an account link changed after opening the dialog", async () => {
    const result = await changeTeacherPasswordAction({
      ...passwordInput,
      expected_user_id: "16100000-0000-4000-8000-000000000099",
    });
    expect(result.error).toContain("Liên kết tài khoản đã thay đổi");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("reports unlinked B2C profiles without guessing a target by name", async () => {
    mocks.b2c.mockResolvedValue({
      data: { source_teacher_id: null },
      error: null,
    });
    expect(await readTeacherAccountAction(target)).toEqual({ account: null });
    expect((await changeTeacherPasswordAction(passwordInput)).error).toContain(
      "chưa liên kết",
    );
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.teacher).not.toHaveBeenCalled();
  });
  it("validates confirmation and length before reading accounts", async () => {
    expect(
      (
        await changeTeacherPasswordAction({
          ...passwordInput,
          confirm_password: "Different@2026",
        })
      ).error,
    ).toContain("chưa khớp");
    expect(
      (
        await changeTeacherPasswordAction({
          ...passwordInput,
          password: "short",
          confirm_password: "short",
        })
      ).error,
    ).toBeTruthy();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.admin).not.toHaveBeenCalled();
  });
  it("does not reset another role through the teacher workflow", async () => {
    mocks.teacher.mockResolvedValue({
      data: {
        id: teacherId,
        user_id: userId,
        profile: { role: "super_admin" },
      },
      error: null,
    });
    expect(
      (await changeTeacherPasswordAction(passwordInput)).error,
    ).toBeTruthy();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("shows Auth update failure and does not record a successful reset", async () => {
    mocks.updateUser.mockResolvedValue({ error: { message: "same password" } });
    expect(
      (await changeTeacherPasswordAction(passwordInput)).error,
    ).toBeTruthy();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("uses the actual Auth email for legacy accounts without a username", async () => {
    mocks.teacher.mockResolvedValue({
      data: {
        id: teacherId,
        user_id: userId,
        is_active: true,
        profile: {
          full_name: "A",
          username: null,
          role: "teacher",
          is_active: true,
        },
      },
      error: null,
    });
    expect(
      (await readTeacherAccountAction({ kind: "teacher", id: teacherId }))
        .account?.login,
    ).toBe("gv.a@accounts.example");
  });
});
