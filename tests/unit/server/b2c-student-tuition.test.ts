import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ role: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.role }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({
  permissionRpc: mocks.rpc,
}));

import { getMyB2CTuition } from "@/features/b2c/server/student-tuition";

const id = "11111111-1111-4111-8111-111111111111";

describe("getMyB2CTuition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.role.mockResolvedValue({ role: "student" });
    mocks.rpc.mockResolvedValue({ linked_student: null, periods: [] });
  });

  it("đọc dữ liệu qua RPC tự xác định học viên, không truyền student id", async () => {
    await expect(getMyB2CTuition()).resolves.toEqual({
      linked_student: null,
      periods: [],
    });
    expect(mocks.role).toHaveBeenCalledExactlyOnceWith("student");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("read_my_b2c_tuition");
  });

  it("từ chối payload sai thay vì hiển thị nhầm học phí", async () => {
    mocks.rpc.mockResolvedValue({
      linked_student: { id, code: "HV", full_name: "Học viên" },
      periods: [{ enrollment_id: id }],
    });
    await expect(getMyB2CTuition()).rejects.toThrow();
  });

  it("không nuốt lỗi xác thực", async () => {
    mocks.role.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(getMyB2CTuition()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
