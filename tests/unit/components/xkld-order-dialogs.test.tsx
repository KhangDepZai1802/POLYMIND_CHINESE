import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  MarketDialog,
  OrderDialog,
} from "@/features/xkld/components/order-dialogs";
const mocks = vi.hoisted(() => ({
  saveMarket: vi.fn(async () => ({ error: "Quốc gia đã tồn tại." })),
  saveOrder: vi.fn(async () => ({ success: "Saved" })),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/xkld/server/order-actions", () => ({
  saveMarketAction: mocks.saveMarket,
  saveOrderAction: mocks.saveOrder,
}));
const market = {
  id: "71000000-0000-4000-8000-000000000010",
  country_code: "SG",
  country_name: "Singapore",
  currency_code: "SGD",
  is_active: true,
  updated_at: "2026-10-14T00:00:00Z",
};
describe("order and market forms", () => {
  it("shows the full order and supplies currency when choosing a market", () => {
    render(<OrderDialog markets={[market]} />);
    fireEvent.click(screen.getByRole("button", { name: "Thêm đơn hàng" }));
    for (const label of [
      "Quốc gia / thị trường *",
      "Chủ sử dụng *",
      "Ngành nghề *",
      "Số lượng tuyển *",
      "Mức lương *",
      "Tiền tệ (SGD, JPY, TWD…) *",
      "Kỳ lương *",
      "Điều kiện tuyển *",
      "Hạn tuyển *",
      "Đối tác *",
      "Trạng thái đơn hàng *",
    ])
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Quốc gia / thị trường *"), {
      target: { value: market.id },
    });
    expect(screen.getByLabelText("Tiền tệ (SGD, JPY, TWD…) *")).toHaveValue(
      "SGD",
    );
    expect(screen.getByLabelText("Kỳ lương *")).toHaveValue("month");
  });
  it("does not offer creation if every market is disabled", () => {
    render(<OrderDialog markets={[{ ...market, is_active: false }]} />);
    expect(
      screen.getByRole("button", { name: "Thêm đơn hàng" }),
    ).toBeDisabled();
  });
  it("retains entered market data when the server rejects a duplicate", async () => {
    render(<MarketDialog />);
    fireEvent.click(screen.getByRole("button", { name: "Thêm thị trường" }));
    fireEvent.change(screen.getByLabelText("Quốc gia *"), {
      target: { value: "Singapore" },
    });
    fireEvent.change(screen.getByLabelText("Mã quốc gia (SG, JP, TW…) *"), {
      target: { value: "SG" },
    });
    fireEvent.change(
      screen.getByLabelText("Tiền tệ mặc định (SGD, JPY, TWD…) *"),
      { target: { value: "SGD" } },
    );
    fireEvent.submit(
      screen.getByRole("button", { name: "Lưu thị trường" }).closest("form")!,
    );
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Quốc gia đã tồn tại",
      ),
    );
    expect(screen.getByLabelText("Quốc gia *")).toHaveValue("Singapore");
  });
});
