import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/features/b2c/server/archive-actions", () => ({ archiveCenterRecordAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/b2c/components/tuition-dialogs", () => ({ TuitionPackageDialog: () => <button>Tạo/sửa gói</button>, TuitionReceiptsDialog: ({ row }: { row: { paid_amount: number } }) => <button data-paid-amount={row.paid_amount}>Phiếu thu</button> }));
vi.mock("@/features/b2c/components/tuition-corrections-dialog", () => ({ TuitionCorrectionsDialog: () => <button>Xử lý học phí</button> }));
const teacherPage = vi.hoisted(() => ({ access: vi.fn(), rows: vi.fn(), rpc: vi.fn() }));
vi.mock("@/features/b2c/server/center-tuition", () => ({ requireCenterTuitionAccess: teacherPage.access, readCenterTuitionDashboard: teacherPage.rows }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: teacherPage.rpc }));
import { TuitionDashboard } from "@/features/b2c/components/tuition-dashboard";
import TeacherTuitionPage from "@/app/(dashboard)/teacher/tuition/page";
import type { TuitionDashboardRow } from "@/features/b2c/domain/tuition-dashboard";
const row: TuitionDashboardRow = { enrollment_id: "e1", student_code: "HV1", full_name: "An", class_name: "Movers", class_id: "c1", enrollment_date: "2026-10-01", tuition_end_date: "2026-10-17", status: "studying", student_archived_at: null, package_id: "p1", sessions: 10, unit_price: 100000, discount: 0, discount_reason: null, total_due: 1000000, paid_amount: 400000, balance: 600000 };
const other: TuitionDashboardRow = { ...row, enrollment_id: "e2", student_code: "HV2", full_name: "Bình", class_id: "c2", class_name: "Flyers", package_id: null, sessions: null, total_due: null, unit_price: null, discount: null, paid_amount: 0, balance: 0, tuition_end_date: null, enrollment_date: "2026-09-01" };
afterEach(cleanup);
it("only offers deletion for an existing package with explicit delete permission", () => {
  const view = render(<TuitionDashboard rows={[row, other]} collector="Cô Lê" canReadHistory={false} canCorrect={false} today="2026-10-26" />);
  expect(screen.queryByRole("button", { name: /Xóa gói học phí/ })).not.toBeInTheDocument();
  view.rerender(<TuitionDashboard rows={[row, other]} collector="Cô Lê" canReadHistory={false} canCorrect canDelete today="2026-10-26" />);
  expect(screen.getAllByRole("button", { name: /Xóa gói học phí/ })).toHaveLength(1);
  expect(screen.getAllByRole("button", { name: "Xử lý học phí" })).toHaveLength(2);
});
it("lets tuition teachers enter packages and receipts without manager correction controls", () => {
  render(<TuitionDashboard rows={[row, other]} collector="Cô Thy" canReadHistory={false} canCorrect={false} today="2026-10-23" />);
  expect(screen.getAllByRole("button", { name: "Tạo/sửa gói" })).toHaveLength(2);
  expect(screen.getAllByRole("button", { name: "Phiếu thu" })).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Xử lý học phí" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Nhật ký" })).not.toBeInTheDocument();
});
function mount(rows = [row, other]) { render(<TuitionDashboard rows={rows} collector="Quản lý" canReadHistory today="2026-10-17" />); }
it.each(["Quản lý", "Cô Lê", "Cô Thy"])("hides archived and ended enrollments by default for %s while keeping history accessible", (collector) => {
  const archived = { ...other, enrollment_id: "old", student_code: "HV-OLD", student_archived_at: "2026-11-10T00:00:00Z" };
  const withdrawn = { ...other, enrollment_id: "left", student_code: "HV-LEFT", status: "withdrawn" };
  render(<TuitionDashboard rows={[row, other, archived, withdrawn]} collector={collector} canReadHistory={collector === "Quản lý"} today="2026-11-23" />);
  const table = within(screen.getByRole("table"));
  expect(table.queryByText("HV-OLD")).not.toBeInTheDocument();
  expect(table.queryByText("HV-LEFT")).not.toBeInTheDocument();
  expect(screen.getByText(/2 kết quả · 1 chưa có gói/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc tình trạng theo học" }), { target: { value: "history" } });
  expect(table.getByText("HV-OLD")).toBeInTheDocument();
  expect(table.getByText("Đã lưu trữ")).toBeInTheDocument();
  expect(table.getByText("HV-LEFT")).toBeInTheDocument();
  expect(table.getByText("Nghỉ")).toBeInTheDocument();
  expect(table.queryByText("HV1")).not.toBeInTheDocument();
  expect(screen.getByText(/2 kết quả · 2 chưa có gói/)).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc tình trạng theo học" }), { target: { value: "all" } });
  expect(table.getAllByRole("row")).toHaveLength(5);
  expect(screen.getByText(/4 kết quả · 3 chưa có gói/)).toBeInTheDocument();
});
it("keeps archived debt in historical totals and receipts without renewal reminders", () => {
  mount([other, { ...row, student_archived_at: "2026-11-10T00:00:00Z" }]);
  expect(screen.getByRole("button", { name: /^Còn phải thu\s*0/ })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc tình trạng theo học" }), { target: { value: "history" } });
  expect(screen.getByRole("button", { name: /^Còn phải thu\s*600.000/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Phiếu thu" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả trên trang" }));
  fireEvent.click(screen.getByRole("button", { name: /Học viên cần xử lý\s*1 học viên/ }));
  expect(within(screen.getByRole("dialog")).queryByText("Cần tái phí")).not.toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc tình trạng theo học" }), { target: { value: "current" } });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
it("filters before pagination and updates a profile that is archived after loading", () => {
  const archivedRows = Array.from({ length: 30 }, (_, i) => ({ ...other, enrollment_id: `old${i}`, student_code: `OLD${i}`, student_archived_at: "2026-11-10T00:00:00Z" }));
  const view = render(<TuitionDashboard rows={[...archivedRows, row]} collector="Quản lý" canReadHistory today="2026-11-23" />);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  expect(screen.getByText("Trang 1/1 · 1 kết quả")).toBeInTheDocument();
  view.rerender(<TuitionDashboard rows={[...archivedRows, { ...row, student_archived_at: "2026-11-23T00:00:00Z" }]} collector="Quản lý" canReadHistory today="2026-11-23" />);
  expect(screen.getByText("Chưa có học phí phù hợp với bộ lọc.")).toBeInTheDocument();
});
it.each(["Tổng phải thu", "Đã thu", "Còn phải thu"])("opens a matching financial list for the %s card", (label) => {
  mount([row, other, { ...row, enrollment_id: "e3", package_id: "p3", student_code: "HV3", full_name: "Chi", paid_amount: 1000000, balance: 0 }]);
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
  expect(popup.getByText("Chưa có đợt học phí trong nhóm này.")).toBeInTheDocument();
  fireEvent.click(popup.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(within(screen.getByRole("table")).getByText("Bình")).toBeInTheDocument();
});
it("paginates and searches the financial card list", () => {
  mount(Array.from({ length: 21 }, (_, i) => ({ ...row, enrollment_id: `p${i}`, package_id: `package${i}`, student_code: `HV${i}`, full_name: `Học viên ${String(i).padStart(2, "0")}` })));
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
  expect(screen.getByText("Chưa có học phí phù hợp với bộ lọc.")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc trạng thái học phí" }), { target: { value: "all" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc kỳ ghi danh" }), { target: { value: "2026-10" } });
  expect(within(screen.getByRole("table")).getByText("An")).toBeInTheDocument();
});
it("selects visible rows to show actual selected debt and sorts students", () => {
  mount(); fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả trên trang" }));
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 2 đợt học phí"); expect(screen.getByRole("status")).toHaveTextContent("600.000");
  fireEvent.click(screen.getByRole("button", { name: "Học viên" }));
  const first = within(screen.getByRole("table")).getAllByRole("row")[1];
  expect(first).toHaveTextContent("Bình");
});
it("paginates table and treats anonymous account history as a separate permission", () => {
  render(<TuitionDashboard rows={Array.from({ length: 26 }, (_, i) => ({ ...row, enrollment_id: `e${i}`, package_id: `package${i}`, student_code: `HV${i}`, full_name: `Học viên ${String(i).padStart(2, "0")}` }))} collector="Giáo vụ" canReadHistory={false} today="2026-10-17" />);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(26);
  expect(screen.queryByRole("link", { name: "Nhật ký" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Sau" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
});

it("filters receipts by month and keeps table, cards, popup and monthly sorting consistent", () => {
  const an = { ...row, paid_by_month: { "2026-10": 100000, "2026-11": 300000 } };
  const binh = { ...row, enrollment_id: "e2", student_code: "HV2", full_name: "Bình", class_id: "c2", class_name: "Flyers", enrollment_date: "2026-09-01", package_id: "p2", paid_amount: 900000, balance: 100000, paid_by_month: { "2026-09": 700000, "2026-11": 200000 } };
  const chi = { ...row, enrollment_id: "e3", student_code: "HV3", full_name: "Chi", package_id: "p3", paid_by_month: { "2026-10": 400000 } };
  const noPackage = { ...other, enrollment_id: "e4", student_code: "HV4", full_name: "Dũng", paid_by_month: {} };
  render(<TuitionDashboard rows={[an, binh, chi, noPackage]} collector="Quản lý" today="2026-11-26" canReadHistory enableReceiptMonthFilter />);
  fireEvent.change(screen.getByLabelText("Lọc tháng thu tiền"), { target: { value: "2026-11" } });
  const table = within(screen.getByRole("table"));
  expect(table.getByText("An")).toBeInTheDocument();
  expect(table.getByText("Bình")).toBeInTheDocument();
  expect(table.queryByText("Chi")).not.toBeInTheDocument();
  expect(table.queryByText("Dũng")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Thu ròng trong tháng\s*500.000/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Phải thu toàn gói\s*2.000.000/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Còn nợ toàn gói\s*700.000/ })).toBeInTheDocument();
  const anRow = within(table.getAllByRole("row").find(r => r.textContent?.includes("HV1"))!);
  expect(anRow.getByRole("button", { name: "Phiếu thu" })).toHaveAttribute("data-paid-amount", "400000");
  expect(anRow.getByText(/Toàn gói: 400.000/)).toBeInTheDocument();
  fireEvent.click(table.getByRole("button", { name: "Thu ròng trong tháng" }));
  expect(table.getAllByRole("row")[1]).toHaveTextContent("Bình");
  fireEvent.click(screen.getByRole("button", { name: /^Thu ròng trong tháng\s*500.000/ }));
  const popup = within(screen.getByRole("dialog"));
  expect(popup.getByText(/2 đợt học phí · 500.000/)).toHaveTextContent("Phiếu thu tháng 11/2026");
  expect(popup.queryByText("Chi")).not.toBeInTheDocument();
  expect(popup.getByText(/Toàn gói: 400.000/)).toBeInTheDocument();
  fireEvent.click(popup.getByRole("button", { name: "Close" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc lớp" }), { target: { value: "c2" } });
  expect(screen.getByRole("button", { name: /^Thu ròng trong tháng\s*200.000/ })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc lớp" }), { target: { value: "all" } });
  fireEvent.change(screen.getByLabelText("Lọc tháng thu tiền"), { target: { value: "2026-12" } });
  expect(screen.getByRole("button", { name: /^Thu ròng trong tháng\s*0/ })).toBeInTheDocument();
  expect(screen.getByText("Chưa có học phí phù hợp với bộ lọc.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tất cả tháng" }));
  expect(screen.getByLabelText("Lọc tháng thu tiền")).toHaveValue("");
  expect(screen.getByRole("button", { name: /^Đã thu\s*1.700.000/ })).toBeInTheDocument();
  expect(table.getByText("Dũng")).toBeInTheDocument();
});

it("resets page and selection on month change and keeps historical receipts accessible", () => {
  const earlier = Array.from({ length: 26 }, (_, i) => ({ ...row, enrollment_id: `e${i}`, package_id: `package${i}`, student_code: `HV${i}`, full_name: `Học viên ${i}`, paid_by_month: { "2026-10": 400000 } }));
  const current = { ...row, enrollment_id: "nov", package_id: "p-nov", student_code: "NOV", full_name: "Tháng mười một", paid_by_month: { "2026-11": 400000 } };
  const archived = { ...row, enrollment_id: "old", package_id: "p-old", student_code: "OLD", full_name: "Hồ sơ cũ", student_archived_at: "2026-11-25T00:00:00Z", paid_by_month: { "2026-10": 300000, "2026-11": 100000 } };
  render(<TuitionDashboard rows={[...earlier, current, archived]} collector="Quản lý" today="2026-11-26" canReadHistory enableReceiptMonthFilter />);
  fireEvent.click(screen.getByRole("button", { name: "Sau" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả trên trang" }));
  expect(screen.getByRole("status")).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Lọc tháng thu tiền"), { target: { value: "2026-11" } });
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
  expect(screen.getByText("Trang 1/1 · 1 kết quả")).toBeInTheDocument();
  expect(within(screen.getByRole("table")).getByText("NOV")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Thu ròng trong tháng\s*400.000/ })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc tình trạng theo học" }), { target: { value: "history" } });
  expect(within(screen.getByRole("table")).getByText("OLD")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Thu ròng trong tháng\s*100.000/ })).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc tình trạng theo học" }), { target: { value: "all" } });
  expect(screen.getByRole("button", { name: /^Thu ròng trong tháng\s*500.000/ })).toBeInTheDocument();
});

it("keeps the filter hidden for callers that do not opt into monthly receipt data", () => {
  mount();
  expect(screen.queryByLabelText("Lọc tháng thu tiền")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Đã thu\s*400.000/ })).toBeInTheDocument();
});

it("selects and filters independent tuition periods for the same student", () => {
  const prior = { ...row, package_id: "old", period_no: 1, is_current: false, total_due: 3695000, paid_amount: 3695000, balance: 0, paid_by_month: { "2026-05": 3695000 } };
  const current = { ...row, package_id: "new", period_no: 2, is_current: true, total_due: 2780000, paid_amount: 0, balance: 2780000, paid_by_month: {} };
  render(<TuitionDashboard rows={[prior, current]} collector="Cô Thy" today="2026-11-26" canReadHistory={false} enableReceiptMonthFilter />);
  const table = within(screen.getByRole("table"));
  expect(table.getAllByRole("row")).toHaveLength(3);
  expect(table.getAllByRole("row")[1]).toHaveTextContent("Đợt 2 · Hiện tại");
  const newCheckbox = table.getByRole("checkbox", { name: /Chọn An.*Đợt 2/ });
  const oldCheckbox = table.getByRole("checkbox", { name: /Chọn An.*Đợt 1/ });
  fireEvent.click(newCheckbox);
  expect(newCheckbox).toBeChecked();
  expect(oldCheckbox).not.toBeChecked();
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 1 đợt học phí");
  expect(screen.getByRole("status")).toHaveTextContent("2.780.000");
  fireEvent.click(oldCheckbox);
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 2 đợt học phí");
  fireEvent.change(screen.getByLabelText("Lọc tháng thu tiền"), { target: { value: "2026-05" } });
  expect(table.getByText("Đợt 1 · Đợt trước")).toBeInTheDocument();
  expect(table.queryByText("Đợt 2 · Hiện tại")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Thu ròng trong tháng\s*3.695.000/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Còn nợ toàn gói\s*0/ })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Thu ròng trong tháng\s*3.695.000/ }));
  expect(within(screen.getByRole("dialog")).getByText("Đợt 1 · Đợt trước")).toBeInTheDocument();
});

it.each(["Cô Lê", "Cô Thy"])("lets %s use the teacher page month filter without adding correction or history access", async fullName => {
  teacherPage.access.mockResolvedValue({ fullName });
  teacherPage.rpc.mockResolvedValue(false);
  teacherPage.rows.mockResolvedValue([{ ...row, paid_by_month: { "2026-10": 300000, "2026-11": 100000 } }]);
  render(await TeacherTuitionPage());
  fireEvent.change(screen.getByLabelText("Lọc tháng thu tiền"), { target: { value: "2026-11" } });
  expect(screen.getByRole("button", { name: /^Thu ròng trong tháng\s*100.000/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Còn nợ toàn gói\s*600.000/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Phiếu thu" })).toHaveAttribute("data-paid-amount", "400000");
  expect(screen.queryByRole("button", { name: "Xử lý học phí" })).not.toBeInTheDocument();
  expect(screen.queryByRole("link", { name: "Nhật ký" })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /^Thu ròng trong tháng\s*100.000/ }));
  expect(within(screen.getByRole("dialog")).getByText(/1 đợt học phí · 100.000/)).toBeInTheDocument();
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Close" }));
  fireEvent.click(screen.getByRole("button", { name: "Tất cả tháng" }));
  expect(screen.getByRole("button", { name: /^Đã thu\s*400.000/ })).toBeInTheDocument();
});
