import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNavigationGroups } from "@/lib/permissions/navigation";
const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.user }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: mocks.rpc }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { requireB2CParentAccess, readTeacherParentDashboard } from "@/features/b2c/server/parent-access";

describe("B2C teacher parents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "teacher", role: "teacher" });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
  });
  it("checks eligibility before allowing parent entry", async () => {
    mocks.rpc.mockResolvedValue(true);
    expect(await requireB2CParentAccess()).toEqual({ id: "teacher", role: "teacher" });
    expect(mocks.rpc).toHaveBeenCalledWith("can_manage_b2c_parents");
  });
  it("denies ineligible teachers", async () => {
    mocks.rpc.mockResolvedValue(false);
    await expect(requireB2CParentAccess()).rejects.toThrow("redirect");
  });
  it("loads all pages when the list grows beyond 33 or 50", async () => {
    mocks.rpc.mockResolvedValueOnce(true)
      .mockResolvedValueOnce({ total: 75, parents: Array.from({ length: 50 }, (_, i) => ({ id: `p${i}` })) })
      .mockResolvedValueOnce({ total: 75, parents: Array.from({ length: 25 }, (_, i) => ({ id: `p${i+50}` })) });
    expect(await readTeacherParentDashboard()).toHaveLength(75);
    expect(mocks.rpc).toHaveBeenLastCalledWith("read_teacher_b2c_parents_page", { p_query: "", p_page: 1 });
  });
  it("rejects partial data rather than silently losing new profiles", async () => {
    mocks.rpc.mockResolvedValueOnce(true)
      .mockResolvedValueOnce({ total: 75, parents: [{ id: "p1" }] })
      .mockResolvedValueOnce({ total: 75, parents: [] });
    await expect(readTeacherParentDashboard()).rejects.toThrow("Chưa tải đủ");
  });
  it("shows the parents menu only for eligible teachers", () => {
    const links = (allowed: boolean) => getNavigationGroups("teacher", { canManageB2CParents: allowed }).flatMap(g => g.items.map(i => i.href));
    expect(links(true)).toContain("/teacher/parents");
    expect(links(false)).not.toContain("/teacher/parents");
  });
});
