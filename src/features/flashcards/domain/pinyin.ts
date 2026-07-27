/**
 * Pinyin của thẻ từ vựng có HAI dạng hiển thị nhưng chỉ MỘT dạng được lưu.
 *
 *  - mặt trước hiện dạng **tách âm tiết** (`hú luó bo`) nguyên một dòng;
 *  - mặt sau hiện dạng **viết liền đúng chính tả** (`húluóbo`).
 *
 * Ta lưu dạng TÁCH (`flashcard_pages.pinyin_syllables`) và suy ra dạng viết liền
 * khi hiển thị. Chiều ngược lại **không tự động hoá được** — máy không cắt chắc
 * chắn `húluóbo` thành ba âm tiết, nên không có hàm nào làm việc đó ở đây.
 *
 * 📌 **Đã gỡ 2026-07-25: `alignPinyinToHanzi` + `splitHanziCharacters`.** Chúng
 * phục vụ bố cục cũ của `§7ter` — mỗi âm tiết căn thẳng trên đúng chữ Hán. User
 * chốt bỏ bố cục đó (ba dòng xếp dọc, Hán tự viết sát nhau không phụ thuộc độ
 * dài pinyin), nên hai hàm hết chỗ dùng và không được giữ lại làm code chết. Cần
 * lại thì lấy từ git — quy tắc gốc còn ghi ở `docs/10-yeu-cau-flashcard-quizlet.md`.
 */

/** `"  hú   luó bo "` → `["hú", "luó", "bo"]`. */
export function splitPinyinSyllables(pinyinSyllables: string): string[] {
  return pinyinSyllables.trim().split(/\s+/).filter(Boolean);
}

/** `"hú luó bo"` → `"húluóbo"` — dạng viết liền của mặt sau. */
export function joinPinyin(pinyinSyllables: string): string {
  return splitPinyinSyllables(pinyinSyllables).join("");
}
