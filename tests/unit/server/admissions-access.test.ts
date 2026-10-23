import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNavigationGroups } from "@/lib/permissions/navigation";

const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.user }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: mocks.rpc }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { requireAdmissionsAccess } from "@/features/b2c/server/admissions-access";

describe("teacher admissions access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "teacher", role: "teacher" });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
  });
  it("requires the explicit permission for the signed in teacher", async () => {
    mocks.rpc.mockResolvedValue(true);
    expect(await requireAdmissionsAccess()).toEqual({ id: "teacher", role: "teacher" });
    expect(mocks.rpc).toHaveBeenCalledWith("has_b2c_permission", { p_key: "manage_admissions" });
  });
  it("rejects an ungranted teacher", async () => {
    mocks.rpc.mockResolvedValue(false);
    await expect(requireAdmissionsAccess()).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/teacher");
  });
  it("fails closed when the permission query fails", async () => {
    mocks.rpc.mockRejectedValue(new Error("Unavailable"));
    await expect(requireAdmissionsAccess()).rejects.toThrow("Unavailable");
  });
  it("only shows the teacher admissions link when granted", () => {
    const links = (granted: boolean) => getNavigationGroups("teacher", { canManageAdmissions: granted }).flatMap(g => g.items.map(i => i.href));
    expect(links(false)).not.toContain("/teacher/admissions");
    expect(links(true)).toContain("/teacher/admissions");
    expect(links(true)).not.toContain("/admin/b2c/tuition");
  });
});
