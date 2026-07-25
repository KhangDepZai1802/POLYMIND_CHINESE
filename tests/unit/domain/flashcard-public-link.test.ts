import { describe, expect, it } from "vitest";

import {
  FLASHCARD_PUBLIC_TOKEN_ALPHABET,
  FLASHCARD_PUBLIC_TOKEN_LENGTH,
  flashcardPublicUrl,
  normalizeFlashcardPublicToken,
} from "@/features/flashcards/domain/public-link";

/**
 * Mã liên kết công khai là thứ DUY NHẤT đứng giữa người lạ và nội dung bài học.
 * Bài này canh hai điều: luật hình dạng không bị nới, và chuỗi rác không lọt
 * qua để chạm tới DB.
 */
describe("normalizeFlashcardPublicToken", () => {
  it("nhận mã hợp lệ và trả về dạng chữ thường", () => {
    expect(normalizeFlashcardPublicToken("qr7dem3k5np2")).toBe("qr7dem3k5np2");
  });

  it("chấp nhận chữ HOA và khoảng trắng thừa vì người dùng gõ tay từ sách", () => {
    expect(normalizeFlashcardPublicToken("  QR7DEM3K5NP2 ")).toBe(
      "qr7dem3k5np2",
    );
  });

  it.each([
    ["rỗng", ""],
    ["ngắn một ký tự", "qr7dem3k5np"],
    ["dài một ký tự", "qr7dem3k5np23"],
    // Bốn ký tự này bị loại khỏi bảng chữ vì đọc nhầm khi in ra giấy.
    ["chứa chữ i", "qr7dem3k5npi"],
    ["chứa chữ l", "qr7dem3k5npl"],
    ["chứa chữ o", "qr7dem3k5npo"],
    ["chứa chữ u", "qr7dem3k5npu"],
    ["có dấu gạch", "qr7-em3k5np2"],
    ["đường dẫn ngược", "../../etc/pa"],
    ["đường dẫn mã hoá", "%2e%2e%2f%2e"],
    ["ký tự tiếng Việt", "qr7dem3k5npđ"],
  ])("từ chối mã %s", (_label, raw) => {
    expect(normalizeFlashcardPublicToken(raw)).toBeNull();
  });

  it.each([[null], [undefined], [123], [{}], [["qr7dem3k5np2"]]])(
    "từ chối giá trị không phải chuỗi: %s",
    (raw) => {
      expect(normalizeFlashcardPublicToken(raw)).toBeNull();
    },
  );

  it("bảng chữ đúng 32 ký tự và không chứa i/l/o/u", () => {
    expect(FLASHCARD_PUBLIC_TOKEN_ALPHABET).toHaveLength(32);
    expect(new Set(FLASHCARD_PUBLIC_TOKEN_ALPHABET).size).toBe(32);
    for (const forbidden of ["i", "l", "o", "u"]) {
      expect(FLASHCARD_PUBLIC_TOKEN_ALPHABET).not.toContain(forbidden);
    }
  });

  it("mọi ký tự trong bảng chữ đều tạo ra mã hợp lệ", () => {
    for (const char of FLASHCARD_PUBLIC_TOKEN_ALPHABET) {
      const token = char.repeat(FLASHCARD_PUBLIC_TOKEN_LENGTH);
      expect(normalizeFlashcardPublicToken(token)).toBe(token);
    }
  });
});

describe("flashcardPublicUrl", () => {
  it("ghép đúng địa chỉ", () => {
    expect(flashcardPublicUrl("https://polymind.vn", "qr7dem3k5np2")).toBe(
      "https://polymind.vn/t/qr7dem3k5np2",
    );
  });

  it("không sinh dấu gạch chéo đôi khi origin đã có dấu ở cuối", () => {
    expect(flashcardPublicUrl("https://polymind.vn/", "qr7dem3k5np2")).toBe(
      "https://polymind.vn/t/qr7dem3k5np2",
    );
  });
});
