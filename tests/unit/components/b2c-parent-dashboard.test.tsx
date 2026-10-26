import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("@/features/b2c/server/archive-actions", () => ({ archiveCenterRecordAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/features/b2c/components/parent-dialog", () => ({ ParentDialog: ({ parent, showLabel }: { parent?: { full_name: string }; showLabel?: boolean }) => <button>{parent ? `${showLabel ? "Sửa" : "Hồ sơ"} ${parent.full_name}` : "Thêm phụ huynh"}</button> }));
import { ParentDashboard } from "@/features/b2c/components/parent-dashboard";
import type { ParentDashboardRow } from "@/features/b2c/domain/parent-dashboard";
const rows: ParentDashboardRow[] = [
  { id: "a", full_name: "Chị An", phone: "0901234567", zalo: "Zalo An", email: "an@example.test", children: [{ code: "HV1", full_name: "Nguyễn Bình", relationship: "mother", classes: [{ id: "c1", name: "Movers" }] }, { code: "HV2", full_name: "Nguyễn Chi", relationship: "mother", classes: [{ id: "c2", name: "Flyers" }] }] },
  { id: "b", full_name: "Anh Bình", phone: null, zalo: null, email: null, children: [{ code: "HV3", full_name: "Minh Đạt", relationship: "father", classes: [{ id: "c1", name: "Movers" }] }] },
];
afterEach(cleanup);
it("only exposes deletion when the server grants delete permission", () => {
  const view = render(<ParentDashboard parents={rows} />);
  expect(screen.queryByRole("button", { name: "Xóa phụ huynh Chị An" })).not.toBeInTheDocument();
  view.rerender(<ParentDashboard parents={rows} canDelete />);
  expect(screen.getByRole("button", { name: "Xóa phụ huynh Chị An" })).toBeVisible();
});
it("opens missing contacts in a popup while preserving the main table", () => {
  render(<ParentDashboard parents={rows} />);
  expect(screen.getByRole("button", { name: "Tổng phụ huynh: 2" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Thiếu thông tin: 1" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("Anh Bình")).toBeInTheDocument(); expect(dialog.queryByText("Chị An")).not.toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Lọc trạng thái phụ huynh", hidden: true })).toHaveValue("all");
});
it.each(["Tổng phụ huynh: 2", "Có số điện thoại: 1", "Có Zalo: 1"])("opens the matching list for %s", (name) => {
  render(<ParentDashboard parents={rows} />);
  fireEvent.click(screen.getByRole("button", { name }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("Chị An")).toBeInTheDocument();
  if (name.startsWith("Tổng")) expect(dialog.getByText("Anh Bình")).toBeInTheDocument();
  else expect(dialog.queryByText("Anh Bình")).not.toBeInTheDocument();
});
it("opens zero-count groups with an empty state", () => {
  render(<ParentDashboard parents={[rows[1]!]} />);
  fireEvent.click(screen.getByRole("button", { name: "Có Zalo: 0" }));
  expect(within(screen.getByRole("dialog")).getByText("Chưa có phụ huynh trong nhóm này.")).toBeInTheDocument();
});
it("searches and paginates within a card popup and opens parent detail", () => {
  render(<ParentDashboard parents={Array.from({ length: 21 }, (_, i) => ({ ...rows[0]!, id: `p${i}`, full_name: `Phụ huynh ${String(i).padStart(2, "0")}` }))} />);
  fireEvent.click(screen.getByRole("button", { name: "Tổng phụ huynh: 21" }));
  let popup = within(screen.getByRole("dialog"));
  expect(popup.getAllByRole("row")).toHaveLength(21);
  fireEvent.click(popup.getByRole("button", { name: "Sau" }));
  expect(popup.getAllByRole("row")).toHaveLength(2);
  fireEvent.change(popup.getByRole("textbox", { name: "Tìm trong popup phụ huynh" }), { target: { value: "Phụ huynh 00" } });
  expect(popup.getAllByRole("row")).toHaveLength(2);
  fireEvent.click(popup.getByRole("button", { name: "Xem chi tiết phụ huynh Phụ huynh 00" }));
  popup = within(screen.getByRole("dialog"));
  expect(popup.getByRole("heading", { name: "Thông tin phụ huynh" })).toBeInTheDocument();
});
it("searches child names and filters relationships/classes without duplicating parents", () => {
  render(<ParentDashboard parents={rows} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Tìm phụ huynh" }), { target: { value: "Nguyễn Chi" } });
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc lớp của con" }), { target: { value: "c2" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc quan hệ" }), { target: { value: "mother" } });
  expect(within(screen.getByRole("table")).getByText("Chị An")).toBeInTheDocument();
  fireEvent.change(screen.getByRole("combobox", { name: "Lọc quan hệ" }), { target: { value: "father" } });
  expect(screen.getByText("Chưa có phụ huynh phù hợp với bộ lọc.")).toBeInTheDocument();
});
it("opens a read-only detail with all children and their classes", () => {
  render(<ParentDashboard parents={rows} />);
  fireEvent.click(screen.getByRole("button", { name: "Xem phụ huynh Chị An" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("Các con / Quan hệ (2)")).toBeInTheDocument();
  expect(dialog.getByText("Movers")).toBeInTheDocument(); expect(dialog.getByText("Flyers")).toBeInTheDocument();
  expect(dialog.getByRole("link", { name: "an@example.test" })).toHaveAttribute("href", "mailto:an%40example.test");
});
it("paginates ten per page, selects current page only and changes page size", () => {
  render(<ParentDashboard parents={Array.from({ length: 12 }, (_, i) => ({ ...rows[0]!, id: `p${i}`, full_name: `Phụ huynh ${String(i).padStart(2, "0")}` }))} />);
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(11);
  fireEvent.click(screen.getByRole("checkbox", { name: "Chọn tất cả phụ huynh trên trang" }));
  expect(screen.getByRole("status")).toHaveTextContent("Đã chọn 10 hồ sơ");
  fireEvent.click(screen.getByRole("button", { name: "Trang phụ huynh sau" }));
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
  fireEvent.change(screen.getByRole("combobox", { name: "Số phụ huynh mỗi trang" }), { target: { value: "25" } });
  expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(13);
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
