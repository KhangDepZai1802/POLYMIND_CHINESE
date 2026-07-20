import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadToSignedUrl } = vi.hoisted(() => ({
  uploadToSignedUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: { from: () => ({ uploadToSignedUrl }) },
  }),
}));

import { uploadSpeakingAnswerBlob } from "@/features/assessment-results/client/speaking-upload";

describe("uploadSpeakingAnswerBlob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadToSignedUrl.mockResolvedValue({ error: null });
  });

  it("upload Blob lớn trực tiếp lên Storage rồi chỉ gửi path để attach", async () => {
    const blob = new Blob([new Uint8Array(1_500_000)], {
      type: "audio/webm;codecs=opus",
    });
    const createTicket = vi.fn().mockResolvedValue({
      path: "11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333/44444444-4444-4444-8444-444444444444.webm",
      token: "signed-upload-token",
      contentType: "audio/webm",
    });
    const attach = vi.fn().mockResolvedValue({ ok: true });

    await expect(
      uploadSpeakingAnswerBlob({
        blob,
        durationMs: 12_345,
        createTicket,
        attach,
      }),
    ).resolves.toEqual({ ok: true });

    expect(createTicket).toHaveBeenCalledWith({
      mimeType: "audio/webm;codecs=opus",
      sizeBytes: 1_500_000,
    });
    expect(uploadToSignedUrl).toHaveBeenCalledWith(
      expect.stringMatching(/\.webm$/),
      "signed-upload-token",
      blob,
      { contentType: "audio/webm" },
    );
    expect(attach).toHaveBeenCalledWith({
      objectPath: expect.stringMatching(/\.webm$/),
      durationMs: 12_345,
    });
    expect(attach.mock.calls[0]![0]).not.toHaveProperty("audio");
  });

  it("không attach khi upload Storage thất bại", async () => {
    uploadToSignedUrl.mockResolvedValue({ error: new Error("network") });
    const attach = vi.fn();

    const result = await uploadSpeakingAnswerBlob({
      blob: new Blob(["audio"], { type: "audio/webm" }),
      durationMs: 1000,
      createTicket: vi.fn().mockResolvedValue({
        path: "signed.webm",
        token: "token",
        contentType: "audio/webm",
      }),
      attach,
    });

    expect(result.ok).toBe(false);
    expect(attach).not.toHaveBeenCalled();
  });
});
