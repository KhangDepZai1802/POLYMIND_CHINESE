/**
 * Pinyin của thẻ từ vựng có HAI dạng hiển thị nhưng chỉ MỘT dạng được lưu.
 *
 * §7ter phát hiện 1 (`docs/10-yeu-cau-flashcard-quizlet.md`):
 *  - mặt trước cần dạng **tách âm tiết** (`hú luó bo`) để căn thẳng mỗi âm trên
 *    đúng chữ Hán bên dưới;
 *  - mặt sau cần dạng **viết liền đúng chính tả** (`húluóbo`).
 *
 * Ta lưu dạng TÁCH (`flashcard_pages.pinyin_syllables`) và suy ra dạng viết liền
 * khi hiển thị. Chiều ngược lại **không tự động hoá được** — máy không cắt chắc
 * chắn `húluóbo` thành ba âm tiết, nên không có hàm nào làm việc đó ở đây.
 */

/** `"  hú   luó bo "` → `["hú", "luó", "bo"]`. */
export function splitPinyinSyllables(pinyinSyllables: string): string[] {
  return pinyinSyllables.trim().split(/\s+/).filter(Boolean);
}

/** `"hú luó bo"` → `"húluóbo"` — dạng viết liền của mặt sau. */
export function joinPinyin(pinyinSyllables: string): string {
  return splitPinyinSyllables(pinyinSyllables).join("");
}

/**
 * Tách Hán tự thành từng ký tự theo **code point**, không theo UTF-16 unit —
 * nếu dùng `split("")` thì ký tự nằm ngoài BMP bị cắt đôi thành hai nửa rác.
 */
export function splitHanziCharacters(hanzi: string): string[] {
  return [...hanzi.trim()].filter((character) => character.trim() !== "");
}

export type PinyinAlignmentCell = { hanzi: string; pinyin: string };

/**
 * Ghép từng âm tiết pinyin lên đúng chữ Hán bên dưới.
 *
 * Trả `null` khi số âm tiết KHÔNG khớp số chữ Hán. Cố ý không "căn đại" phần
 * khớp được: căn lệch trông vẫn như dữ liệu thật nên người soạn sẽ không nhận ra
 * mình gõ thiếu âm tiết. Nơi gọi phải bắt `null` và lùi về hiển thị pinyin
 * nguyên dòng — sai lệch nhìn thấy được vẫn tốt hơn sai lệch im lặng.
 */
export function alignPinyinToHanzi(
  hanzi: string,
  pinyinSyllables: string,
): PinyinAlignmentCell[] | null {
  const characters = splitHanziCharacters(hanzi);
  const syllables = splitPinyinSyllables(pinyinSyllables);
  if (characters.length === 0 || characters.length !== syllables.length) {
    return null;
  }
  return characters.map((character, index) => ({
    hanzi: character,
    pinyin: syllables[index]!,
  }));
}
