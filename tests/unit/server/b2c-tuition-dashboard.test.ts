import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ require: vi.fn(), rpc: vi.fn(), from: vi.fn(), select: vi.fn(), inside: vi.fn(), receiptSelect: vi.fn(), receiptIn: vi.fn(), order: vi.fn(), range: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireManager: api.require }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: api.rpc, from: api.from }) }));
import { readTuitionDashboard } from "@/features/b2c/server/tuition-dashboard";
beforeEach(() => {
  vi.resetAllMocks();
  api.from.mockImplementation((table) => ({ select: table === "b2c_tuition_receipts" ? api.receiptSelect : api.select }));
  api.select.mockReturnValue({ in: api.inside });
  api.receiptSelect.mockReturnValue({ in: api.receiptIn });
  api.receiptIn.mockReturnValue({ order: api.order });
  api.order.mockReturnValue({ range: api.range });
});
it("loads every RPC page, retaining effective balances and requiring manager access", async () => {
  const rows = Array.from({ length: 51 }, (_, i) => ({ enrollment_id: `e${i}`, package_id: null, paid_amount: 0, balance: 123, student_archived_at: i === 50 ? "2026-11-10T00:00:00Z" : null }));
  api.rpc.mockResolvedValueOnce({ data: { rows: rows.slice(0, 50), total: 51 }, error: null }).mockResolvedValueOnce({ data: { rows: rows.slice(50), total: 51 }, error: null });
  api.inside.mockResolvedValue({ data: rows.map(r => ({ id: r.enrollment_id, class_id: "c", status: "studying", enrollment_date: null, tuition_end_date: null })), error: null });
  const result = await readTuitionDashboard();
  expect(api.require).toHaveBeenCalledOnce(); expect(api.rpc).toHaveBeenLastCalledWith("get_b2c_tuition_period_page", { p_query: "", p_page: 1 });
  expect(result).toHaveLength(51); expect(result[50]?.balance).toBe(123);
  expect(result[50]?.student_archived_at).toBe("2026-11-10T00:00:00Z");
  expect(result[50]?.paid_by_month).toEqual({});
  expect(api.receiptSelect).not.toHaveBeenCalled();
});
it("fails closed when an RPC page fails rather than returning partial financial totals", async () => {
  api.rpc.mockResolvedValueOnce({ data: { rows: [{ enrollment_id: "e" }], total: 2 }, error: null }).mockResolvedValueOnce({ data: null, error: { message: "failure" } });
  await expect(readTuitionDashboard()).rejects.toThrow("Không tải được học phí");
});
it("denies before reading financial data", async () => {
  api.require.mockRejectedValue(new Error("Denied"));
  await expect(readTuitionDashboard()).rejects.toThrow("Denied"); expect(api.rpc).not.toHaveBeenCalled();
});
it("rejects missing archive metadata instead of treating historical profiles as current", async () => {
  api.rpc.mockResolvedValue({ data: { rows: [{ enrollment_id: "e1" }], total: 1 }, error: null });
  await expect(readTuitionDashboard()).rejects.toThrow("trạng thái lưu trữ");
});

function financialRows(paid = 500) {
  const rows = [
    { enrollment_id: "e1", package_id: "p1", paid_amount: paid, student_archived_at: null },
    { enrollment_id: "e2", package_id: "p2", paid_amount: 0, student_archived_at: "2026-11-01T00:00:00Z" },
  ];
  api.rpc.mockResolvedValue({ data: { rows, total: rows.length }, error: null });
  api.inside.mockResolvedValue({ data: rows.map(row => ({ id: row.enrollment_id, class_id: "c", enrollment_date: "2026-01-01", tuition_end_date: null, status: "studying" })), error: null });
}

it("groups net receipt amounts by paid date, retaining cancelled months and lifetime balances", async () => {
  financialRows();
  api.range.mockResolvedValue({ data: [
    { id: "r1", package_id: "p1", paid_date: "2026-10-31", effective_amount: 200 },
    { id: "r2", package_id: "p1", paid_date: "2026-11-01", amount: 400, effective_amount: 250 },
    { id: "r3", package_id: "p1", paid_date: "2026-11-30", effective_amount: 50 },
    { id: "r4", package_id: "p2", paid_date: "2026-11-20", amount: 700, cancelled_at: "2026-12-01", effective_amount: 0 },
  ], count: 4, error: null });
  const rows = await readTuitionDashboard();
  expect(rows[0]).toMatchObject({ paid_amount: 500, paid_by_month: { "2026-10": 200, "2026-11": 300 } });
  expect(rows[1]).toMatchObject({ student_archived_at: "2026-11-01T00:00:00Z", paid_by_month: { "2026-11": 0 } });
  expect(api.receiptSelect).toHaveBeenCalledWith("id,package_id,paid_date,effective_amount", { count: "exact" });
  expect(api.receiptIn).toHaveBeenCalledWith("package_id", ["p1", "p2"]);
});

