import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn(), success: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success } }));
vi.mock("@/features/b2c/server/student-data-actions", () => ({ saveStudentDataAction: mocks.save }));
import { StudentDataDialog } from "@/features/b2c/components/student-data-dialog";
import type { StudentDataRow } from "@/features/b2c/server/student-data";
const row: StudentDataRow = {
  enrollment_id: "enrollment-id", student_id: "student-id", code: "HV1", full_name: "Bé thử",
  phone: null, customer_source: null, referrer_name: null, class_id: "class-id", class_name: "Lớp thử", teacher_name: "Cô thử",
  salesperson: null, enrollment_date: null, learning_start_date: null, tuition_end_date: null,
  student_updated_at: "2026-10-01T00:00:00Z", enrollment_updated_at: "2026-10-01T00:00:00Z",
};
beforeEach(() => vi.resetAllMocks());
function open() {
  render(<StudentDataDialog row={row} />);
  fireEvent.click(screen.getByRole("button", { name: /Bổ sung hồ sơ/ }));
}
it("allows source entry without inventing missing phone and dates", async () => {
  mocks.save.mockResolvedValue({ success: true });
  open();
  expect(screen.getByLabelText("SĐT học viên / liên hệ")).not.toBeRequired();
  expect(screen.getByLabelText("Ngày nhập học")).not.toBeRequired();
  fireEvent.change(screen.getByLabelText("Nguồn khách"), { target: { value: "tiktok" } });
  fireEvent.submit(screen.getByRole("button", { name: "Lưu hồ sơ" }).closest("form")!);
  await waitFor(() => expect(mocks.save).toHaveBeenCalled());
  const form = mocks.save.mock.calls[0]![0] as FormData;
  expect(form.get("customer_source")).toBe("tiktok");
  expect(form.get("phone")).toBe("");
  expect(form.get("student_updated_at")).toBe(row.student_updated_at);
  await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
});
it("keeps the dialog open and shows stale-data errors", async () => {
  mocks.save.mockResolvedValue({ error: "Hồ sơ đã thay đổi. Tải lại trước khi lưu." });
  open();
  fireEvent.submit(screen.getByRole("button", { name: "Lưu hồ sơ" }).closest("form")!);
  await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Hồ sơ đã thay đổi"));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  expect(mocks.success).not.toHaveBeenCalled();
});
