import { describe, expect, it } from "vitest";

import { speakingAudioFormat } from "@/features/assessment-results/domain/speaking-audio";

describe("speakingAudioFormat", () => {
  it("chấp nhận MIME MediaRecorder của Chrome có codec suffix", () => {
    expect(speakingAudioFormat("audio/webm;codecs=opus")).toEqual({
      mimeType: "audio/webm",
      extension: "webm",
    });
  });

  it("chấp nhận các MIME MP3/M4A phổ biến và từ chối file không phải audio", () => {
    expect(speakingAudioFormat("audio/mp3")?.extension).toBe("mp3");
    expect(speakingAudioFormat("audio/x-m4a")?.extension).toBe("m4a");
    expect(speakingAudioFormat("video/mp4")).toBeNull();
  });
});
