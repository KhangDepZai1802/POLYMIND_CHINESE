import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ guard: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireManager: api.guard }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: api.rpc, from: api.from }) }));
import { readParentDashboard } from "@/features/b2c/server/parent-dashboard";
beforeEach(() => vi.resetAllMocks());
it("loads all parent pages instead of counting only the first page", async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({ id: `p${i}`, full_name: `PH${i}`, phone: null, zalo: null, email: null, children: [] }));
  api.rpc.mockResolvedValueOnce({ data: { parents: rows.slice(0, 50), total: 51 }, error: null }).mockResolvedValueOnce({ data: { parents: rows.slice(50), total: 51 }, error: null });
  expect(await readParentDashboard()).toHaveLength(51);
  expect(api.guard).toHaveBeenCalledOnce(); expect(api.rpc).toHaveBeenLastCalledWith("get_b2c_parents_page", { p_query: "", p_page: 1 });
  expect(api.from).not.toHaveBeenCalled();
});
it("stops before reading contacts without manager access", async () => {
  api.guard.mockRejectedValue(new Error("Denied"));
  await expect(readParentDashboard()).rejects.toThrow("Denied"); expect(api.rpc).not.toHaveBeenCalled();
});
it("fails rather than reporting partial contact coverage", async () => {
  api.rpc.mockResolvedValueOnce({ data: { parents: [{ id: "p", children: [] }], total: 2 }, error: null }).mockResolvedValueOnce({ data: null, error: { message: "Failure" } });
  await expect(readParentDashboard()).rejects.toThrow("Không tải được danh sách phụ huynh");
});
it("resolves child classes from active enrollments with the same session client", async () => {
  api.rpc.mockResolvedValue({ data: { parents: [{ id: "p", full_name: "PH", phone: null, zalo: null, children: [{ code: "HV1", full_name: "An", relationship: "mother" }] }], total: 1 }, error: null });
  const range = vi.fn().mockResolvedValue({ data: [{ id: "e", student_id: "s", class_id: "c" }], error: null });
  const statusFilter = vi.fn().mockReturnValue({ order: () => ({ range }) });
  api.from.mockImplementation((table: string) => ({ select: () => ({ in: () => table === "b2c_enrollments" ? { in: statusFilter } : Promise.resolve({ data: table === "b2c_students" ? [{ id: "s", code: "HV1" }] : [{ id: "c", name: "Movers" }], error: null }) }) }));
  const result = await readParentDashboard();
  expect(result[0]?.children[0]?.classes).toEqual([{ id: "c", name: "Movers" }]);
  expect(statusFilter).toHaveBeenCalledWith("status", ["studying", "on_hold", "awaiting_renewal", "overdue"]);
});
