import { describe, expect, it } from "vitest";

import {
  importableRows,
  parseFlashcardImportText,
} from "@/features/flashcards/domain/bulk-import";

describe("đọc ô dán của nhập hàng loạt", () => {
  it("tách được cả dạng dấu | lẫn dạng Tab", () => {
    const parsed = parseFlashcardImportText(
      ["胡萝卜 | hú luó bo | Củ cà rốt", "苹果\tpíng guǒ\tQuả táo"].join("\n"),
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.row).toEqual({
      hanzi: "胡萝卜",
      pinyin_syllables: "hú luó bo",
      meaning_vi: "Củ cà rốt",
    });
    expect(parsed[1]?.row?.pinyin_syllables).toBe("píng guǒ");
  });

  it("KHÔNG tách theo dấu cách — pinyin và nghĩa đều chứa dấu cách", () => {
    // Đây là chỗ hỏng dễ mắc nhất: tách theo dấu cách sẽ biến "hú luó bo"
    // thành ba cột và cắt nát nghĩa tiếng Việt.
    const parsed = parseFlashcardImportText("胡萝卜 | hú luó bo | Củ cà rốt");
    expect(parsed[0]?.error).toBeNull();
    expect(parsed[0]?.row?.pinyin_syllables).toBe("hú luó bo");
    expect(parsed[0]?.row?.meaning_vi).toBe("Củ cà rốt");
  });

  it("bỏ qua dòng trống và giữ ĐÚNG số dòng người dùng nhìn thấy", () => {
    const parsed = parseFlashcardImportText(
      ["", "苹果 | píng guǒ | Quả táo", "", "香蕉 | xiāng jiāo | Quả chuối"].join(
        "\n",
      ),
    );

    expect(parsed).toHaveLength(2);
    expect(parsed[0]?.lineNumber).toBe(2);
    expect(parsed[1]?.lineNumber).toBe(4);
  });

  it("báo lỗi THEO TỪNG DÒNG, không nuốt cả lô", () => {
    const parsed = parseFlashcardImportText(
      [
        "苹果 | píng guǒ | Quả táo",
        "thiếu cột",
        "香蕉 | xiāng jiāo | Quả chuối | thừa cột",
        " | píng guǒ | Quả táo",
      ].join("\n"),
    );

    expect(parsed[0]?.error).toBeNull();
    expect(parsed[1]?.error).toContain("3 cột");
    expect(parsed[2]?.error).toContain("4 cột");
    expect(parsed[3]?.error).toContain("Hán tự");
    // Dòng hỏng không kéo dòng lành chết theo.
    expect(importableRows(parsed)).toHaveLength(1);
  });

  it("phát hiện trùng ngay trong chính lô đang dán", () => {
    const parsed = parseFlashcardImportText(
      [
        "苹果 | píng guǒ | Quả táo",
        "香蕉 | xiāng jiāo | Quả chuối",
        "苹果 | píng guǒ | Quả táo (nhập lại)",
      ].join("\n"),
    );

    expect(parsed[2]?.duplicateOfLine).toBe(1);
    expect(parsed[2]?.error).toContain("dòng 1");
    expect(importableRows(parsed)).toHaveLength(2);
  });

  it("chữ đa âm KHÔNG bị coi là trùng vì khóa gồm cả pinyin", () => {
    // Cùng lý do khóa DB là (section_id, hanzi, pinyin_syllables):
    // 行 đọc `xíng` (đi) và 行 đọc `háng` (hàng, nghề) là hai từ khác nhau.
    const parsed = parseFlashcardImportText(
      ["行 | xíng | đi, đi bộ", "行 | háng | hàng, nghề"].join("\n"),
    );

    expect(parsed[1]?.duplicateOfLine).toBeNull();
    expect(importableRows(parsed)).toHaveLength(2);
  });
});
