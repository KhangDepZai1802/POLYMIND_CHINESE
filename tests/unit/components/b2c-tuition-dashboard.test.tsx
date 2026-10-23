import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/features/b2c/components/tuition-dialogs", () => ({ TuitionPackageDialog: () => <button>Tạo/sửa gói</button>, TuitionReceiptsDialog: () => <button>Phiếu thu</button> }));
vi.mock("@/features/b2c/components/tuition-corrections-dialog", () => ({ TuitionCorrectionsDialog: () => <button>Xử lý học phí</button> }));
import { TuitionDashboard } from "@/features/b2c/components/tuition-dashboard";
import type { TuitionDashboardRow } from "@/features/b2c/domain/tuition-dashboard";
const row: TuitionDashboardRow = { enrollment_id: "e1", student_code: "HV1", full_name: "An", class_name: "Movers", class_id: "c1", enrollment_date: "2026-10-01", tuition_end_date: "2026-10-17", status: "studying", package_id: "p1", sessions: 10, unit_price: 100000, discount: 0, discount_reason: null, total_due: 1000000, paid_amount: 400000, balance: 600000 };
const other: TuitionDashboardRow = { ...row, enrollment_id: "e2", student_code: "HV2", full_name: "Bình", class_id: "c2", class_name: "Flyers", package_id: null, sessions: null, total_due: null, unit_price: null, discount: null, paid_amount: 0, balance: 0, tuition_end_date: null, enrollment_date: "2026-09-01" };
afterEach(cleanup);
it("lets tuition teachers enter packages and receipts without manager correction controls", () => {
  render(<TuitionDashboard rows={[row, other]} collector="Cô Thy" canReadHistory={false} canCorrect={false} today="2026-10-23" />);
  expect(screen.getAllByRole("button", { name: "Tạo/sửa gói" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "Phiếu thu" })).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Xử lý học phí" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Nhật ký" })).not.toBeInTheDocument();
});
function mount(rows = [row, other]) { render(<TuitionDashboard rows={rows} collector="Quản lý" canReadHistory today="2026-10-17" />); }
it.each(["Tổng phải thu", "Đã thu", "Còn phải thu"])("opens a matching financial list for the %s card", (label) => {
  mount([row, other, { ...row, enrollment_id: "e3", student_code: "HV3", full_name: "Chi", paid_amount: 1000000, balance: 0 }]);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}\\s*\\d`) }));
  const popup = within(screen.getByRole("dialog"));
  expect(popup.getByText("An")).toBeInTheDocument(); expect(popup.queryByText("Bình")).not.toBeInTheDocument();
  if (label === "Còn phải thu") expect(popup.queryByText("Chi")).not.toBeInTheDocument();
  else expect(popup.getByText("Chi")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Lọc trạng thái học phí", hidden: true })).toHaveValue("all");
});
it("opens an empty money card and preserves the table when the popup closes", () => {
  mount([other]); fireEvent.click(screen.getByRole("button", { name: /^Đã thu\s*0/ }));
  const popup = within(screen.getByRole("dialog"));
  expect(popup.getByText("Chưa có ghi danh trong nhóm này.")).toBeInTheDocument();
  fireEvent.click(popup.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(within(screen.getByRole("table")).getByText("Bình")).toBeInTheDocument();
});
it("paginates and searches the financial card list", () => {
  mount(Array.from({ length: 21 }, (_, i) => ({ ...row, enrollment_id: `p${i}`, student_code: `HV${i}`, full_name: `Học viên ${String(i).padStart(2, "0")}` })));
  fireEvent.click(screen.getByRole("button", { name: /^Còn phải thu/ }));
  const popup = within(screen.getByRole("dialog"));
  expect(popup.getAllByRole("row")).toHaveLength(21);
  fireEvent.click(popup.getByRole("button", { name: "Sau" })); expect(popup.getAllByRole("row")).toHaveLength(2);
  fireEvent.change(popup.getByRole("textbox", { name: "Tìm trong danh sách học phí" }), { target: { value: "Học viên 00" } });
  expect(popup.getByText("Học viên 00")).toBeInTheDocument(); expect(popup.getAllByRole("row")).toHaveLength(2);
});
it("opens an accurate attention list and leaves unconfigured rows out of debt", () => {
  mount(); fireEvent.click(screen.getByRole("button", { name: /Học viên cần xử lý\s*1 học viên/ }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("An")).toBeInTheDocument(); expect(dialog.queryByText("Bình")).not.toBeInTheDocument();
});
it("filters by class, period, and status while keeping totals in sync", () => {
  mount(); fireEvent.change(screen.getByRole("combobox", { name: "Lọc trạng thái học phí" }), { target: { value: "unconfigured" } });
  const table = within(screen.getByRole("table")); expect(table.getByText("Bình")).toBeInTheDocument(); expect(table.queryByText("An")).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc lớp" }), { target: { value: "c1" } });
  expect(screen.getByText("Chưa có ghi danh phù hợp với bộ lọc.")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc trạng thái học phí" }), { target: { value: "all" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc kỳ ghi danh" }), { target: { value: "2026-10" } });
  expect(within(screen.getByRole("table")).getByText("An")).toBeInTheDocument();
});
it("selects visible rows to show actual selected debt and sorts students", () => {
  mount(); fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả trên trang" }));
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 2 ghi danh"); expect(screen.getByRole("status")).toHaveTextContent("600.000");
  fireEvent.click(screen.getByRole("button", { name: "Học viên" }));
  const first = within(screen.getByRole("table")).getAllByRole("row")[1];
  expect(first).toHaveTextContent("Bình");
});
it("paginates table and treats anonymous account history as a separate permission", () => {
  render(<TuitionDashboard rows={Array.from({ length: 26 }, (_, i) => ({ ...row, enrollment_id: `e${i}`, student_code: `HV${i}`, full_name: `Học viên ${String(i).padStart(2, "0")}` }))} collector="Giáo vụ" canReadHistory={false} today="2026-10-17" />);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(26);
  expect(screen.queryByRole("link", { name: "Nhật ký" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sau" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
});
