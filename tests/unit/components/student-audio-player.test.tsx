import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { StudentAudioPlayer } from "@/components/shared/student-audio-player";

describe("StudentAudioPlayer", () => {
  it("mặc định 1×, chỉ có ba tốc độ đã chốt và đổi bằng bàn phím", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <StudentAudioPlayer
        src="https://signed.test/question.mp3"
        label="Audio đề bài"
      />,
    );
    const audio = container.querySelector("audio");
    expect(audio).not.toBeNull();
    Object.defineProperty(audio!, "preservesPitch", {
      configurable: true,
      value: false,
      writable: true,
    });
    fireEvent.loadedMetadata(audio!);

    const group = screen.getByRole("group", {
      name: "Tốc độ phát Audio đề bài",
    });
    const buttons = within(group).getAllByRole("button");
    expect(buttons).toHaveLength(3);
    expect(
      within(group).getByRole("button", { name: "Tốc độ 1×" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(group).queryByRole("button", { name: "Tốc độ 1.25×" }),
    ).not.toBeInTheDocument();
    expect(
      within(group).queryByRole("button", { name: "Tốc độ 1.5×" }),
    ).not.toBeInTheDocument();

    const halfSpeed = within(group).getByRole("button", {
      name: "Tốc độ 0.5×",
    });
    halfSpeed.focus();
    await user.keyboard("{Enter}");

    expect(audio).toHaveProperty("playbackRate", 0.5);
    expect(audio).toHaveProperty("preservesPitch", true);
    expect(halfSpeed).toHaveAttribute("aria-pressed", "true");
  });

  it("reset về 1× khi signed URL đổi", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <StudentAudioPlayer
        src="https://signed.test/a.mp3"
        label="Audio từ vựng"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Tốc độ 0.75×" }));
    expect(
      screen.getByRole("button", { name: "Tốc độ 0.75×" }),
    ).toHaveAttribute("aria-pressed", "true");

    rerender(
      <StudentAudioPlayer
        src="https://signed.test/b.mp3"
        label="Audio từ vựng"
      />,
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Tốc độ 1×" })).toHaveAttribute(
        "aria-pressed",
        "true",
      ),
    );
  });
});
