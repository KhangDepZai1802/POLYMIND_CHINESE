import { describe, expect, it } from "vitest";

import {
  flashcardPageImageUrls,
  flashcardPrefetchUrls,
  type FlashcardPrefetchPage,
} from "@/features/flashcards/domain/image-prefetch";

const UUID = "11111111-1111-4111-8111-111111111111";
const OWNER = "22222222-2222-4222-8222-222222222222";

/** Đường dẫn thật trong bucket: `actor/deck/section/page/slot-uuid.ext`. */
function path(slot: string, extension: string) {
  return `${OWNER}/${UUID}/${UUID}/${UUID}/${slot}-${UUID}.${extension}`;
}

function page(overrides: Partial<FlashcardPrefetchPage> = {}): FlashcardPrefetchPage {
  return { frontUrl: null, backUrl: null, mediaUrls: {}, ...overrides };
}

describe("flashcardPageImageUrls", () => {
  it("gom hai mặt và ảnh của câu ví dụ", () => {
    const urls = flashcardPageImageUrls(
      page({
        frontUrl: "https://x/front",
        backUrl: "https://x/back",
        mediaUrls: {
          [path("front", "webp")]: "https://x/front",
          [path("example-0", "jpg")]: "https://x/vd0",
          [path("example-1", "png")]: "https://x/vd1",
        },
      }),
    );

    expect(urls).toEqual([
      "https://x/front",
      "https://x/back",
      "https://x/vd0",
      "https://x/vd1",
    ]);
  });

  it("🔴 KHÔNG lấy file audio", () => {
    // `mediaUrls` mang mọi media của thẻ, gồm cả phát âm. Kéo một file 20MB về
    // bằng thẻ `<img>` vừa vô dụng vừa tốn đúng thứ đang cố tiết kiệm.
    const urls = flashcardPageImageUrls(
      page({
        mediaUrls: {
          [path("audio", "mp3")]: "https://x/am-thanh.mp3",
          [path("audio", "m4a")]: "https://x/am-thanh.m4a",
          [path("front", "jpg")]: "https://x/anh",
        },
      }),
    );

    expect(urls).toEqual(["https://x/anh"]);
  });

  it("đường dẫn không đúng quy ước thì bỏ qua, không đoán", () => {
    const urls = flashcardPageImageUrls(
      page({ mediaUrls: { "linh-tinh.txt": "https://x/la" } }),
    );
    expect(urls).toEqual([]);
  });

  it("thẻ chữ thuần không có ảnh nào", () => {
    expect(flashcardPageImageUrls(page())).toEqual([]);
  });
});

describe("flashcardPrefetchUrls", () => {
  const pages = Array.from({ length: 6 }, (_, index) =>
    page({ frontUrl: `https://x/${index}` }),
  );

  it("ưu tiên thẻ TIẾN trước, rồi mới tới thẻ lùi", () => {
    // Thứ tự này là thứ quyết định thẻ nào kịp sẵn sàng: trình duyệt chỉ mở
    // khoảng 6 kết nối một lúc.
    expect(flashcardPrefetchUrls(pages, 2)).toEqual([
      "https://x/3",
      "https://x/4",
      "https://x/5",
      "https://x/1",
    ]);
  });

  it("không bao giờ chứa thẻ ĐANG XEM", () => {
    expect(flashcardPrefetchUrls(pages, 2)).not.toContain("https://x/2");
  });

  it("thẻ đầu và thẻ cuối không tràn ra ngoài mảng", () => {
    expect(flashcardPrefetchUrls(pages, 0)).toEqual([
      "https://x/1",
      "https://x/2",
      "https://x/3",
    ]);
    expect(flashcardPrefetchUrls(pages, 5)).toEqual(["https://x/4"]);
  });

  it("buổi chỉ có một thẻ thì không tải trước gì", () => {
    expect(flashcardPrefetchUrls([page({ frontUrl: "https://x/0" })], 0)).toEqual([]);
  });

  it("URL trùng nhau chỉ xuất hiện một lần", () => {
    const shared = [
      page({ frontUrl: "https://x/a" }),
      page({ frontUrl: "https://x/b" }),
      page({ frontUrl: "https://x/b" }),
    ];
    expect(flashcardPrefetchUrls(shared, 0)).toEqual(["https://x/b"]);
  });

  it("cửa sổ tải trước điều chỉnh được", () => {
    expect(flashcardPrefetchUrls(pages, 2, { ahead: 1, behind: 0 })).toEqual([
      "https://x/3",
    ]);
  });
});
