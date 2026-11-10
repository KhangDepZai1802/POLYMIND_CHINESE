import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TeachingCheckpoint } from "@/features/b2c/components/teaching-checkpoint";

const mocks = vi.hoisted(() => ({
  ticket: vi.fn(),
  record: vi.fn(),
  upload: vi.fn(),
  refresh: vi.fn(),
  reverseGeocode: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/features/b2c/server/teaching-actions", () => ({
  teachingPhotoTicket: mocks.ticket,
  recordTeachingCheckpoint: mocks.record,
  reverseGeocodeCheckpoint: mocks.reverseGeocode,
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
  mocks.reverseGeocode.mockResolvedValue("123 Phố Huế, Hà Nội");

  Object.defineProperty(global.navigator, "geolocation", {
    value: {
      getCurrentPosition: vi.fn((success) =>
        success({
          coords: {
            latitude: 21.0285,
            longitude: 105.8542,
            accuracy: 10,
          },
        }),
      ),
    },
    writable: true,
    configurable: true,
  });

  global.createImageBitmap = vi.fn().mockResolvedValue({
    width: 800,
    height: 600,
    close: vi.fn(),
  });

  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn().mockReturnValue({ width: 50 }),
  } as unknown as CanvasRenderingContext2D);

  HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => {
    cb(new Blob(["stamped"], { type: "image/jpeg" }));
  });

  global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
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
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check-in" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.record).toHaveBeenCalledWith({
      id: "session",
      kind: "in",
      photo: "session/actor/in/photo.jpg",
      latitude: 21.0285,
      longitude: 105.8542,
      accuracy: 10,
      address: "123 Phố Huế, Hà Nội",
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
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check-out" })).not.toBeDisabled(),
    );
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
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Check-in" })).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Thử lại"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check-in" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
});
