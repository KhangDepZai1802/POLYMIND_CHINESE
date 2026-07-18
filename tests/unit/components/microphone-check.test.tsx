import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { MicrophoneCheck } from "@/components/shared/microphone-check";

describe("MicrophoneCheck", () => {
  const getUserMedia = vi.fn();

  beforeEach(() => {
    getUserMedia.mockReset();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia },
    });
    Object.defineProperty(document, "permissionsPolicy", {
      configurable: true,
      value: undefined,
    });
  });

  it("xin quyền một lần, đóng stream kiểm tra và báo micro sẵn sàng", async () => {
    const stop = vi.fn();
    const onReadyChange = vi.fn();
    getUserMedia.mockResolvedValue({ getTracks: () => [{ stop }] });
    const user = userEvent.setup();

    render(<MicrophoneCheck onReadyChange={onReadyChange} />);
    await user.click(
      screen.getByRole("button", { name: "Cho phép & kiểm tra micro" }),
    );

    await waitFor(() => expect(stop).toHaveBeenCalledOnce());
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(onReadyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByText("Micro đã sẵn sàng")).toBeInTheDocument();
  });

  it("hướng dẫn thao tác ngay trên trình duyệt khi quyền bị chặn", async () => {
    getUserMedia.mockRejectedValue(
      new DOMException("Permission denied", "NotAllowedError"),
    );
    const user = userEvent.setup();

    render(<MicrophoneCheck />);
    await user.click(
      screen.getByRole("button", { name: "Cho phép & kiểm tra micro" }),
    );

    expect(
      await screen.findByText(/Bấm biểu tượng ổ khóa hoặc micro/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Kiểm tra lại" }),
    ).toBeInTheDocument();
  });

  it("phân biệt lỗi cấu hình website với quyền người dùng", async () => {
    Object.defineProperty(document, "permissionsPolicy", {
      configurable: true,
      value: { allowsFeature: () => false },
    });
    const user = userEvent.setup();
    render(<MicrophoneCheck />);

    await user.click(
      screen.getByRole("button", { name: "Cho phép & kiểm tra micro" }),
    );

    expect(screen.getByText(/Website đang bị cấu hình chặn micro/)).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
