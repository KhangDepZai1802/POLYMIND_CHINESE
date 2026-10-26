import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { TeachingPhotoPreview } from "@/features/b2c/components/teaching-photo-preview";
import { DeleteTeachingSession } from "@/features/b2c/components/delete-teaching-session";
import { archiveTeachingSessionAction } from "@/features/b2c/server/teaching-actions";
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/b2c/server/teaching-actions", () => ({ archiveTeachingSessionAction: vi.fn() }));
beforeEach(() => vi.clearAllMocks());
it("shows a thumbnail immediately and opens the larger checkpoint image in a dialog", () => {
  render(<TeachingPhotoPreview url="https://example.test/signed-photo.jpg" label="Ảnh check-in Cô Lê" />);
  expect(screen.getByRole("img", { name: "Ảnh check-in Cô Lê" })).toHaveAttribute("src", "https://example.test/signed-photo.jpg");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Xem Ảnh check-in Cô Lê" }));
  expect(screen.getByRole("dialog")).toBeVisible();
  expect(screen.getByRole("img", { name: "Ảnh check-in Cô Lê phóng lớn" })).toBeVisible();
});
it("shows a refresh message when a signed image fails to load", () => {
  render(<TeachingPhotoPreview url="https://example.test/expired.jpg" label="Ảnh check-out" />);
  fireEvent.error(screen.getByRole("img"));
  fireEvent.click(screen.getByRole("button", { name: "Xem Ảnh check-out" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Tải lại trang");
});
it("requires confirmation and a reason before removing a payroll entry", async () => {
  vi.mocked(archiveTeachingSessionAction).mockResolvedValue({ success: true });
  render(<DeleteTeachingSession id="session-a" label="Starter Hero · Cô Lê" />);
  fireEvent.click(screen.getByRole("button", { name: "Xóa buổi dạy Starter Hero · Cô Lê" }));
  expect(archiveTeachingSessionAction).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toHaveTextContent("điểm danh học viên giữ nguyên");
  fireEvent.change(screen.getByRole("textbox", { name: "Lý do xóa" }), { target: { value: "Buổi thử nghiệm" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  await waitFor(() => expect(archiveTeachingSessionAction).toHaveBeenCalledWith({ id: "session-a", reason: "Buổi thử nghiệm" }));
  await waitFor(() => expect(refresh).toHaveBeenCalledOnce());
});
it("keeps the confirmation open and displays a server error", async () => {
  vi.mocked(archiveTeachingSessionAction).mockResolvedValue({ error: "Không có quyền xóa" });
  render(<DeleteTeachingSession id="session-a" label="Lớp A" />);
  fireEvent.click(screen.getByRole("button", { name: "Xóa buổi dạy Lớp A" }));
  fireEvent.change(screen.getByRole("textbox", { name: "Lý do xóa" }), { target: { value: "Nhập nhầm" } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận xóa" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Không có quyền xóa");
  expect(refresh).not.toHaveBeenCalled();
});
