import { describe, expect, it } from "vitest";

import {
  isOwnedQuestionAudioPath,
  questionAudioFormat,
} from "@/features/question-bank/domain/audio";

describe("question audio", () => {
  it("chuẩn hóa MIME MP3/M4A phổ biến nhưng vẫn khóa theo phần mở rộng", () => {
    expect(questionAudioFormat("nghe.mp3", "audio/mp3")).toEqual({
      extension: "mp3",
      mimeType: "audio/mpeg",
    });
    expect(questionAudioFormat("nghe.M4A", "audio/x-m4a")).toEqual({
      extension: "m4a",
      mimeType: "audio/mp4",
    });
    expect(questionAudioFormat("nghe.mp3", "audio/mp4")).toBeNull();
    expect(questionAudioFormat("payload.exe", "audio/mpeg")).toBeNull();
  });

  it("chỉ nhận object path server sinh trong namespace của actor", () => {
    const actor = "11111111-1111-4111-8111-111111111111";
    const object = "22222222-2222-4222-8222-222222222222";

    expect(isOwnedQuestionAudioPath(`${actor}/${object}.mp3`, actor)).toBe(
      true,
    );
    expect(
      isOwnedQuestionAudioPath(
        `33333333-3333-4333-8333-333333333333/${object}.mp3`,
        actor,
      ),
    ).toBe(false);
    expect(isOwnedQuestionAudioPath(`${actor}/../${object}.mp3`, actor)).toBe(
      false,
    );
    expect(isOwnedQuestionAudioPath(`${actor}/not-a-uuid.mp3`, actor)).toBe(
      false,
    );
  });
});
