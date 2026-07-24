import { describe, expect, it } from "vitest";

import { flashcardPageSchema } from "@/features/flashcards/schema";

const ID = "44444444-4444-4444-8444-444444444444";
const SECTION_ID = "33333333-3333-4333-8333-333333333333";
const PREFIX = "11111111-1111-4111-8111-111111111111/d/s/p";

function issuePaths(result: { success: boolean; error?: unknown }) {
  const error = (result as { error?: { issues: { path: PropertyKey[] }[] } })
    .error;
  return (error?.issues ?? []).map((issue) => issue.path.join("."));
}

describe("flashcardPageSchema — hai nhánh theo kind", () => {
  it("trang mở đầu cần đúng hai ảnh và không nhận trường chữ", () => {
    const parsed = flashcardPageSchema.safeParse({
      id: ID,
      section_id: SECTION_ID,
      kind: "session_cover",
      front_image_path: `${PREFIX}/front-a.png`,
      back_image_path: `${PREFIX}/back-a.png`,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.kind).toBe("session_cover");
    // Chốt `Q5`: trang mở đầu không có chữ, không có mp3 — nhánh này không hề
    // khai các trường đó nên chúng không thể lọt vào đường ghi.
    expect("hanzi" in parsed.data).toBe(false);
    expect("audio_path" in parsed.data).toBe(false);
  });

  it("trang mở đầu thiếu ảnh thì báo đúng ô nào thiếu", () => {
    const parsed = flashcardPageSchema.safeParse({
      id: ID,
      section_id: SECTION_ID,
      kind: "session_cover",
      front_image_path: `${PREFIX}/front-a.png`,
      back_image_path: "",
    });

    expect(parsed.success).toBe(false);
    expect(issuePaths(parsed)).toContain("back_image_path");
  });

  it("thẻ từ vựng bắt buộc hanzi, pinyin và nghĩa", () => {
    const parsed = flashcardPageSchema.safeParse({
      id: ID,
      section_id: SECTION_ID,
      kind: "vocabulary",
      hanzi: "",
      pinyin_syllables: "",
      meaning_vi: "",
    });

    expect(parsed.success).toBe(false);
    const paths = issuePaths(parsed);
    expect(paths).toContain("hanzi");
    expect(paths).toContain("pinyin_syllables");
    expect(paths).toContain("meaning_vi");
  });

  it("audio KHÔNG bắt buộc ở mức hàng — nó là luật ở mức CÔNG BỐ", () => {
    // Migration 72 chuyển luật audio xuống `validate_flashcard_section_publish`
    // vì đường nhập hàng loạt không nhập audio. Ép ở Zod thì admin không mở
    // được thẻ vừa nhập ra sửa nghĩa.
    const parsed = flashcardPageSchema.safeParse({
      id: ID,
      section_id: SECTION_ID,
      kind: "vocabulary",
      hanzi: "汇款",
      pinyin_syllables: "huì kuǎn",
      meaning_vi: "Chuyển khoản",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success || parsed.data.kind !== "vocabulary") return;
    expect(parsed.data.audio_path).toBeNull();
  });

  it("thẻ từ vựng hợp lệ khi KHÔNG có ảnh nào (§7ter: ảnh tuỳ chọn)", () => {
    const parsed = flashcardPageSchema.safeParse({
      id: ID,
      section_id: SECTION_ID,
      kind: "vocabulary",
      hanzi: "胡萝卜",
      pinyin_syllables: "hú luó bo",
      meaning_vi: "Củ cà rốt",
      audio_path: `${PREFIX}/audio-a.mp3`,
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success || parsed.data.kind !== "vocabulary") return;
    expect(parsed.data.audio_path).toBe(`${PREFIX}/audio-a.mp3`);
    expect(parsed.data.front_image_path).toBeNull();
    expect(parsed.data.back_image_path).toBeNull();
    expect(parsed.data.example_sentences).toEqual([]);
    expect(parsed.data.common_phrases).toEqual([]);
  });

  it("từ chối hai mặt dùng CHUNG một file ảnh", () => {
    // Chốt user 2026-07-23 ở `P16-T1`: giữ nguyên
    // `flashcard_pages_distinct_media_check`, §7ter khối 2 sửa theo. Zod chặn
    // trước để người soạn nghe câu tiếng Việt chứ không phải lỗi constraint.
    const parsed = flashcardPageSchema.safeParse({
      id: ID,
      section_id: SECTION_ID,
      kind: "vocabulary",
      hanzi: "胡萝卜",
      pinyin_syllables: "hú luó bo",
      meaning_vi: "Củ cà rốt",
      audio_path: `${PREFIX}/audio-a.mp3`,
      front_image_path: `${PREFIX}/front-a.png`,
      back_image_path: `${PREFIX}/front-a.png`,
    });

    expect(parsed.success).toBe(false);
    expect(issuePaths(parsed)).toContain("back_image_path");
  });

  it("đọc ba danh sách con từ chuỗi JSON của FormData", () => {
    const parsed = flashcardPageSchema.safeParse({
      id: ID,
      section_id: SECTION_ID,
      kind: "vocabulary",
      hanzi: "胡萝卜",
      pinyin_syllables: "hú luó bo",
      meaning_vi: "Củ cà rốt",
      audio_path: `${PREFIX}/audio-a.mp3`,
      example_sentences: JSON.stringify([
        {
          hanzi: "我喜欢吃胡萝卜。",
          pinyin: "wǒ xǐhuan chī húluóbo",
          meaning_vi: "Tôi thích ăn cà rốt.",
          image_path: `${PREFIX}/example-0-a.png`,
        },
      ]),
      common_phrases: JSON.stringify([
        { hanzi: "吃胡萝卜", pinyin: "chī húluóbo", meaning_vi: "ăn cà rốt" },
      ]),
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success || parsed.data.kind !== "vocabulary") return;
    expect(parsed.data.example_sentences[0]?.image_path).toBe(
      `${PREFIX}/example-0-a.png`,
    );
    // Câu ví dụ không kèm ảnh phải ra `null`, không phải chuỗi rỗng — cột
    // `media_paths` và trigger DB đều lọc theo "có đường dẫn hay không".
    expect(parsed.data.common_phrases).toHaveLength(1);
  });

  it("câu ví dụ thiếu ảnh vẫn hợp lệ và image_path chuẩn hoá về null", () => {
    const parsed = flashcardPageSchema.safeParse({
      id: ID,
      section_id: SECTION_ID,
      kind: "vocabulary",
      hanzi: "胡萝卜",
      pinyin_syllables: "hú luó bo",
      meaning_vi: "Củ cà rốt",
      audio_path: `${PREFIX}/audio-a.mp3`,
      example_sentences: JSON.stringify([
        {
          hanzi: "我吃胡萝卜。",
          pinyin: "wǒ chī húluóbo",
          meaning_vi: "Tôi ăn cà rốt.",
          image_path: "",
        },
      ]),
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success || parsed.data.kind !== "vocabulary") return;
    expect(parsed.data.example_sentences[0]?.image_path).toBeNull();
  });

  it("JSON hỏng báo bằng tiếng Việt, không đẩy lỗi parse ra giao diện", () => {
    const parsed = flashcardPageSchema.safeParse({
      id: ID,
      section_id: SECTION_ID,
      kind: "vocabulary",
      hanzi: "胡萝卜",
      pinyin_syllables: "hú luó bo",
      meaning_vi: "Củ cà rốt",
      audio_path: `${PREFIX}/audio-a.mp3`,
      common_phrases: "{ đây không phải JSON",
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const message = parsed.error.issues
      .map((issue) => issue.message)
      .join(" | ");
    expect(message).toContain("Cụm từ thường dùng");
    expect(message).not.toContain("JSON.parse");
  });

  it("từ chối mục danh sách con thiếu trường", () => {
    const parsed = flashcardPageSchema.safeParse({
      id: ID,
      section_id: SECTION_ID,
      kind: "vocabulary",
      hanzi: "胡萝卜",
      pinyin_syllables: "hú luó bo",
      meaning_vi: "Củ cà rốt",
      audio_path: `${PREFIX}/audio-a.mp3`,
      // Mục cụm từ thiếu `meaning_vi` — Zod là chỗ cưỡng chế duy nhất cho hình
      // dạng của `jsonb`, nên bài này phải chỉ đúng vào trường thiếu.
      common_phrases: JSON.stringify([{ hanzi: "萝卜", pinyin: "luóbo" }]),
    });

    expect(parsed.success).toBe(false);
    expect(
      issuePaths(parsed).some((path) => path.startsWith("common_phrases")),
    ).toBe(true);
  });
});
