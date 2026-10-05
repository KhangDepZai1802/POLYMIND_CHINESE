import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ListeningAudioPlayer } from "@/features/listening/components/listening-audio-player";

const first = {
  page: 12,
  title: "Trang 12 – Các buổi trong ngày",
  src: "/audio/bai-3/trang-12-phan-1.m4a",
};
const second = {
  page: 12,
  title: "Trang 12 – Đơn vị ngày tháng",
  src: "/audio/bai-3/trang-12-phan-2.m4a",
};

describe("ListeningAudioPlayer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("có đúng ba tốc độ và đổi được sang 1.25x", async () => {
    const user = userEvent.setup();
    render(<ListeningAudioPlayer track={first} />);
    const audio = screen.getByLabelText(first.title);
    const group = screen.getByRole("group", {
      name: `Tốc độ phát ${first.title}`,
    });

    expect(within(group).getAllByRole("button")).toHaveLength(3);
    await user.click(
      within(group).getByRole("button", { name: "Tốc độ 1.25x" }),
    );

    expect(audio).toHaveProperty("playbackRate", 1.25);
    expect(
      within(group).getByRole("button", { name: "Tốc độ 1.25x" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("dừng audio khác khi bắt đầu phát", () => {
    const pause = vi
      .spyOn(HTMLMediaElement.prototype, "pause")
      .mockImplementation(() => undefined);
    render(
      <>
        <ListeningAudioPlayer track={first} />
        <ListeningAudioPlayer track={second} />
      </>,
    );
    const audios = screen
      .getAllByText(/Trình duyệt của bạn/)
      .map((node) => node.closest("audio"));

    fireEvent.play(audios[1]!);

    expect(pause).toHaveBeenCalledOnce();
    expect(pause.mock.instances[0]).toBe(audios[0]);
  });

  it("hiển thị ảnh và mô tả ngay dưới audio khi dữ liệu có ảnh", () => {
    render(
      <ListeningAudioPlayer
        track={{
          ...first,
          image: { src: "/bai3/trang1.png", width: 1199, height: 1312 },
        }}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: `Nội dung minh họa cho ${first.title}`,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Hình minh họa – ${first.title}`),
    ).toBeInTheDocument();
  });
});