it("loads receipts beyond the API row limit without truncating monthly totals", async () => {
  financialRows(1001);
  const receipts = Array.from({ length: 1001 }, (_, i) => ({ id: `r${i}`, package_id: "p1", paid_date: "2026-11-15", effective_amount: 1 }));
  api.range.mockImplementation((from: number, to: number) => Promise.resolve({ data: receipts.slice(from, to + 1), count: 1001, error: null }));
  const rows = await readTuitionDashboard();
  expect(rows[0]?.paid_by_month).toEqual({ "2026-11": 1001 });
  expect(api.range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
  expect(api.order).toHaveBeenCalledWith("id", { ascending: true });
});

it.each([
  { data: null, count: null, error: { message: "denied" } },
  { data: [], count: null, error: null },
  { data: [], count: 2, error: null },
  { data: [{ id: "r", package_id: "outside", paid_date: "2026-11-01", effective_amount: 500 }], count: 1, error: null },
  { data: [{ id: "r", package_id: "p1", paid_date: "2026-13-01", effective_amount: 500 }], count: 1, error: null },
  { data: [{ id: "r", package_id: "p1", paid_date: "2026-11-01", effective_amount: null }], count: 1, error: null },
])("rejects incomplete or invalid receipt data instead of displaying a partial monthly total", async (response) => {
  financialRows();
  api.range.mockResolvedValue(response);
  await expect(readTuitionDashboard()).rejects.toThrow();
});

it("rejects receipt changes between pages and a mismatch with the effective balance RPC", async () => {
  financialRows();
  const receipt = { id: "r", package_id: "p1", paid_date: "2026-11-01", effective_amount: 500 };
  api.range.mockResolvedValueOnce({ data: [receipt], count: 2, error: null }).mockResolvedValueOnce({ data: [], count: 1, error: null });
  await expect(readTuitionDashboard()).rejects.toThrow("Phiếu thu vừa thay đổi");
  api.range.mockResolvedValue({ data: [{ ...receipt, effective_amount: 499 }], count: 1, error: null });
  await expect(readTuitionDashboard()).rejects.toThrow("Số tiền đã thu vừa thay đổi");
});

it("rejects duplicate receipts rather than double-counting collections", async () => {
  financialRows();
  const receipt = { id: "r", package_id: "p1", paid_date: "2026-11-01", effective_amount: 250 };
  api.range.mockResolvedValue({ data: [receipt, receipt], count: 2, error: null });
  await expect(readTuitionDashboard()).rejects.toThrow("Dữ liệu phiếu thu vừa thay đổi");
});

it("keeps separate periods of the same enrollment and attributes old receipts only to their package", async () => {
  const rows = [
    { enrollment_id: "e1", package_id: "new", period_no: 2, is_current: true, total_due: 2780000, paid_amount: 0, balance: 2780000, student_archived_at: null },
    { enrollment_id: "e1", package_id: "old", period_no: 1, is_current: false, total_due: 3695000, paid_amount: 3695000, balance: 0, student_archived_at: null },
  ];
  api.rpc.mockResolvedValue({ data: { rows, total: 2 }, error: null });
  api.inside.mockResolvedValue({ data: [{ id: "e1", class_id: "c1", status: "studying", enrollment_date: null, tuition_end_date: null }], error: null });
  api.range.mockResolvedValue({ data: [{ id: "r1", package_id: "old", paid_date: "2026-05-20", effective_amount: 3695000 }], count: 1, error: null });
  const result = await readTuitionDashboard();
  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({ package_id: "new", balance: 2780000, paid_by_month: {} });
  expect(result[1]).toMatchObject({ package_id: "old", balance: 0, paid_by_month: { "2026-05": 3695000 } });
  expect(api.inside).toHaveBeenCalledExactlyOnceWith("id", ["e1"]);
});

it("rejects duplicate period rows before summing any money", async () => {
  const row = { enrollment_id: "e1", package_id: "p1", student_archived_at: null };
  api.rpc.mockResolvedValue({ data: { rows: [row, row], total: 2 }, error: null });
  await expect(readTuitionDashboard()).rejects.toThrow("Danh sách vừa thay đổi");
  expect(api.inside).not.toHaveBeenCalled();
});
