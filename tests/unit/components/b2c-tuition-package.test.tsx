import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCurrency } from "@/lib/dates";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("@/features/b2c/server/tuition-actions", () => ({
  saveB2CTuitionPackageAction: mocks.save,
  recordB2CReceiptAction: vi.fn(),
  getB2CReceiptsAction: vi.fn(),
}));

import { TuitionPackageDialog } from "@/features/b2c/components/tuition-dialogs";
import { ClassWorkspaceRefreshContext } from "@/features/b2c/components/class-workspace-refresh";

const row = {
  enrollment_id: "enrollment",
  student_code: "TEST",
  full_name: "Học viên thử",
  class_name: "Lớp thử",
  package_id: "package",
  sessions: 32,
  unit_price: 120000,
  discount: 145000,
  discount_reason: "Ưu đãi",
  total_due: 3695000,
  paid_amount: 3695000,
  balance: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({ success: "Đã lưu gói học phí." });
});
afterEach(cleanup);

function open() {
  render(
    <ClassWorkspaceRefreshContext.Provider value={mocks.refresh}>
      <TuitionPackageDialog row={row} />
    </ClassWorkspaceRefreshContext.Provider>,
  );
  fireEvent.click(
    screen.getByRole("button", { name: "Sửa gói học phí Học viên thử" }),
  );
  fireEvent.change(screen.getByLabelText("Lý do điều chỉnh *"), {
    target: { value: "Điều chỉnh gói" },
  });
}

describe("B2C flexible package pricing", () => {
  it("saves a fee below historical paid without treating the difference as overpayment", async () => {
    open();
    fireEvent.change(screen.getByLabelText("Số buổi *"), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByLabelText("Chiết khấu (VNĐ)"), {
      target: { value: "100000" },
    });
    expect(screen.queryByText(/Đã thu dư/)).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Tổng phải thu không được/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lưu gói học phí" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(
      Object.fromEntries((mocks.save.mock.calls[0]?.[1] as FormData).entries()),
    ).toMatchObject({
      sessions: "24",
      unit_price: "120000",
      discount: "100000",
      expected_due: "3695000",
      expected_paid: "3695000",
      adjustment_reason: "Điều chỉnh gói",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("updates the total freely as the entered unit price changes", () => {
    open();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Đơn giá / buổi (VNĐ) *"), {
      target: { value: "100000" },
    });
    expect(screen.getByText(/Tổng phải thu:/).textContent).toContain(
      formatCurrency(3055000),
    );
    expect(screen.queryByText(/Đã thu dư/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Đơn giá / buổi (VNĐ) *"), {
      target: { value: "130000" },
    });
    expect(screen.getByText(/Tổng phải thu:/).textContent).toContain(
      formatCurrency(4015000),
    );
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("keeps invalid negative fees blocked by the discount limit", () => {
    open();
    fireEvent.change(screen.getByLabelText("Chiết khấu (VNĐ)"), {
      target: { value: "3840001" },
    });
    expect(screen.getByLabelText("Chiết khấu (VNĐ)")).toBeInvalid();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lưu gói học phí" }));
    expect(mocks.save).not.toHaveBeenCalled();
  });

  it("preserves entered values if the server rejects a stale balance", async () => {
    mocks.save.mockResolvedValue({
      error: "Số dư đã thay đổi. Vui lòng tải lại.",
    });
    open();
    fireEvent.change(screen.getByLabelText("Số buổi *"), {
      target: { value: "24" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu gói học phí" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Số dư đã thay đổi",
    );
    expect(screen.getByLabelText("Số buổi *")).toHaveValue(24);
    expect(screen.getByLabelText("Lý do điều chỉnh *")).toHaveValue(
      "Điều chỉnh gói",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
