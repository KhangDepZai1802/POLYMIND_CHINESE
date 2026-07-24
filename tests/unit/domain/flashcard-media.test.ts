import { describe, expect, it } from "vitest";

import {
  MAX_FLASHCARD_AUDIO_BYTES,
  MAX_FLASHCARD_EXAMPLE_SENTENCES,
  MAX_FLASHCARD_IMAGE_BYTES,
  exampleMediaSlot,
  flashcardAltText,
  flashcardMediaFormat,
  flashcardMediaSizeLimit,
  flashcardMediaSlotFromFileName,
  isFlashcardMediaSlot,
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

  it("sinh alt ảnh từ hanzi + nghĩa hoặc tên buổi vì admin không nhập mô tả", () => {
    expect(
      flashcardAltText({
        kind: "vocabulary",
        face: "front",
        hanzi: "胡萝卜",
        meaningVi: "Củ cà rốt",
        sectionTitle: "Buổi 1",
      }),
    ).toBe("Mặt trước thẻ từ vựng 胡萝卜 — Củ cà rốt");
    expect(
      flashcardAltText({
        kind: "session_cover",
        face: "back",
        hanzi: null,
        meaningVi: null,
        sectionTitle: "Chào hỏi",
      }),
    ).toBe("Mặt sau trang mở đầu Chào hỏi");
    expect(
      flashcardAltText({
        kind: "vocabulary",
        face: "back",
        hanzi: "  ",
        meaningVi: "  ",
        sectionTitle: "  ",
      }),
    ).toBe("Mặt sau trang mở đầu buổi học");
  });

  it("nhận khe ảnh câu ví dụ có chỉ số, từ chối chỉ số vượt trần", () => {
    expect(isFlashcardMediaSlot("example-0")).toBe(true);
    expect(isFlashcardMediaSlot("example-7")).toBe(true);
    expect(exampleMediaSlot(3)).toBe("example-3");

    expect(isFlashcardMediaSlot(`example-${MAX_FLASHCARD_EXAMPLE_SENTENCES}`))
      .toBe(false);
    expect(isFlashcardMediaSlot("example")).toBe(false);
    expect(isFlashcardMediaSlot("example-")).toBe(false);
    expect(isFlashcardMediaSlot("example--1")).toBe(false);
    expect(isFlashcardMediaSlot("front")).toBe(true);
  });

  it("đọc được khe từ TOÀN BỘ tên file, không cắt ở dấu gạch đầu tiên", () => {
    // Bản trước dùng `split("-", 1)[0]` nên khe ra "example" và file rác của câu
    // ví dụ không bao giờ được dọn khỏi bucket.
    expect(
      flashcardMediaSlotFromFileName(
        "example-2-55555555-5555-4555-8555-555555555555.png",
      ),
    ).toBe("example-2");
    expect(
      flashcardMediaSlotFromFileName(
        "audio-55555555-5555-4555-8555-555555555555.mp3",
      ),
    ).toBe("audio");
    expect(flashcardMediaSlotFromFileName("khong-phai-khe.png")).toBeNull();
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

    // Khe ảnh câu ví dụ: đúng chỉ số mới nhận, lệch chỉ số là của câu khác.
    expect(
      isOwnedFlashcardMediaPath(
        `${actorId}/${deckId}/${sectionId}/${pageId}/example-2-${objectId}.png`,
        { ...expected, slot: "example-2" },
      ),
    ).toBe(true);
    expect(
      isOwnedFlashcardMediaPath(
        `${actorId}/${deckId}/${sectionId}/${pageId}/example-3-${objectId}.png`,
        { ...expected, slot: "example-2" },
      ),
    ).toBe(false);
  });

  it("không cho đuôi file lệch loại khe", () => {
    const actorId = "11111111-1111-4111-8111-111111111111";
    const deckId = "22222222-2222-4222-8222-222222222222";
    const sectionId = "33333333-3333-4333-8333-333333333333";
    const pageId = "44444444-4444-4444-8444-444444444444";
    const objectId = "55555555-5555-4555-8555-555555555555";
    const base = { actorId, deckId, sectionId, pageId };
    const path = (file: string) =>
      `${actorId}/${deckId}/${sectionId}/${pageId}/${file}`;

    // Bản trước cho MỌI khe nhận cả 5 đuôi, nên một file .mp3 vẫn lọt vào ô ảnh.
    expect(
      isOwnedFlashcardMediaPath(path(`front-${objectId}.mp3`), {
        ...base,
        slot: "front",
      }),
    ).toBe(false);
    expect(
      isOwnedFlashcardMediaPath(path(`audio-${objectId}.png`), {
        ...base,
        slot: "audio",
      }),
    ).toBe(false);
    expect(
      isOwnedFlashcardMediaPath(path(`example-0-${objectId}.mp3`), {
        ...base,
        slot: "example-0",
      }),
    ).toBe(false);

    expect(
      isOwnedFlashcardMediaPath(path(`audio-${objectId}.mp3`), {
        ...base,
        slot: "audio",
      }),
    ).toBe(true);
  });
});
