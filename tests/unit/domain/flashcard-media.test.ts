import { describe, expect, it } from "vitest";

import {
  MAX_FLASHCARD_AUDIO_BYTES,
  MAX_FLASHCARD_IMAGE_BYTES,
  flashcardMediaFormat,
  flashcardMediaSizeLimit,
  isOwnedFlashcardMediaPath,
} from "@/features/flashcards/domain/media";

describe("flashcard media", () => {
  it("chỉ nhận đúng cặp phần mở rộng/MIME cho ảnh và audio", () => {
    expect(
      flashcardMediaFormat("front", "mặt-trước.JPEG", "image/jpg"),
    ).toEqual({
      extension: "jpg",
      mimeType: "image/jpeg",
    });
    expect(flashcardMediaFormat("back", "mặt-sau.webp", "image/webp")).toEqual({
      extension: "webp",
      mimeType: "image/webp",
    });
    expect(flashcardMediaFormat("audio", "phat-am.m4a", "audio/x-m4a")).toEqual(
      {
        extension: "m4a",
        mimeType: "audio/mp4",
      },
    );

    expect(
      flashcardMediaFormat("front", "payload.png", "image/jpeg"),
    ).toBeNull();
    expect(
      flashcardMediaFormat("audio", "payload.exe", "audio/mpeg"),
    ).toBeNull();
    expect(
      flashcardMediaFormat("audio", "payload.mp3", "audio/mp4"),
    ).toBeNull();
  });

  it("áp giới hạn kích thước riêng cho ảnh và audio", () => {
    expect(flashcardMediaSizeLimit("front")).toBe(MAX_FLASHCARD_IMAGE_BYTES);
    expect(flashcardMediaSizeLimit("back")).toBe(MAX_FLASHCARD_IMAGE_BYTES);
    expect(flashcardMediaSizeLimit("audio")).toBe(MAX_FLASHCARD_AUDIO_BYTES);
  });

  it("khóa object path theo actor, deck, buổi, trang và đúng slot", () => {
    const actorId = "11111111-1111-4111-8111-111111111111";
    const deckId = "22222222-2222-4222-8222-222222222222";
    const sectionId = "33333333-3333-4333-8333-333333333333";
    const pageId = "44444444-4444-4444-8444-444444444444";
    const objectId = "55555555-5555-4555-8555-555555555555";
    const expected = {
      actorId,
      deckId,
      sectionId,
      pageId,
      slot: "front" as const,
    };

    expect(
      isOwnedFlashcardMediaPath(
        `${actorId}/${deckId}/${sectionId}/${pageId}/front-${objectId}.jpg`,
        expected,
      ),
    ).toBe(true);
    expect(
      isOwnedFlashcardMediaPath(
        `${actorId}/${deckId}/${sectionId}/${pageId}/back-${objectId}.jpg`,
        expected,
      ),
    ).toBe(false);
    expect(
      isOwnedFlashcardMediaPath(
        `${actorId}/${deckId}/${sectionId}/../front-${objectId}.jpg`,
        expected,
      ),
    ).toBe(false);
    expect(
      isOwnedFlashcardMediaPath(
        `${actorId}/${deckId}/${sectionId}/${pageId}/front-not-a-uuid.jpg`,
        expected,
      ),
    ).toBe(false);
  });
});
