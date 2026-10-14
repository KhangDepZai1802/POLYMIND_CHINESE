import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeachingCheckpoint } from "@/features/b2c/components/teaching-checkpoint";
const mocks = vi.hoisted(() => ({
  ticket: vi.fn(),
  record: vi.fn(),
  upload: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/b2c/server/teaching-actions", () => ({
  teachingPhotoTicket: mocks.ticket,
  recordTeachingCheckpoint: mocks.record,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: { from: () => ({ uploadToSignedUrl: mocks.upload }) },
  }),
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.ticket.mockResolvedValue({
    path: "session/actor/in/photo.jpg",
    token: "ticket",
  });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.record.mockResolvedValue({ success: "OK" });
});
describe("ảnh chấm công B2C", () => {
  it("yêu cầu ảnh trước khi check-in và gọi ghi nhận sau upload", async () => {
    render(<TeachingCheckpoint id="session" kind="in" />);
    expect(screen.getByRole("button", { name: "Check-in" })).toBeDisabled();
    const input = screen.getByLabelText("Ảnh check-in");
    expect(input).toHaveAttribute("capture", "environment");
    fireEvent.change(input, {
      target: {
        files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.record).toHaveBeenCalledWith({
      id: "session",
      kind: "in",
      photo: "session/actor/in/photo.jpg",
    });
  });
  it("upload lỗi không ghi nhận chấm công", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "failed" } });
    render(<TeachingCheckpoint id="session" kind="out" />);
    fireEvent.change(screen.getByLabelText("Ảnh check-out"), {
      target: {
        files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check-out" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Không tải được ảnh"),
    );
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("gửi lại sau lỗi lưu dùng cùng ảnh để tránh upload/tính trùng", async () => {
    mocks.record
      .mockResolvedValueOnce({ error: "Thử lại" })
      .mockResolvedValueOnce({ success: "OK" });
    render(<TeachingCheckpoint id="session" kind="in" />);
    fireEvent.change(screen.getByLabelText("Ảnh check-in"), {
      target: {
        files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Thử lại"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
});
