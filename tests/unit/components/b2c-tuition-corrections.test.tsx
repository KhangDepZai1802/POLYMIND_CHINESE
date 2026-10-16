import {
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  receipts: vi.fn(),
  history: vi.fn(),
  save: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/b2c/server/tuition-actions", () => ({
  getB2CReceiptsAction: mocks.receipts,
  getB2CCorrectionsAction: mocks.history,
  correctB2CTuitionAction: mocks.save,
}));
import { TuitionCorrectionsDialog } from "@/features/b2c/components/tuition-corrections-dialog";
const row = {
  enrollment_id: "enroll",
  student_code: "HV1",
  full_name: "Học viên thử",
  class_name: "Lớp A",
  package_id: "package",
  sessions: 10,
  unit_price: 100000,
  discount: 0,
  discount_reason: null,
  total_due: 1000000,
  paid_amount: 600000,
  balance: 400000,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.receipts.mockResolvedValue({
    total: 2,
    receipts: [
      {
        id: "receipt",
        code: "PT1",
        paid_date: "2026-10-15",
        amount: 600000,
        effective_amount: 500000,
        refunded_amount: 100000,
      },
      {
        id: "cancelled",
        code: "PT2",
        paid_date: "2026-10-15",
        amount: 100000,
        effective_amount: 0,
        cancelled_at: "2026-10-15",
      },
    ],
  });
  mocks.history.mockResolvedValue({ total: 0, rows: [] });
  mocks.save.mockResolvedValue({ success: true });
});
afterEach(cleanup);
async function open() {
  render(<TuitionCorrectionsDialog row={row} today="2026-10-16" />);
  fireEvent.click(screen.getByRole("button", { name: "Xử lý học phí" }));
  await screen.findByText("Chưa có xử lý học phí.");
}
describe("B2C tuition corrections", () => {
  it("submits a partial refund with original receipt, reason, balance snapshot and fee choice", async () => {
    await open();
    expect(
      screen.queryByRole("option", { name: /PT2/ }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Phiếu thu gốc *"), {
      target: { value: "receipt" },
    });
    fireEvent.change(screen.getByLabelText("Số tiền hoàn (VNĐ) *"), {
      target: { value: "100000" },
    });
    fireEvent.change(screen.getByLabelText("Lý do *"), {
      target: { value: "Nghỉ học" },
    });
    fireEvent.change(screen.getByLabelText("Khoản phải thu sau hoàn"), {
      target: { value: "false" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận lưu xử lý" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "refund",
          receipt_id: "receipt",
          amount: 100000,
          reason: "Nghỉ học",
          reduce_fee: false,
          expected_due: 1000000,
          expected_paid: 600000,
        }),
      ),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("keeps a rejected correction open with its reason and retry key", async () => {
    mocks.save.mockResolvedValue({ error: "Số dư đã thay đổi" });
    await open();
    fireEvent.change(screen.getByLabelText("Phiếu thu gốc *"), {
      target: { value: "receipt" },
    });
    fireEvent.change(screen.getByLabelText("Số tiền hoàn (VNĐ) *"), {
      target: { value: "100000" },
    });
    fireEvent.change(screen.getByLabelText("Lý do *"), {
      target: { value: "Nghỉ học" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận lưu xử lý" }));
    await screen.findByText("Số dư đã thay đổi");
    expect(screen.getByLabelText("Lý do *")).toHaveValue("Nghỉ học");
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận lưu xử lý" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
    expect(mocks.save.mock.calls[0]?.[0]?.request_id).toBe(
      mocks.save.mock.calls[1]?.[0]?.request_id,
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("cannot cancel a receipt that has already been partially refunded", async () => {
    await open();
    fireEvent.change(screen.getByLabelText("Thao tác"), {
      target: { value: "cancel" },
    });
    expect(
      screen.queryByRole("option", { name: /PT1/ }),
    ).not.toBeInTheDocument();
  });
  it("shows a recoverable load error and keeps saving disabled", async () => {
    mocks.history.mockRejectedValue(new Error("Không tải được lịch sử"));
    render(<TuitionCorrectionsDialog row={row} today="2026-10-16" />);
    fireEvent.click(screen.getByRole("button", { name: "Xử lý học phí" }));
    await screen.findByText("Không tải được lịch sử");
    expect(
      screen.getByRole("button", { name: "Xác nhận lưu xử lý" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Thử tải lại" }),
    ).toBeInTheDocument();
  });
});
