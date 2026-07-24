import { describe, expect, it } from "vitest";

import {
  alignPinyinToHanzi,
  joinPinyin,
  splitHanziCharacters,
  splitPinyinSyllables,
} from "@/features/flashcards/domain/pinyin";

describe("pinyin của thẻ từ vựng", () => {
  it("cắt dạng tách âm tiết thành dạng viết liền của mặt sau", () => {
    // Đúng ví dụ §7ter: mặt trước `hú luó bo`, mặt sau `húluóbo`.
    expect(joinPinyin("hú luó bo")).toBe("húluóbo");
    expect(joinPinyin("  nǐ   hǎo  ")).toBe("nǐhǎo");
    expect(joinPinyin("xiè")).toBe("xiè");
    expect(joinPinyin("   ")).toBe("");
  });

  it("tách âm tiết bỏ qua khoảng trắng thừa", () => {
    expect(splitPinyinSyllables(" hú  luó\tbo ")).toEqual(["hú", "luó", "bo"]);
    expect(splitPinyinSyllables("")).toEqual([]);
  });

  it("tách Hán tự theo code point chứ không theo UTF-16 unit", () => {
    expect(splitHanziCharacters("胡萝卜")).toEqual(["胡", "萝", "卜"]);
    // Ký tự ngoài BMP: `split("")` sẽ cắt đôi thành hai nửa rác.
    expect(splitHanziCharacters("𠮷")).toEqual(["𠮷"]);
    expect(splitHanziCharacters("  ")).toEqual([]);
  });

  it("căn mỗi âm tiết lên đúng chữ Hán bên dưới", () => {
    expect(alignPinyinToHanzi("胡萝卜", "hú luó bo")).toEqual([
      { hanzi: "胡", pinyin: "hú" },
      { hanzi: "萝", pinyin: "luó" },
      { hanzi: "卜", pinyin: "bo" },
    ]);
  });

  it("trả null khi số âm tiết KHÔNG khớp số chữ Hán", () => {
    // Cố ý không căn phần khớp được: căn lệch trông vẫn như dữ liệu thật nên
    // người soạn sẽ không nhận ra mình gõ thiếu âm tiết.
    expect(alignPinyinToHanzi("胡萝卜", "hú luó")).toBeNull();
    expect(alignPinyinToHanzi("胡萝卜", "hú luó bo de")).toBeNull();
    expect(alignPinyinToHanzi("", "hú")).toBeNull();
    expect(alignPinyinToHanzi("胡", "")).toBeNull();
  });
});
