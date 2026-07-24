import { describe, expect, it } from "vitest";

import {
  flashcardImportKey,
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
      example_sentences: [],
      common_phrases: [],
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
    // ✏️ Sửa 2026-07-24 (`D-35` điểm 1): dòng thứ ba trước đây là
    // `"… | thừa cột"` (4 cột) và bài kiểm ghim `toContain("4 cột")`. Định dạng
    // mới nhận 4 cột — cột 4 CHÍNH LÀ câu ví dụ — nên vế đó không còn đúng nữa
    // và không thể giữ nguyên. Thay bằng dòng 6 cột để vẫn ghim đúng điều bài
    // này thật sự canh: **mỗi dòng mang lỗi của riêng nó**.
    const parsed = parseFlashcardImportText(
      [
        "苹果 | píng guǒ | Quả táo",
        "thiếu cột",
        "香蕉 | xiāng jiāo | Quả chuối | a | b | thừa cột",
        " | píng guǒ | Quả táo",
      ].join("\n"),
    );

    expect(parsed[0]?.error).toBeNull();
    expect(parsed[1]?.error).toContain("3 cột");
    expect(parsed[2]?.error).toContain("6 cột");
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

describe("nhập hàng loạt kèm câu ví dụ và cụm từ (D-35 điểm 1)", () => {
  it("dòng 3 cột vẫn chạy y hệt — hai danh sách con là mảng rỗng", () => {
    // Đây là bằng chứng TƯƠNG THÍCH NGƯỢC: định dạng cũ không được đổi nghĩa.
    const parsed = parseFlashcardImportText("苹果 | píng guǒ | Quả táo");

    expect(parsed[0]?.error).toBeNull();
    expect(parsed[0]?.row?.example_sentences).toEqual([]);
    expect(parsed[0]?.row?.common_phrases).toEqual([]);
  });

  it("đọc được nhiều mục ngăn bằng ;; và ba trường ngăn bằng ~", () => {
    const parsed = parseFlashcardImportText(
      "你好 | nǐ hǎo | Xin chào | 你好吗？~nǐ hǎo ma~Bạn khỏe không?;;你好，老师~nǐ hǎo lǎo shī~Chào thầy | 你好啊~nǐ hǎo a~Chào cậu",
    );

    expect(parsed[0]?.error).toBeNull();
    expect(parsed[0]?.row?.example_sentences).toEqual([
      {
        hanzi: "你好吗？",
        pinyin: "nǐ hǎo ma",
        meaning_vi: "Bạn khỏe không?",
        image_path: null,
      },
      {
        hanzi: "你好，老师",
        pinyin: "nǐ hǎo lǎo shī",
        meaning_vi: "Chào thầy",
        image_path: null,
      },
    ]);
    expect(parsed[0]?.row?.common_phrases).toEqual([
      { hanzi: "你好啊", pinyin: "nǐ hǎo a", meaning_vi: "Chào cậu" },
    ]);
  });

  it("chỉ có cột 4, bỏ trống cột 5 — vẫn hợp lệ", () => {
    const parsed = parseFlashcardImportText(
      "苹果 | píng guǒ | Quả táo | 我吃苹果。~wǒ chī píngguǒ~Tôi ăn táo.",
    );

    expect(parsed[0]?.error).toBeNull();
    expect(parsed[0]?.row?.example_sentences).toHaveLength(1);
    expect(parsed[0]?.row?.common_phrases).toEqual([]);
  });

  it("🔴 lỗi chỉ ĐÚNG MỤC CON nào hỏng, không phải một câu chung cho cả dòng", () => {
    // Đây là điều tôi cam kết khi user chọn định dạng "một dòng chứa tất cả":
    // dòng dài thì phải nói chính xác hỏng ở mục nào, nếu không người soạn phải
    // tự dò cả dòng.
    const parsed = parseFlashcardImportText(
      [
        "你好 | nǐ hǎo | Xin chào | 你好吗？~nǐ hǎo ma~Bạn khỏe không?;;你好，老师~nǐ hǎo lǎo shī",
        "苹果 | píng guǒ | Quả táo | 我吃苹果。~wǒ chī píngguǒ~Tôi ăn táo. | 吃苹果~~ăn táo",
        "香蕉 | xiāng jiāo | Quả chuối | 我~a~b~c",
      ].join("\n"),
    );

    expect(parsed[0]?.error).toBe(
      "Dòng 1, câu ví dụ #2: có 2 phần, cần đúng 3 phần ngăn bằng dấu ~ (Hán tự ~ pinyin ~ nghĩa).",
    );
    expect(parsed[1]?.error).toBe("Dòng 2, cụm từ #1: thiếu pinyin.");
    expect(parsed[2]?.error).toContain("Dòng 3, câu ví dụ #1: có 4 phần");
    expect(importableRows(parsed)).toHaveLength(0);
  });

  it("thiếu hai trường thì nêu đủ cả hai", () => {
    const parsed = parseFlashcardImportText(
      "苹果 | píng guǒ | Quả táo | 我吃苹果。~~",
    );

    expect(parsed[0]?.error).toBe(
      "Dòng 1, câu ví dụ #1: thiếu pinyin và nghĩa tiếng Việt.",
    );
  });

  it("dấu ;; thừa hoặc ở cuối không sinh mục rỗng", () => {
    const parsed = parseFlashcardImportText(
      "苹果 | píng guǒ | Quả táo | 我吃苹果。~wǒ chī píngguǒ~Tôi ăn táo.;; | ",
    );

    expect(parsed[0]?.error).toBeNull();
    expect(parsed[0]?.row?.example_sentences).toHaveLength(1);
    expect(parsed[0]?.row?.common_phrases).toEqual([]);
  });

  it("quá số mục tối đa thì báo rõ đang có bao nhiêu", () => {
    const many = Array.from(
      { length: 9 },
      (_, index) => `句${index}~jù~câu ${index}`,
    ).join(";;");
    const parsed = parseFlashcardImportText(
      `苹果 | píng guǒ | Quả táo | ${many}`,
    );

    expect(parsed[0]?.error).toBe("Dòng 1: có 9 câu ví dụ, tối đa 8.");
  });

  it("thẻ ĐÃ CÓ trong buổi thì bỏ qua CẢ KHỐI và nói rõ (D-35 điểm 3)", () => {
    const existing = new Set([flashcardImportKey("苹果", "píng guǒ")]);
    const parsed = parseFlashcardImportText(
      [
        "苹果 | píng guǒ | Quả táo sửa lại | 我吃苹果。~wǒ chī píngguǒ~Tôi ăn táo.",
        "香蕉 | xiāng jiāo | Quả chuối",
      ].join("\n"),
      existing,
    );

    expect(parsed[0]?.duplicateOfExisting).toBe(true);
    expect(parsed[0]?.error).toContain("bỏ qua");
    // Không gửi lên server ⇒ câu ví dụ mới KHÔNG ghi đè thẻ đã soạn tay.
    expect(importableRows(parsed)).toHaveLength(1);
    expect(importableRows(parsed)[0]?.hanzi).toBe("香蕉");
  });

  it("chữ đa âm vẫn không bị coi là trùng với thẻ đã có", () => {
    const existing = new Set([flashcardImportKey("行", "xíng")]);
    const parsed = parseFlashcardImportText("行 | háng | hàng, nghề", existing);

    expect(parsed[0]?.duplicateOfExisting).toBe(false);
    expect(importableRows(parsed)).toHaveLength(1);
  });
});
