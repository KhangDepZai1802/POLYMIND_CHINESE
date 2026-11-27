import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCurrency } from "@/lib/dates";

const mocks = vi.hoisted(() => ({
  save: vi.fn(),
  create: vi.fn(),
  start: vi.fn(),
  receipts: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("@/features/b2c/server/tuition-actions", () => ({
  saveB2CTuitionPackageAction: mocks.create,
  recordB2CReceiptAction: vi.fn(),
  getB2CReceiptsAction: mocks.receipts,
}));
vi.mock("@/features/b2c/server/tuition-period-actions", () => ({
  saveB2CTuitionPeriodAction: mocks.save,
  startB2CTuitionPeriodAction: mocks.start,
}));

import {
  TuitionPackageDialog,
  TuitionReceiptsDialog,
} from "@/features/b2c/components/tuition-dialogs";
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
  period_no: 1,
  is_current: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.save.mockResolvedValue({ success: "Đã lưu gói học phí." });
  mocks.create.mockResolvedValue({ success: "Đã lưu gói học phí." });
  mocks.start.mockResolvedValue({ success: "Đã tạo đợt học phí mới." });
  mocks.receipts.mockResolvedValue({ receipts: [], total: 0 });
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
      package_id: "package",
      total_due: "2780000",
      total_due_override: "",
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
    expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toHaveValue(3055000);
    expect(screen.queryByText(/Đã thu dư/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Đơn giá / buổi (VNĐ) *"), {
      target: { value: "130000" },
    });
    expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toHaveValue(4015000);
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
    fireEvent.change(screen.getByLabelText("Tổng phải thu (VNĐ) *"), {
      target: { value: "2780000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu gói học phí" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Số dư đã thay đổi",
    );
    expect(screen.getByLabelText("Số buổi *")).toHaveValue(24);
    expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toHaveValue(2780000);
    expect(screen.getByText(/Tổng đã chỉnh/)).toBeInTheDocument();
    expect(screen.getByLabelText("Lý do điều chỉnh *")).toHaveValue(
      "Điều chỉnh gói",
    );
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("saves an entered total without changing sessions, price or discount", async () => {
    open();
    fireEvent.change(screen.getByLabelText("Tổng phải thu (VNĐ) *"), {
      target: { value: "3500000" },
    });
    expect(screen.getByLabelText("Số buổi *")).toHaveValue(32);
    expect(screen.getByLabelText("Đơn giá / buổi (VNĐ) *")).toHaveValue(120000);
    expect(screen.getByLabelText("Chiết khấu (VNĐ)")).toHaveValue(145000);
    fireEvent.click(screen.getByRole("button", { name: "Lưu gói học phí" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(
      Object.fromEntries((mocks.save.mock.calls[0]?.[1] as FormData).entries()),
    ).toMatchObject({
      sessions: "32",
      unit_price: "120000",
      discount: "145000",
      total_due: "3500000",
      total_due_override: "3500000",
      expected_due: "3695000",
      expected_paid: "3695000",
    });
  });

  it("keeps the manual total after other edits until Tính lại restores calculation", async () => {
    open();
    fireEvent.change(screen.getByLabelText("Tổng phải thu (VNĐ) *"), {
      target: { value: "3500000" },
    });
    fireEvent.change(screen.getByLabelText("Số buổi *"), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByLabelText("Đơn giá / buổi (VNĐ) *"), {
      target: { value: "125000" },
    });
    fireEvent.change(screen.getByLabelText("Chiết khấu (VNĐ)"), {
      target: { value: "100000" },
    });
    expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toHaveValue(3500000);
    expect(screen.getByText(/Tổng đã chỉnh/).textContent).toContain(
      formatCurrency(2900000),
    );
    fireEvent.click(screen.getByRole("button", { name: "Tính lại" }));
    expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toHaveValue(2900000);
    expect(screen.queryByText(/Tổng đã chỉnh/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lưu gói học phí" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(
      (mocks.save.mock.calls[0]?.[1] as FormData).get("total_due_override"),
    ).toBe("");
  });

  it("reopens a saved zero total as a manual total instead of falling back to the formula", async () => {
    render(
      <TuitionPackageDialog
        row={{ ...row, total_due: 0, total_due_override: 0 }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Sửa gói học phí Học viên thử" }),
    );
    expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toHaveValue(0);
    expect(screen.getByText(/Tổng đã chỉnh/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lý do điều chỉnh *"), {
      target: { value: "Xác nhận miễn học phí" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu gói học phí" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect(
      (mocks.save.mock.calls[0]?.[1] as FormData).get("total_due_override"),
    ).toBe("0");
  });

  it.each(["", "-1", "10.5", "1000000000001"])(
    "blocks an invalid manually entered total %s",
    (value) => {
      open();
      fireEvent.change(screen.getByLabelText("Tổng phải thu (VNĐ) *"), {
        target: { value },
      });
      expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toBeInvalid();
      fireEvent.click(screen.getByRole("button", { name: "Lưu gói học phí" }));
      expect(mocks.save).not.toHaveBeenCalled();
    },
  );
});

describe("B2C separate tuition periods", () => {
  function enterNewPeriod() {
    open();
    fireEvent.click(
      screen.getByRole("button", { name: "Thêm đợt học phí mới" }),
    );
  }

  function fillNewPeriod() {
    fireEvent.change(screen.getByLabelText("Số buổi *"), {
      target: { value: "24" },
    });
    fireEvent.change(screen.getByLabelText("Đơn giá / buổi (VNĐ) *"), {
      target: { value: "120000" },
    });
    fireEvent.change(screen.getByLabelText("Chiết khấu (VNĐ)"), {
      target: { value: "100000" },
    });
    fireEvent.change(screen.getByLabelText("Lý do chiết khấu *"), {
      target: { value: "Ưu đãi đợt mới" },
    });
  }

  it("prefills editable new-period prices and keeps prior payments as separate context", async () => {
    enterNewPeriod();
    expect(screen.getByLabelText("Số buổi *")).toHaveValue(32);
    expect(screen.getByLabelText("Đơn giá / buổi (VNĐ) *")).toHaveValue(120000);
    expect(screen.getByLabelText("Chiết khấu (VNĐ)")).toHaveValue(145000);
    expect(screen.getByLabelText("Lý do chiết khấu *")).toHaveValue("Ưu đãi");
    expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toHaveValue(3695000);
    expect(screen.getByText(/Đợt mới đã thu/).textContent).toBe(
      `Đợt mới đã thu ${formatCurrency(0)}. Đợt 1 đã thu ${formatCurrency(3695000)}.`,
    );
    fillNewPeriod();
    expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toHaveValue(2780000);
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu đợt học phí mới" }),
    );
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(1));
    const payload = Object.fromEntries(
      (mocks.start.mock.calls[0]?.[1] as FormData).entries(),
    );
    expect(payload).toMatchObject({
      enrollment_id: "enrollment",
      previous_package_id: "package",
      sessions: "24",
      unit_price: "120000",
      discount: "100000",
      discount_reason: "Ưu đãi đợt mới",
      total_due: "2780000",
      total_due_override: "",
      adjustment_reason: "Tạo đợt học phí mới",
      expected_due: "3695000",
      expected_paid: "3695000",
      request_id: expect.any(String),
    });
    expect(payload).not.toHaveProperty("package_id");
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps new values and the same request id when retrying a failed request", async () => {
    mocks.start.mockResolvedValue({ error: "Vui lòng thử lại." });
    enterNewPeriod();
    fillNewPeriod();
    fireEvent.change(screen.getByLabelText("Tổng phải thu (VNĐ) *"), {
      target: { value: "2700000" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu đợt học phí mới" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Vui lòng thử lại.",
    );
    expect(screen.getByLabelText("Số buổi *")).toHaveValue(24);
    expect(screen.getByLabelText("Đơn giá / buổi (VNĐ) *")).toHaveValue(120000);
    expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toHaveValue(2700000);
    fireEvent.click(
      await screen.findByRole("button", { name: "Lưu đợt học phí mới" }),
    );
    await waitFor(() => expect(mocks.start).toHaveBeenCalledTimes(2));
    const first = mocks.start.mock.calls[0]?.[1] as FormData;
    const second = mocks.start.mock.calls[1]?.[1] as FormData;
    expect(second.get("request_id")).toBe(first.get("request_id"));
    expect(second.get("total_due_override")).toBe("2700000");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("uses a previous manually adjusted total as an editable suggestion for a new period", () => {
    render(
      <TuitionPackageDialog
        row={{ ...row, total_due: 3500000, total_due_override: 3500000 }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Sửa gói học phí Học viên thử" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Thêm đợt học phí mới" }),
    );
    expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toHaveValue(3500000);
    expect(screen.getByText(/Đợt mới đã thu/).textContent).toBe(
      `Đợt mới đã thu ${formatCurrency(0)}. Đợt 1 đã thu ${formatCurrency(3695000)}.`,
    );
    fireEvent.click(screen.getByRole("button", { name: "Tính lại" }));
    expect(screen.getByLabelText("Tổng phải thu (VNĐ) *")).toHaveValue(3695000);
  });

  it("switches back to the selected old period without copying the new price", async () => {
    enterNewPeriod();
    fillNewPeriod();
    fireEvent.click(screen.getByRole("button", { name: "Sửa đợt này" }));
    expect(screen.getByLabelText("Số buổi *")).toHaveValue(32);
    expect(screen.getByLabelText("Chiết khấu (VNĐ)")).toHaveValue(145000);
    expect(screen.queryByText(/Đợt mới đã thu/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Lý do điều chỉnh *"), {
      target: { value: "Sửa ghi chú đợt cũ" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu gói học phí" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(1));
    expect((mocks.save.mock.calls[0]?.[1] as FormData).get("package_id")).toBe(
      "package",
    );
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("allows editing a historical period but only creates next periods from the current one", () => {
    render(<TuitionPackageDialog row={{ ...row, is_current: false }} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Sửa gói học phí Học viên thử" }),
    );
    expect(
      screen.getByRole("button", { name: "Sửa đợt này" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Thêm đợt học phí mới" }),
    ).not.toBeInTheDocument();
  });

  it("retains initial package creation for an enrollment without any period", async () => {
    render(
      <TuitionPackageDialog
        row={{
          ...row,
          package_id: null,
          sessions: null,
          unit_price: null,
          discount: null,
          discount_reason: null,
          total_due: null,
          paid_amount: 0,
        }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Thêm gói học phí Học viên thử" }),
    );
    expect(screen.queryByText("Sửa đợt này")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Lưu gói học phí" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("creates the first period with an independently entered total", async () => {
    render(
      <TuitionPackageDialog
        row={{ ...row, package_id: null, total_due: null, paid_amount: 0 }}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Thêm gói học phí Học viên thử" }),
    );
    fireEvent.change(screen.getByLabelText("Tổng phải thu (VNĐ) *"), {
      target: { value: "3500000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu gói học phí" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(
      Object.fromEntries(
        (mocks.create.mock.calls[0]?.[1] as FormData).entries(),
      ),
    ).toMatchObject({
      sessions: "32",
      unit_price: "120000",
      discount: "145000",
      total_due_override: "3500000",
    });
  });

  it("shows and loads only the selected period's receipts", async () => {
    render(
      <TuitionReceiptsDialog
        row={{
          ...row,
          package_id: "new-package",
          period_no: 2,
          paid_amount: 0,
          total_due: 2780000,
          balance: 2780000,
        }}
        collector="Giáo viên thử"
        today="2026-11-26"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Phiếu thu" }));
    await waitFor(() =>
      expect(mocks.receipts).toHaveBeenCalledWith("new-package", 0),
    );
    expect(screen.getByText(/Đợt 2 · Còn phải thu/).textContent).toContain(
      formatCurrency(2780000),
    );
    expect(screen.getByLabelText("Số tiền (VNĐ) *")).toHaveAttribute(
      "max",
      "2780000",
    );
    expect(await screen.findByText("Chưa có phiếu thu.")).toBeInTheDocument();
  });
});
