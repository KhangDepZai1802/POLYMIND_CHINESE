import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ require: vi.fn(), rpc: vi.fn(), from: vi.fn(), select: vi.fn(), inside: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireManager: api.require }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: api.rpc, from: api.from }) }));
import { readTuitionDashboard } from "@/features/b2c/server/tuition-dashboard";
beforeEach(() => { vi.resetAllMocks(); api.from.mockReturnValue({ select: api.select }); api.select.mockReturnValue({ in: api.inside }); });
it("loads every RPC page, retaining effective balances and requiring manager access", async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({ enrollment_id: `e${i}`, balance: 123 }));
  api.rpc.mockResolvedValueOnce({ data: { rows: rows.slice(0, 50), total: 51 }, error: null }).mockResolvedValueOnce({ data: { rows: rows.slice(50), total: 51 }, error: null });
  api.inside.mockResolvedValue({ data: rows.map(r => ({ id: r.enrollment_id, class_id: "c", status: "studying", enrollment_date: null, tuition_end_date: null })), error: null });
  const result = await readTuitionDashboard();
  expect(api.require).toHaveBeenCalledOnce(); expect(api.rpc).toHaveBeenLastCalledWith("get_b2c_tuition_page", { p_query: "", p_page: 1 });
  expect(result).toHaveLength(51); expect(result[50]?.balance).toBe(123);
});
it("fails closed when an RPC page fails rather than returning partial financial totals", async () => {
  api.rpc.mockResolvedValueOnce({ data: { rows: [{ enrollment_id: "e" }], total: 2 }, error: null }).mockResolvedValueOnce({ data: null, error: { message: "failure" } });
  await expect(readTuitionDashboard()).rejects.toThrow("Không tải được học phí");
});
it("denies before reading financial data", async () => {
  api.require.mockRejectedValue(new Error("Denied"));
  await expect(readTuitionDashboard()).rejects.toThrow("Denied"); expect(api.rpc).not.toHaveBeenCalled();
});
