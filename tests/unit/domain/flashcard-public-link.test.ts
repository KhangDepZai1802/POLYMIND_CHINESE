import { describe, expect, it } from "vitest";

import {
  FLASHCARD_PUBLIC_TOKEN_ALPHABET,
  FLASHCARD_PUBLIC_TOKEN_LENGTH,
  FLASHCARD_PUBLIC_TOKEN_MAX_LENGTH,
  flashcardFixedPublicToken,
  flashcardPublicUrl,
  normalizeFlashcardPublicToken,
} from "@/features/flashcards/domain/public-link";

/**
 * Mã liên kết công khai là thứ DUY NHẤT đứng giữa người lạ và nội dung bài học.
 * Bài này canh hai điều: luật hình dạng không bị nới quá chỗ `D-39` cho phép,
 * và chuỗi rác không lọt qua để chạm tới DB.
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

  /**
   * Vế quan trọng nhất của `D-39`: migration `…081` nới hình dạng để nhận mã
   * dạng slug. Nếu nới sai chiều thì các mã NGẪU NHIÊN đã in trong sách chết
   * hàng loạt, và không thu hồi lại được.
   */
  it("mã ngẫu nhiên đời cũ vẫn hợp lệ sau khi nới hình dạng", () => {
    expect(normalizeFlashcardPublicToken("qr7dem3k5np2")).toBe("qr7dem3k5np2");
    expect(normalizeFlashcardPublicToken("abcdefghjkmn")).toBe("abcdefghjkmn");
  });

  it.each([
    ["mã cố định của khoá", "vcb-bank-01"],
    ["buổi hai chữ số", "vcb-bank-35"],
    ["khoá một cụm", "hsk1-07"],
  ])("nhận %s", (_label, raw) => {
    expect(normalizeFlashcardPublicToken(raw)).toBe(raw);
  });

  it.each([
    ["rỗng", ""],
    ["hai ký tự", "ab"],
    ["gạch ở đầu", "-vcb-bank-01"],
    ["gạch ở cuối", "vcb-bank-01-"],
    ["hai gạch liền", "vcb--bank-01"],
    ["chỉ có gạch", "---"],
    ["gạch dưới", "vcb_bank_01"],
    ["có dấu chấm", "vcb.bank.01"],
    ["có khoảng trắng ở giữa", "vcb bank 01"],
    ["đường dẫn ngược", "../../etc/passwd"],
    ["đường dẫn mã hoá", "%2e%2e%2f%2e"],
    ["ký tự tiếng Việt", "vcb-bank-đ1"],
    ["dài quá trần", `${"a".repeat(FLASHCARD_PUBLIC_TOKEN_MAX_LENGTH + 1)}`],
  ])("từ chối mã %s", (_label, raw) => {
    expect(normalizeFlashcardPublicToken(raw)).toBeNull();
  });

  it.each([[null], [undefined], [123], [{}], [["qr7dem3k5np2"]]])(
    "từ chối giá trị không phải chuỗi: %s",
    (raw) => {
      expect(normalizeFlashcardPublicToken(raw)).toBeNull();
    },
  );

  it("bảng chữ mã ngẫu nhiên vẫn đúng 32 ký tự và không chứa i/l/o/u", () => {
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

/**
 * Công thức này có HAI bản cài đặt: ở đây và trong
 * `app.flashcard_fixed_link_token()` (migration `…081`). Bài dưới ghim các cặp
 * vào/ra cụ thể để pgTAP đối chiếu được bằng chính những chuỗi đó — hai bên
 * lệch nhau nghĩa là màn Admin hứa một địa chỉ mà DB phát hành địa chỉ khác,
 * và cái sai chỉ lộ ra sau khi sách đã in.
 */
describe("flashcardFixedPublicToken", () => {
  it.each([
    ["VCB-BANK", 1, "vcb-bank-01"],
    ["VCB-BANK", 9, "vcb-bank-09"],
    ["VCB-BANK", 35, "vcb-bank-35"],
    ["vcb-bank", 35, "vcb-bank-35"],
    ["HSK1", 7, "hsk1-07"],
    // Ký tự lạ gộp thành MỘT gạch, không đẻ ra gạch đôi.
    ["HSK 1 (A)", 2, "hsk-1-a-02"],
    ["  VCB--BANK  ", 3, "vcb-bank-03"],
    // Buổi ≥ 100 dài ra 3 chữ số chứ không bị cắt.
    ["VCB-BANK", 100, "vcb-bank-100"],
  ])("mã khoá %s buổi %i → %s", (code, session, expected) => {
    expect(flashcardFixedPublicToken(code, session)).toBe(expected);
  });

  it("mã sinh ra luôn tự nó là mã hợp lệ", () => {
    for (let session = 1; session <= 35; session += 1) {
      const token = flashcardFixedPublicToken("VCB-BANK", session);
      expect(token).not.toBeNull();
      expect(normalizeFlashcardPublicToken(token)).toBe(token);
    }
  });

  it("35 buổi cho ra 35 mã khác nhau — không buổi nào đè lên buổi nào", () => {
    const tokens = Array.from({ length: 35 }, (_, index) =>
      flashcardFixedPublicToken("VCB-BANK", index + 1),
    );
    expect(new Set(tokens).size).toBe(35);
  });

  it.each([
    ["mã khoá không có chữ số nào", "###", 1],
    ["mã khoá rỗng", "", 1],
    ["số buổi bằng 0", "VCB-BANK", 0],
    ["số buổi âm", "VCB-BANK", -3],
    ["số buổi lẻ", "VCB-BANK", 1.5],
  ])("trả null khi %s", (_label, code, session) => {
    expect(flashcardFixedPublicToken(code, session)).toBeNull();
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

  it("ghép đúng địa chỉ sẽ in vào sách cho buổi 1 và buổi 35", () => {
    const origin = "https://www.polymind.vn";
    expect(
      flashcardPublicUrl(origin, flashcardFixedPublicToken("VCB-BANK", 1)!),
    ).toBe("https://www.polymind.vn/t/vcb-bank-01");
    expect(
      flashcardPublicUrl(origin, flashcardFixedPublicToken("VCB-BANK", 35)!),
    ).toBe("https://www.polymind.vn/t/vcb-bank-35");
  });
});
