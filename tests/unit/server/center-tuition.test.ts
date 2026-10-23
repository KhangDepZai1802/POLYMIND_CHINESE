import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNavigationGroups } from "@/lib/permissions/navigation";
const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.user }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: mocks.rpc }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { requireCenterTuitionAccess, readCenterTuitionDashboard } from "@/features/b2c/server/center-tuition";

describe("center tuition teacher access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "teacher", role: "teacher" });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
  });
  it("denies ungranted teachers before reading data", async () => {
    mocks.rpc.mockResolvedValue(false);
    await expect(requireCenterTuitionAccess()).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/teacher");
  });
  it("collects all pages for sixty enrollments", async () => {
    mocks.rpc.mockResolvedValueOnce(true)
      .mockResolvedValueOnce({ total: 60, rows: Array.from({ length: 50 }, (_, i) => ({ enrollment_id: `e${i}` })) })
      .mockResolvedValueOnce({ total: 60, rows: Array.from({ length: 10 }, (_, i) => ({ enrollment_id: `e${i+50}` })) });
    expect(await readCenterTuitionDashboard()).toHaveLength(60);
    expect(mocks.rpc).toHaveBeenLastCalledWith("read_center_b2c_tuition_page", { p_query: "", p_page: 1 });
  });
  it("only shows the tuition link with explicit global permission", () => {
    const links = (granted: boolean) => getNavigationGroups("teacher", { canManageCenterTuition: granted }).flatMap(g => g.items.map(i => i.href));
    expect(links(false)).not.toContain("/teacher/tuition");
    expect(links(true)).toContain("/teacher/tuition");
    expect(links(false)).not.toContain("/teacher/tuition");
  });
});
