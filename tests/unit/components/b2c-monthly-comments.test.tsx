import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ read: vi.fn(), detail: vi.fn(), save: vi.fn(), confirm: vi.fn() }));
vi.mock("@/features/b2c/server/monthly-comment-actions", () => ({ readMonthlyCommentsAction: api.read, readMonthlyCommentDetailAction: api.detail, saveMonthlyCommentAction: api.save, confirmMonthlyCommentDeliveryAction: api.confirm }));
import { MonthlyCommentsPanel } from "@/features/b2c/components/monthly-comments-panel";
const content = { attendance: "Đều đặn", attitude: "Tích cực", learning: "Tiến bộ", strengths: "Tự tin", improvements: "Ôn từ", next_plan: "Đọc cùng con" };
const report = { id: "r", status: "ready", content, author_name: "Cô Tú", updated_at: "2026-10-17T00:00:00Z" };
const model = { total: 1, rows: [{ enrollment_id: "e", full_name: "An", student_code: "HV1", report, last_delivery: null }] };
const detail = { updated_at: report.updated_at, status: "ready", message: "NHẬN XÉT THÁNG 10/2026\nAn tiến bộ", recipients: [{ key: "p", name: "Mẹ An", email: "me@example.test", zalo: "0901111222" }], history: [], history_total: 0, deliveries: [], delivery_total: 0 };
beforeEach(() => { vi.clearAllMocks(); api.read.mockResolvedValue(model); api.detail.mockResolvedValue(detail); api.save.mockResolvedValue({ id: "r" }); api.confirm.mockResolvedValue({ id: "d" }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows reports but hides writing and contact sharing for view-only teachers", async () => {
  render(<MonthlyCommentsPanel classId="c" today="2026-10-17" canWrite={false} canShare={false} />);
  await screen.findByText("Hoàn tất");
  expect(screen.queryByRole("button", { name: "Sửa nhận xét" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Xem / Lịch sử" }));
  expect((await screen.findByText(/An tiến bộ/)).textContent).toBe(detail.message);
  expect(screen.queryByLabelText("Phụ huynh nhận")).toBeNull();
});
it("saves the six-field template as a draft", async () => {
  api.read.mockResolvedValue({ ...model, rows: [{ ...model.rows[0], report: null }] });
  render(<MonthlyCommentsPanel classId="c" today="2026-10-17" canWrite canShare />);
  fireEvent.click(await screen.findByRole("button", { name: "Nhập nhận xét" }));
  fireEvent.change(screen.getByLabelText("Chuyên cần"), { target: { value: "Đi học đầy đủ" } });
  fireEvent.click(screen.getByRole("button", { name: "Lưu bản nháp" }));
  await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ month: "2026-10", status: "draft", content: expect.objectContaining({ attendance: "Đi học đầy đủ", attitude: "" }) })));
});
it("copying and opening email never record delivery; explicit confirmation does", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<MonthlyCommentsPanel classId="c" today="2026-10-17" canWrite canShare />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem / Chuẩn bị gửi" }));
  fireEvent.change(await screen.findByLabelText("Phụ huynh nhận"), { target: { value: "p" } });
  fireEvent.click(screen.getByRole("button", { name: "Sao chép nội dung gửi Zalo/email" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(detail.message));
  expect(api.confirm).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Kênh gửi"), { target: { value: "email" } });
  const mail = screen.getByRole("link", { name: "Mở email soạn sẵn" });
  expect(mail.getAttribute("href")).toContain("mailto:me%40example.test?");
  expect(mail.getAttribute("href")).toContain(encodeURIComponent(detail.message));
  expect(api.confirm).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: "Ghi nhận đã gửi thủ công" })).toBeDisabled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Ghi nhận đã gửi thủ công" }));
  await waitFor(() => expect(api.confirm).toHaveBeenCalledWith(expect.objectContaining({ report_id: "r", channel: "email", recipient_key: "p", confirmed: true, expected_updated_at: report.updated_at, expected_message: detail.message, expected_destination: "me@example.test" })));
});
it("does not offer sharing for drafts", async () => {
  api.detail.mockResolvedValue({ ...detail, status: "draft" });
  render(<MonthlyCommentsPanel classId="c" today="2026-10-17" canWrite canShare />);
  fireEvent.click(await screen.findByRole("button", { name: "Xem / Chuẩn bị gửi" }));
  await screen.findByText("Bản nháp: hoàn tất nhận xét trước khi chuẩn bị gửi phụ huynh.");
  expect(screen.queryByRole("button", { name: "Ghi nhận đã gửi thủ công" })).toBeNull();
});
it("warns when the report was edited after the last recorded send", async () => {
  api.read.mockResolvedValue({ ...model, rows: [{ ...model.rows[0], last_delivery: { channel: "zalo", recipient_name: "Mẹ An", destination: "0901111222", created_at: "2026-10-16T00:00:00Z", report_updated_at: "2026-10-16T00:00:00Z" } }] });
  render(<MonthlyCommentsPanel classId="c" today="2026-10-17" canWrite canShare />);
  await screen.findByText("Nội dung đã sửa sau lần ghi nhận gửi");
});
