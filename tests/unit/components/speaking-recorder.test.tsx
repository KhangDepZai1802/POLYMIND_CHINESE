import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ConfirmationProvider } from "@/components/shared/confirmation-provider";
import {
  SpeakingRecorder,
  type SpeakingRecorderStatus,
} from "@/features/question-builder/renderers/speaking-recorder";

class FakeMediaRecorder {
  static isTypeSupported() {
    return true;
  }

  state: RecordingState = "inactive";
  mimeType = "audio/webm";
  stream: MediaStream;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: ((event: Event) => void) | null = null;

  constructor(stream: MediaStream) {
    this.stream = stream;
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob(["audio"], { type: this.mimeType }) } as BlobEvent);
    this.onstop?.(new Event("stop"));
  }
}

describe("SpeakingRecorder", () => {
  beforeEach(() => {
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:recording"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("tự tải bản ghi lên ngay khi dừng và báo trạng thái để chặn nộp sớm", async () => {
    let finishUpload: ((value: { ok: true }) => void) | undefined;
    const onUpload = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          finishUpload = resolve;
        }),
    );
    const statuses: SpeakingRecorderStatus[] = [];
    const user = userEvent.setup();

    render(
      <ConfirmationProvider>
        <SpeakingRecorder
          onUpload={onUpload}
          onStatusChange={(status) => statuses.push(status)}
        />
      </ConfirmationProvider>,
    );

    await user.click(screen.getByRole("button", { name: "🎙️ Bắt đầu thu âm" }));
    await user.click(screen.getByRole("button", { name: "⏹ Dừng thu" }));

    await waitFor(() => expect(onUpload).toHaveBeenCalledOnce());
    expect(screen.getByText("Đang xử lý bản ghi…")).toBeInTheDocument();
    expect(statuses).toContain("uploading");

    finishUpload?.({ ok: true });
    await screen.findByText("✓ Đã nộp bản ghi.");
    await waitFor(() => expect(statuses).toContain("saved"));
    expect(screen.queryByText("Nộp bản ghi này")).not.toBeInTheDocument();
  });
});
