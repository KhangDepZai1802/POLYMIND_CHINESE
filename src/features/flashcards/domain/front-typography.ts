/**
 * Phân biệt từ/cụm từ với câu để chọn cỡ chữ mặt trước flashcard.
 *
 * Dữ liệu 35 buổi do user cung cấp ngày 2026-07-27 có 564 thẻ:
 * - từ/cụm dài nhất có 9 ký tự Hán;
 * - 5 thẻ dạng câu có dấu kết câu hoặc dài từ 10 ký tự Hán trở lên;
 * - câu dài nhất có 16 ký tự Hán, 54 ký tự pinyin và 63 ký tự tiếng Việt.
 *
 * Vì schema hiện tại không có trường `content_kind`, ta dùng dấu câu làm tín
 * hiệu mạnh và ngưỡng 10 ký tự làm lưới an toàn cho câu không có dấu kết câu.
 * Ngưỡng này được rút từ chính tập dữ liệu thật, không phải đoán theo ví dụ đơn.
 */
const SENTENCE_PUNCTUATION = /[。！？!?；;]|…{2,}/u;
const SENTENCE_MIN_HANZI_LENGTH = 10;

/** Bỏ khoảng trắng trước khi đếm để dữ liệu nhập có/không có khoảng cách như nhau. */
function compactLength(value: string): number {
  return [...value].filter((character) => !/\s/u.test(character)).length;
}

export function isSentenceLikeFlashcardFront(hanzi: string): boolean {
  const normalized = hanzi.trim();
  return (
    SENTENCE_PUNCTUATION.test(normalized) ||
    compactLength(normalized) >= SENTENCE_MIN_HANZI_LENGTH
  );
}

type FlashcardFrontCopy = {
  hanzi: string;
  pinyin: string;
  meaningVi: string;
};

const MIN_SENTENCE_SCALE = 0.62;
const MAX_SENTENCE_SCALE = 0.86;

/**
 * Tỉ lệ khởi đầu cho ba dòng mặt trước.
 *
 * Từ/cụm luôn trả `1`: CSS đã cộng đúng 5px vào từng cỡ chữ theo yêu cầu user.
 * Câu được co liên tục theo dòng nặng nhất trong ba ngôn ngữ; `FitText` sau đó
 * còn đo layout thật và co thêm nếu viewport hẹp làm nội dung vẫn tràn.
 */
export function flashcardFrontInitialScale({
  hanzi,
  pinyin,
  meaningVi,
}: FlashcardFrontCopy): number {
  if (!isSentenceLikeFlashcardFront(hanzi)) return 1;

  /*
   * Một glyph CJK rộng gần một ô vuông, nên nhân 3.2 để đặt tải thị giác của
   * dòng Hán lên cùng thang với số ký tự Latin. Pinyin bỏ khoảng trắng thừa
   * nhưng giữ một khoảng giữa các âm tiết vì khoảng đó vẫn chiếm chiều ngang.
   */
  const normalizedPinyin = pinyin.trim().replace(/\s+/gu, " ");
  const visualLoad = Math.max(
    compactLength(hanzi) * 3.2,
    [...normalizedPinyin].length,
    [...meaningVi.trim()].length,
  );

  // 24 ký tự Latin tương đương một dòng ngắn; mỗi ký tự dư co thêm 0.7%.
  const scale = MAX_SENTENCE_SCALE - Math.max(0, visualLoad - 24) * 0.007;
  return Number(
    Math.max(MIN_SENTENCE_SCALE, Math.min(MAX_SENTENCE_SCALE, scale)).toFixed(3),
  );
}
