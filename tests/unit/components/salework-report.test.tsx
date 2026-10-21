import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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
const fillText = vi.fn();
describe("Daily SaleWork report", () => {
  beforeEach(() => {
    fillText.mockClear();
    vi.stubGlobal("Path2D", class {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      fillText,
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      clip: vi.fn(),
      createLinearGradient: () => ({ addColorStop: vi.fn() }),
      measureText: (value: string) => ({ width: value.length * 15 }),
    } as unknown as CanvasRenderingContext2D);
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
    expect(screen.getByText("75")).toBeVisible();
    expect(screen.getByText("Cuộc gọi đến")).toBeVisible();
    expect(document.querySelector("canvas")).toBeNull();
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
  it("copies a portrait PNG with draft values and no sync timestamp", async () => {
    vi.mocked(readSaleWorkReport).mockResolvedValue({
      report: null,
      snapshot: null,
    });
    let dimensions: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      function (this: HTMLCanvasElement, callback) {
        dimensions = [this.width, this.height];
        callback(new Blob(["png"], { type: "image/png" }));
      },
    );
    Object.defineProperty(document, "fonts", {
      configurable: true,
      value: { ready: Promise.resolve() },
    });
    class ImageClipboardItem {
      constructor(public data: Record<string, Promise<Blob>>) {}
    }
    vi.stubGlobal("ClipboardItem", ImageClipboardItem);
    const write = vi.fn(async (items: ImageClipboardItem[]) => {
      expect((await items[0]!.data["image/png"]!).type).toBe("image/png");
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { write },
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
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Đã sao chép ảnh báo cáo.", {
        description: "Bạn có thể dán ảnh vào tin nhắn.",
        duration: 4000,
      }),
    );
    expect(
      screen.queryByText("Đã sao chép ảnh báo cáo."),
    ).not.toBeInTheDocument();
    expect(write).toHaveBeenCalledTimes(1);
    expect(dimensions).toEqual([1080, 1920]);
    const drawn = fillText.mock.calls.map(([text]) => text);
    expect(drawn).toContain("BÁO CÁO");
    expect(drawn).toContain("Tiền thực thu");
    expect(drawn).toContain("Chưa nhập");
    expect(drawn).toContain("Bản nháp chưa lưu");
    expect(drawn.join(" ")).not.toMatch(/BikeForce|SaleWork|Đồng bộ:/);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /^Báo cáo$/,
    );
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
});
