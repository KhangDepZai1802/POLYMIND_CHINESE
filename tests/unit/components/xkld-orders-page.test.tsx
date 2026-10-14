import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), getOrders: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/features/xkld/server/orders", () => ({
  getOrders: mocks.getOrders,
}));
vi.mock("@/features/xkld/components/order-dialogs", () => ({
  MarketDialog: () => <button>Market mutation</button>,
  OrderDialog: () => <button>Order mutation</button>,
}));
import OrdersPage from "@/app/(dashboard)/workspace/xkld/orders/page";
describe("order page permissions", () => {
  beforeEach(() => {
    mocks.requireRole.mockReset();
    mocks.getOrders.mockReset();
  });
  it("keeps executive read-only", async () => {
    mocks.getOrders.mockResolvedValue({
      actor: { role: "executive" },
      rows: [],
      total: 0,
      markets: [],
      today: "2026-10-14",
    });
    render(await OrdersPage({ searchParams: Promise.resolve({}) }));
    expect(mocks.requireRole).toHaveBeenCalledWith(
      "super_admin",
      "executive",
      "xkld_staff",
    );
    expect(screen.getByText(/Chế độ chỉ xem/)).toBeInTheDocument();
    expect(screen.queryByText("Market mutation")).not.toBeInTheDocument();
    expect(screen.queryByText("Order mutation")).not.toBeInTheDocument();
  });
  it("rejects malformed filters without querying", async () => {
    render(
      await OrdersPage({ searchParams: Promise.resolve({ market: "bad" }) }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Bộ lọc không hợp lệ");
    expect(mocks.getOrders).not.toHaveBeenCalled();
  });
  it("requires role before loading private orders", async () => {
    mocks.requireRole.mockRejectedValue(new Error("denied"));
    await expect(
      OrdersPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("denied");
    expect(mocks.getOrders).not.toHaveBeenCalled();
  });
});
