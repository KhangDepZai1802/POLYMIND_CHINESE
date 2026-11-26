import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNavigationGroups } from "@/lib/permissions/navigation";
const mocks = vi.hoisted(() => ({ user: vi.fn(), rpc: vi.fn(), redirect: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireUser: mocks.user }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: mocks.rpc }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { readCenterTuitionDashboard } from "@/features/b2c/server/center-tuition";

describe("center tuition teacher access", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.user.mockResolvedValue({ id: "teacher", role: "teacher" });
    mocks.redirect.mockImplementation(() => { throw new Error("redirect"); });
  });
  it("denies ungranted teachers before reading data", async () => {
    mocks.rpc.mockResolvedValue(false);
    await expect(readCenterTuitionDashboard()).rejects.toThrow("redirect");
    expect(mocks.redirect).toHaveBeenCalledWith("/teacher");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("has_b2c_permission", { p_key: "manage_center_tuition" });
  });
  it("collects all pages for sixty enrollments", async () => {
    mocks.rpc.mockResolvedValueOnce(true)
      .mockResolvedValueOnce({ total: 60, rows: Array.from({ length: 50 }, (_, i) => ({ enrollment_id: `e${i}`, student_archived_at: null, package_id: null, paid_amount: 0 })) })
      .mockResolvedValueOnce({ total: 60, rows: Array.from({ length: 10 }, (_, i) => ({ enrollment_id: `e${i+50}`, student_archived_at: "2026-11-10T00:00:00Z", package_id: null, paid_amount: 0 })) })
      .mockResolvedValueOnce(true);
    expect(await readCenterTuitionDashboard()).toHaveLength(60);
    expect(mocks.rpc).toHaveBeenNthCalledWith(3, "read_center_b2c_tuition_period_page", { p_query: "", p_page: 1 });
    expect(mocks.rpc).toHaveBeenLastCalledWith("has_b2c_permission", { p_key: "manage_center_tuition" });
  });
  it("rejects missing archive metadata for the teacher projection too", async () => {
    mocks.rpc.mockResolvedValueOnce(true).mockResolvedValueOnce({ total: 1, rows: [{ enrollment_id: "e1" }] });
    await expect(readCenterTuitionDashboard()).rejects.toThrow("trạng thái lưu trữ");
  });
  it("only shows the tuition link with explicit global permission", () => {
    const links = (granted: boolean) => getNavigationGroups("teacher", { canManageCenterTuition: granted }).flatMap(g => g.items.map(i => i.href));
    expect(links(false)).not.toContain("/teacher/tuition");
    expect(links(true)).toContain("/teacher/tuition");
    expect(links(false)).not.toContain("/teacher/tuition");
  });

  const receipt = (id: string, paid_date = "2026-11-01", effective_amount = 10) => ({ id, paid_date, effective_amount });
  function mockFinancialData(readReceipts: (packageId: string, page: number) => unknown, paid = 210) {
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "has_b2c_permission") return true;
      if (name === "read_center_b2c_tuition_period_page") return { total: 3, rows: [
        { enrollment_id: "e1", package_id: "p1", paid_amount: paid, balance: 300, student_archived_at: null },
        { enrollment_id: "e2", package_id: "p2", paid_amount: 0, balance: 500, student_archived_at: "2026-11-10T00:00:00Z" },
        { enrollment_id: "e3", package_id: null, paid_amount: 0, balance: 0, student_archived_at: null },
      ] };
      if (name === "read_b2c_permitted_receipts") return readReceipts(args.p_package_id, args.p_page);
      throw new Error(`Unexpected RPC: ${name}`);
    });
  }

  it("loads every permitted receipt page and keeps monthly net amounts separate from lifetime balances", async () => {
    const receipts = Array.from({ length: 21 }, (_, i) => receipt(`r${i}`, i === 0 ? "2026-10-31" : "2026-11-01"));
    mockFinancialData((id, page) => id === "p1"
      ? { total: 21, receipts: receipts.slice(page * 20, page * 20 + 20) }
      : { total: 1, receipts: [{ ...receipt("cancelled", "2026-11-30", 0), amount: 500, cancelled_at: "2026-12-01" }] });
    const rows = await readCenterTuitionDashboard();
    expect(rows[0]).toMatchObject({ paid_amount: 210, balance: 300, paid_by_month: { "2026-10": 10, "2026-11": 200 } });
    expect(rows[1]).toMatchObject({ paid_amount: 0, paid_by_month: { "2026-11": 0 } });
    expect(rows[2]?.paid_by_month).toEqual({});
    expect(mocks.rpc).toHaveBeenCalledWith("read_b2c_permitted_receipts", { p_package_id: "p1", p_page: 1 });
  });

  it("uses effective_amount after partial refunds without subtracting the refund again", async () => {
    mockFinancialData(id => ({ total: id === "p1" ? 1 : 0, receipts: id === "p1" ? [{ ...receipt("refunded", "2026-11-01", 70), amount: 100, refunded_amount: 30 }] : [] }), 70);
    expect((await readCenterTuitionDashboard())[0]?.paid_by_month).toEqual({ "2026-11": 70 });
  });

  it.each([
    null,
    { total: null, receipts: [] },
    { total: 1, receipts: [] },
    { total: 21, receipts: [receipt("partial")] },
    { total: 1, receipts: [receipt("date", "2026-13-01")] },
    { total: 1, receipts: [{ ...receipt("missing"), effective_amount: null }] },
    { total: 1, receipts: [receipt("negative", "2026-11-01", -1)] },
    { total: 2, receipts: [receipt("duplicate"), receipt("duplicate")] },
    { total: 0, receipts: [receipt("extra")] },
  ])("rejects incomplete or invalid receipt data", async batch => {
    mockFinancialData(() => batch);
    await expect(readCenterTuitionDashboard()).rejects.toThrow();
  });

  it("rejects changed counts across pages and a mismatch with the dashboard total", async () => {
    mockFinancialData((id, page) => id === "p2" ? { total: 0, receipts: [] } : {
      total: page === 0 ? 21 : 20,
      receipts: page === 0 ? Array.from({ length: 20 }, (_, i) => receipt(`r${i}`)) : [],
    });
    await expect(readCenterTuitionDashboard()).rejects.toThrow("Phiếu thu vừa thay đổi");
    mockFinancialData(() => ({ total: 0, receipts: [] }));
    await expect(readCenterTuitionDashboard()).rejects.toThrow("Số tiền đã thu vừa thay đổi");
  });

  it("rejects receipt RPC failures rather than returning a partial result", async () => {
    mockFinancialData(() => { throw new Error("Không có quyền xem phiếu thu."); });
    await expect(readCenterTuitionDashboard()).rejects.toThrow("Không có quyền xem phiếu thu");
  });

  it("checks center access again after reading receipts to catch revoked scope", async () => {
    mockFinancialData(() => ({ total: 0, receipts: [] }), 0);
    const previous = mocks.rpc.getMockImplementation()!;
    let checks = 0;
    mocks.rpc.mockImplementation((name, args) => name === "has_b2c_permission"
      ? Promise.resolve(++checks === 1) : previous(name, args));
    await expect(readCenterTuitionDashboard()).rejects.toThrow("redirect");
    expect(checks).toBe(2);
  });

  it("retains both periods of one enrollment without carrying previous receipts into new debt", async () => {
    mocks.rpc.mockImplementation(async (name, args) => {
      if (name === "has_b2c_permission") return true;
      if (name === "read_center_b2c_tuition_period_page") return { total: 2, rows: [
        { enrollment_id: "e1", package_id: "new", period_no: 2, is_current: true, paid_amount: 0, balance: 2780000, student_archived_at: null },
        { enrollment_id: "e1", package_id: "old", period_no: 1, is_current: false, paid_amount: 3695000, balance: 0, student_archived_at: null },
      ] };
      if (name === "read_b2c_permitted_receipts") return args.p_package_id === "old"
        ? { total: 1, receipts: [receipt("old-receipt", "2026-05-20", 3695000)] }
        : { total: 0, receipts: [] };
      throw new Error(`Unexpected RPC: ${name}`);
    });
    const rows = await readCenterTuitionDashboard();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ package_id: "new", balance: 2780000, paid_by_month: {} });
    expect(rows[1]).toMatchObject({ package_id: "old", balance: 0, paid_by_month: { "2026-05": 3695000 } });
  });

  it("rejects duplicated package rows in a teacher period page", async () => {
    const row = { enrollment_id: "e1", package_id: "p1", student_archived_at: null };
    mocks.rpc.mockResolvedValueOnce(true).mockResolvedValueOnce({ total: 2, rows: [row, row] });
    await expect(readCenterTuitionDashboard()).rejects.toThrow("Danh sách vừa thay đổi");
    expect(mocks.rpc).not.toHaveBeenCalledWith("read_b2c_permitted_receipts", expect.anything());
  });
});
