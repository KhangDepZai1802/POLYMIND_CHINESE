import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.user }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: mocks.rpc }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { requireB2CEnrollmentAccess } from "@/features/b2c/server/enrollment-access";
describe("all B2C teachers enrollment access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "teacher", role: "teacher" });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
  });
  it("allows an eligible teacher through the live database guard", async () => {
    mocks.rpc.mockResolvedValue(true);
    expect(await requireB2CEnrollmentAccess()).toEqual({ id: "teacher", role: "teacher" });
    expect(mocks.rpc).toHaveBeenCalledWith("can_add_b2c_students");
  });
  it("denies a teacher without B2C access", async () => {
    mocks.rpc.mockResolvedValue(false);
    await expect(requireB2CEnrollmentAccess()).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/teacher");
  });
  it("fails closed on a database error", async () => {
    mocks.rpc.mockRejectedValue(new Error("unavailable"));
    await expect(requireB2CEnrollmentAccess()).rejects.toThrow("unavailable");
  });
});
