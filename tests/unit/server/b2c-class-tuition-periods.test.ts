import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ manager: vi.fn(), teaching: vi.fn(), rpc: vi.fn(), rawRpc: vi.fn(), readClass: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireManager: mocks.manager, requireTeaching: mocks.teaching }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.readClass }) }) }),
  rpc: mocks.rawRpc,
}) }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: mocks.rpc }));
import { readClassWorkspaceAction } from "@/features/b2c/server/class-workspace-read";
import { readTeacherWorkspaceAction } from "@/features/b2c/server/teacher-management-actions";

const classId = "10000000-0000-4000-8000-000000000001";
const cls = { id: classId, name: "Lớp thử" };
const result = { class: cls, schedules: [], meeting: null, total: 2,
  stats: { total_due: 6475000, paid_amount: 3695000, unconfigured: 0 },
  rows: [
    { enrollment_id: "e1", package_id: "new", period_no: 2, is_current: true, paid_amount: 0, balance: 2780000 },
    { enrollment_id: "e1", package_id: "old", period_no: 1, is_current: false, paid_amount: 3695000, balance: 0 },
  ],
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.manager.mockResolvedValue({ fullName: "Admin" });
  mocks.teaching.mockResolvedValue({ fullName: "Teacher" });
  mocks.readClass.mockResolvedValue({ data: cls, error: null });
  mocks.rpc.mockResolvedValue(result);
});

it.each([
  ["admin", readClassWorkspaceAction],
  ["teacher", readTeacherWorkspaceAction],
] as const)("loads class tuition periods through the scoped RPC for %s", async (_role, read) => {
  const model = await read(classId, { tab: "tuition", q: "Học viên", page: "1" });
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("read_b2c_class_tuition_periods", {
    p_class_id: classId, p_page: 1, p_query: "Học viên",
  });
  expect(model.cls).toEqual(cls);
  expect(model.schedules).toEqual([]);
  expect(model.result.rows).toEqual(result.rows);
  expect(model.result.stats).toEqual(result.stats);
  expect(mocks.rawRpc).not.toHaveBeenCalled();
});

it("preserves a teacher tuition denial instead of falling back to an older reader", async () => {
  mocks.rpc.mockRejectedValue(new Error("Không có quyền xem học phí."));
  await expect(readTeacherWorkspaceAction(classId, { tab: "tuition" })).rejects.toThrow("Không có quyền xem học phí");
  expect(mocks.rawRpc).not.toHaveBeenCalled();
});

it("does not load financial data before the manager session is authorized", async () => {
  mocks.manager.mockRejectedValue(new Error("Denied"));
  await expect(readClassWorkspaceAction(classId, { tab: "tuition" })).rejects.toThrow("Denied");
  expect(mocks.readClass).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
