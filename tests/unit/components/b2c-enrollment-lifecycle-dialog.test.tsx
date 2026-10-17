import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ read: vi.fn(), save: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/features/b2c/server/enrollment-lifecycle-actions", () => ({ readEnrollmentLifecycleAction: mocks.read, saveEnrollmentLifecycleAction: mocks.save }));
import { EnrollmentLifecycleDialog } from "@/features/b2c/components/enrollment-lifecycle-dialog";

const context = {
  enrollment: { id: "e", status: "studying", class_id: "a", updated_at: "2026-10-17T00:00:00Z" },
  classes: [{ id: "b", code: "B2C-B", name: "Movers" }], events: [], total: 0,
};
beforeEach(() => { vi.clearAllMocks(); mocks.read.mockResolvedValue(context); });
afterEach(cleanup);
it("opens, submits a transfer and displays recorded history", async () => {
  mocks.save.mockResolvedValue({ enrollmentId: "new" });
  render(<EnrollmentLifecycleDialog enrollmentId="e" fullName="An" className="Starters" />);
  fireEvent.click(screen.getByRole("button", { name: "Chuyển lớp / Bảo lưu An" }));
  await screen.findByLabelText(/Lớp chuyển đến/);
  fireEvent.change(screen.getByLabelText(/Lớp chuyển đến/), { target: { value: "b" } });
  fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Đổi lịch học" } });
  mocks.read.mockResolvedValue({ ...context, enrollment: { ...context.enrollment, status: "transferred" }, total: 1, events: [{ id: "h", action: "transfer", effective_date: "2026-10-17", expected_return_date: null, from_class_name: "Starters", to_class_name: "Movers", reason: "Đổi lịch học", actor_name: "Giáo vụ", created_at: "2026-10-17T00:00:00Z" }] });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thao tác" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ action: "transfer", target_class_id: "b", reason: "Đổi lịch học", expected_return_date: "" })));
  await screen.findByText("Starters → Movers");
  expect(screen.queryByRole("button", { name: "Lưu thao tác" })).toBeNull();
});
it("provides hold and resume separately and preserves errors", async () => {
  mocks.read.mockResolvedValue({ ...context, enrollment: { ...context.enrollment, status: "on_hold" } });
  mocks.save.mockResolvedValue({ error: "Ghi danh đã thay đổi" });
  render(<EnrollmentLifecycleDialog enrollmentId="e" fullName="An" className="Starters" />);
  fireEvent.click(screen.getByRole("button", { name: "Chuyển lớp / Bảo lưu An" }));
  await screen.findByLabelText("Thao tác");
  fireEvent.change(screen.getByLabelText("Thao tác"), { target: { value: "resume" } });
  expect(screen.queryByLabelText(/Lớp chuyển đến/)).toBeNull();
  fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Học lại" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu thao tác" }));
  await screen.findByText("Ghi danh đã thay đổi");
  expect(screen.getByLabelText("Lý do")).toHaveValue("Học lại");
});
