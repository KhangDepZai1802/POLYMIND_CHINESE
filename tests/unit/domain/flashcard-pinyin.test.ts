import { describe, expect, it } from "vitest";

import {
  joinPinyin,
  splitPinyinSyllables,
} from "@/features/flashcards/domain/pinyin";

/**
 * 📌 **Đã bỏ 2026-07-25: các case của `alignPinyinToHanzi` và
 * `splitHanziCharacters`.** Hai hàm đó phục vụ bố cục cũ (mỗi âm tiết pinyin căn
 * thẳng trên đúng chữ Hán, `§7ter`). User chốt bỏ bố cục đó — mặt trước nay là ba
 * dòng xếp dọc và Hán tự viết sát nhau — nên hàm hết chỗ dùng, và bài kiểm cho
 * code không còn tồn tại thì cũng không được giữ.
 */
describe("pinyin của thẻ từ vựng", () => {
  it("cắt dạng tách âm tiết thành dạng viết liền của mặt sau", () => {
    // Mặt trước hiện `hú luó bo`, mặt sau hiện `húluóbo`.
    expect(joinPinyin("hú luó bo")).toBe("húluóbo");
    expect(joinPinyin("  nǐ   hǎo  ")).toBe("nǐhǎo");
    expect(joinPinyin("xiè")).toBe("xiè");
    expect(joinPinyin("   ")).toBe("");
  });

  it("tách âm tiết bỏ qua khoảng trắng thừa", () => {
    expect(splitPinyinSyllables(" hú  luó\tbo ")).toEqual(["hú", "luó", "bo"]);
    expect(splitPinyinSyllables("")).toEqual([]);
  });
});
