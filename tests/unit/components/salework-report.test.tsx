import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SaleWorkReport } from "@/features/b2c/components/salework-report";
import {
  readSaleWorkReport,
  saveSaleWorkReport,
} from "@/features/b2c/server/salework-reports";
vi.mock("@/features/b2c/server/salework-reports", () => ({
  readSaleWorkReport: vi.fn(),
  saveSaleWorkReport: vi.fn(),
}));
const snapshot = {
  conversations: 8,
  sentMessages: 2,
  receivedMessages: 75,
  incomingCalls: 1,
  outgoingCalls: 2,
  missedCalls: 1,
  callDurationSeconds: 90,
  syncedAt: "2026-10-21T08:00:00Z",
};
describe("Daily SaleWork report", () => {
  beforeEach(() => {
    vi.mocked(readSaleWorkReport)
      .mockReset()
      .mockResolvedValue({ report: null, snapshot });
    vi.mocked(saveSaleWorkReport)
      .mockReset()
      .mockResolvedValue({ success: true });
  });
  it("loads the exact day and saves collected money with customer/course counts", async () => {
    render(
      <SaleWorkReport
        initialDate="2026-10-21"
        ownPerson="co-thy"
        manager={false}
      />,
    );
    await screen.findByText("75");
    expect(readSaleWorkReport).toHaveBeenCalledWith("co-thy", "2026-10-21");
    fireEvent.change(screen.getByLabelText("Khách đã chốt"), {
      target: { value: "3" },
    });
    fireEvent.change(screen.getByLabelText("Tiền thực thu (VNĐ)"), {
      target: { value: "2500000" },
    });
    fireEvent.change(screen.getByLabelText("Khóa đã chốt"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu báo cáo" }));
    await waitFor(() =>
      expect(saveSaleWorkReport).toHaveBeenCalledWith({
        person: "co-thy",
        date: "2026-10-21",
        closed_customers: 3,
        collected_amount: 2500000,
        closed_courses: 4,
      }),
    );
    expect(await screen.findByText("Đã lưu báo cáo.")).toBeInTheDocument();
  });
  it("allows managers to change person/day while keeping entries read-only", async () => {
    render(
      <SaleWorkReport initialDate="2026-10-21" ownPerson={null} manager />,
    );
    await screen.findByText("75");
    expect(
      screen.queryByRole("button", { name: "Lưu báo cáo" }),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tiền thực thu (VNĐ)")).toBeDisabled();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "co-thy" },
    });
    await waitFor(() =>
      expect(readSaleWorkReport).toHaveBeenCalledWith("co-thy", "2026-10-21"),
    );
    fireEvent.change(screen.getByLabelText("Ngày báo cáo"), {
      target: { value: "2026-10-20" },
    });
    await waitFor(() =>
      expect(readSaleWorkReport).toHaveBeenCalledWith("co-thy", "2026-10-20"),
    );
  });
  it("copies a draft with missing sync explicitly labelled", async () => {
    vi.mocked(readSaleWorkReport).mockResolvedValue({
      report: null,
      snapshot: null,
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    render(
      <SaleWorkReport
        initialDate="2026-10-21"
        ownPerson="co-le"
        manager={false}
      />,
    );
    await screen.findByRole("button", { name: "Sao chép báo cáo" });
    fireEvent.click(screen.getByRole("button", { name: "Sao chép báo cáo" }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Tiền thực thu: Chưa nhập"),
    );
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("Bản nháp chưa lưu"),
    );
    expect(await screen.findByText("Đã sao chép báo cáo.")).toBeInTheDocument();
  });
});
