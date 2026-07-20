import { describe, expect, it } from "vitest";

import {
  isOwnedSpeakingAudioPath,
  speakingAudioFormat,
} from "@/features/assessment-results/domain/speaking-audio";

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

  it("chỉ nhận object path đúng học viên, lượt, câu và UUID file", () => {
    const actorId = "11111111-1111-4111-8111-111111111111";
    const attemptId = "22222222-2222-4222-8222-222222222222";
    const itemId = "33333333-3333-4333-8333-333333333333";
    const valid = `${actorId}/${attemptId}/${itemId}/44444444-4444-4444-8444-444444444444.webm`;

    expect(isOwnedSpeakingAudioPath(valid, actorId, attemptId, itemId)).toBe(
      true,
    );
    expect(
      isOwnedSpeakingAudioPath(
        valid.replace(actorId, "55555555-5555-4555-8555-555555555555"),
        actorId,
        attemptId,
        itemId,
      ),
    ).toBe(false);
    expect(
      isOwnedSpeakingAudioPath(
        `${valid}/../audio.webm`,
        actorId,
        attemptId,
        itemId,
      ),
    ).toBe(false);
    expect(
      isOwnedSpeakingAudioPath(
        valid.replace(".webm", ".exe"),
        actorId,
        attemptId,
        itemId,
      ),
    ).toBe(false);
  });
});
