import { beforeEach, expect, it, vi } from "vitest";
import { getNavigationGroups } from "@/lib/permissions/navigation";
const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.user }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: mocks.rpc }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { requireStudentDataAccess } from "@/features/b2c/server/student-data";
beforeEach(() => {
  vi.resetAllMocks(); mocks.user.mockResolvedValue({ id: "teacher", role: "teacher" });
  mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
});
it("requires explicit center-wide data permission", async () => {
  mocks.rpc.mockResolvedValue(false);
  await expect(requireStudentDataAccess()).rejects.toThrow("redirect");
  expect(mocks.rpc).toHaveBeenCalledWith("has_b2c_permission", { p_key: "manage_center_student_data" });
});
it("shows the students entry only for authorized teachers", () => {
  const links = (allowed: boolean) => getNavigationGroups("teacher", { canManageStudentData: allowed }).flatMap(g => g.items.map(i => i.href));
  expect(links(true)).toContain("/teacher/students");
  expect(links(false)).not.toContain("/teacher/students");
});
