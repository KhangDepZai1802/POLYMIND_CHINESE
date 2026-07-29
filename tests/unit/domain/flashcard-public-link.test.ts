import { describe, expect, it } from "vitest";

import {
  FLASHCARD_DECK_CODE_MAX_LENGTH,
  FLASHCARD_PUBLIC_TOKEN_ALPHABET,
  FLASHCARD_PUBLIC_TOKEN_LENGTH,
  FLASHCARD_PUBLIC_TOKEN_MAX_LENGTH,
  flashcardDeckCodeDraft,
  flashcardDeckCodeSlug,
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
 * `app.flashcard_fixed_link_token()` (migration `…081`, sửa bởi `…083`). Bài
 * dưới ghim các cặp vào/ra cụ thể để pgTAP đối chiếu được bằng chính những chuỗi
 * đó — hai bên lệch nhau nghĩa là màn Admin hứa một địa chỉ mà DB phát hành địa
 * chỉ khác, và cái sai chỉ lộ ra sau khi sách đã in.
 *
 * 🔴 Từ `MULTIDECK-1` tham số là **mã BỘ**, không phải mã khoá. Các cặp dưới
 * đây giữ nguyên chuỗi `vcb-bank-*` là CÓ CHỦ Ý: bộ đang chạy trên cloud được
 * backfill mã bộ = slug mã khoá, nên đây vẫn là chính những địa chỉ đã in.
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
  ])("mã bộ %s buổi %i → %s", (code, session, expected) => {
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
    ["mã bộ không có chữ số nào", "###", 1],
    ["mã bộ rỗng", "", 1],
    ["số buổi bằng 0", "VCB-BANK", 0],
    ["số buổi âm", "VCB-BANK", -3],
    ["số buổi lẻ", "VCB-BANK", 1.5],
  ])("trả null khi %s", (_label, code, session) => {
    expect(flashcardFixedPublicToken(code, session)).toBeNull();
  });
});

/**
 * `MULTIDECK-1` — chuẩn hoá mã bộ. Bản TS này chạy trên ô nhập của màn Admin,
 * còn `flashcard_decks_code_shape_check` (`…083`) là chốt chặn ở DB. Bài dưới
 * ghim rằng cái ô nhập không bao giờ đẩy xuống DB một chuỗi mà CHECK sẽ từ chối.
 */
describe("flashcardDeckCodeSlug", () => {
  it.each([
    ["VCB-BANK", "vcb-bank"],
    ["VCB Ngữ Pháp", "vcb-ng-ph-p"],
    ["  HSK 1 (A)  ", "hsk-1-a"],
    ["--vcb--bank--", "vcb-bank"],
    ["Sách_2026", "s-ch-2026"],
    ["###", ""],
    ["", ""],
  ])("%s → %s", (raw, expected) => {
    expect(flashcardDeckCodeSlug(raw)).toBe(expected);
  });

  it("cắt đúng trần 40 ký tự và KHÔNG để lại gạch ở cuối", () => {
    // 39 ký tự rồi tới một gạch: cắt thô ở 40 sẽ để lại gạch cuối, mà chuỗi kết
    // thúc bằng gạch thì CHECK ở DB từ chối.
    const raw = `${"a".repeat(39)} bank`;
    const slug = flashcardDeckCodeSlug(raw);
    expect(slug.length).toBeLessThanOrEqual(FLASHCARD_DECK_CODE_MAX_LENGTH);
    expect(slug.endsWith("-")).toBe(false);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  /**
   * Vòng khép kín: mọi mã bộ đi ra từ hàm này, ghép với số buổi bất kỳ, phải
   * cho ra một mã liên kết HỢP LỆ. Đây là chỗ hai trần gặp nhau — 40 ký tự cho
   * mã bộ và 48 cho mã liên kết.
   */
  it("mã bộ dài nhất vẫn cho ra mã liên kết hợp lệ ở buổi 3 chữ số", () => {
    const slug = flashcardDeckCodeSlug("a".repeat(60));
    expect(slug).toHaveLength(FLASHCARD_DECK_CODE_MAX_LENGTH);
    const token = flashcardFixedPublicToken(slug, 100);
    expect(token).not.toBeNull();
    expect(normalizeFlashcardPublicToken(token)).toBe(token);
  });
});

/**
 * `MULTIDECK-1g` — bản chuẩn hoá dùng TRONG LÚC ĐANG GÕ.
 *
 * 🔴 Lỗi đã đẻ ra hàm này: hộp thoại chạy `flashcardDeckCodeSlug` sau TỪNG PHÍM,
 * mà hàm ấy cắt dấu gạch ở cuối — nên gõ `vcb-` ra `vcb`, phím kế dính liền
 * thành `vcbe`, và **mã bộ tự đặt không bao giờ có dấu gạch nối** dù mọi mã gợi
 * ý sẵn (`vcb-bank`, `vcb-exec-2`) đều có.
 */
describe("flashcardDeckCodeDraft", () => {
  it("🔴 giữ dấu gạch ở cuối để còn gõ tiếp được — đúng chỗ `…Slug` cắt mất", () => {
    expect(flashcardDeckCodeDraft("vcb-")).toBe("vcb-");
    expect(flashcardDeckCodeSlug("vcb-")).toBe("vcb");
  });

  it("gõ từng phím ra được mã có dấu gạch nối", () => {
    // Mô phỏng đúng vòng lặp của ô nhập: mỗi phím nối vào giá trị ĐÃ chuẩn hoá
    // của lần trước. Đây là chỗ bản cũ gãy, không phải ở một lần gọi đơn lẻ.
    let value = "";
    for (const key of "VCB-Ngu-Phap") {
      value = flashcardDeckCodeDraft(value + key);
    }
    expect(value).toBe("vcb-ngu-phap");
  });

  it("vẫn chặn ký tự lạ và không cho hai gạch liền", () => {
    expect(flashcardDeckCodeDraft("VCB Ngữ")).toBe("vcb-ng-");
    expect(flashcardDeckCodeDraft("vcb--bank")).toBe("vcb-bank");
    expect(flashcardDeckCodeDraft("Sách_2026")).toBe("s-ch-2026");
  });

  /**
   * ⚠️ BẤT BIẾN QUAN TRỌNG NHẤT của cặp hàm này — nó là thứ giữ cho việc có hai
   * hàm KHÔNG trở thành hai nguồn sự thật (`BUG_M10_01`).
   *
   * Bản "đang gõ" chỉ được phép lọc bớt, tuyệt đối không cho qua thứ mà `…Slug`
   * sẽ đổi. Nói cách khác: chuẩn hoá trước hay sau đều phải ra cùng một mã, nên
   * cái người dùng nhìn thấy chính là cái Zod và DB sẽ lưu.
   */
  it.each([
    "VCB-BANK",
    "VCB Ngữ Pháp",
    "  HSK 1 (A)  ",
    "--vcb--bank--",
    "Sách_2026",
    "vcb-",
    "-",
    "###",
    "",
    `${"a".repeat(39)} bank`,
    "a".repeat(60),
  ])("chuẩn hoá trước hay sau đều ra cùng một mã: %j", (raw) => {
    expect(flashcardDeckCodeSlug(flashcardDeckCodeDraft(raw))).toBe(
      flashcardDeckCodeSlug(raw),
    );
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
