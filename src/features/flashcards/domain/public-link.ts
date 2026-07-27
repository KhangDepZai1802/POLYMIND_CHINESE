/**
 * Mã liên kết công khai in trong sách giáo khoa.
 *
 * Hình dạng phải khớp CHÍNH XÁC với `flashcard_public_links_token_shape_check`
 * và vế lọc trong `public.get_public_flashcard_session` (migration `…081`).
 * Hai nơi cùng một luật là cố ý: tầng app chặn trước để token rác không bao giờ
 * chạm tới DB, DB chặn sau vì tầng app không phải chốt chặn cuối.
 */

/**
 * 32 ký tự, cố ý BỎ `i` `l` `o` `u` — bảng chữ của mã NGẪU NHIÊN đời `…080`.
 *
 * Mã ngẫu nhiên không còn là đường phát hành mặc định (`D-39`) nhưng các mã đã
 * in vẫn sống, nên hằng số này ở lại: nó là tài liệu về thứ đang chạy ngoài
 * thực địa, không phải mã chết.
 */
export const FLASHCARD_PUBLIC_TOKEN_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/** 12 ký tự × 5 bit = 60 bit ngẫu nhiên (lối phát hành cũ). */
export const FLASHCARD_PUBLIC_TOKEN_LENGTH = 12;

/** Trần độ dài — QR càng dài càng dày, máy đời cũ quét không ra. */
export const FLASHCARD_PUBLIC_TOKEN_MAX_LENGTH = 48;
const TOKEN_MIN_LENGTH = 3;

/**
 * Slug: các cụm chữ-số nối nhau bằng đúng một gạch, không gạch ở hai đầu.
 *
 * Mã ngẫu nhiên 12 ký tự đời cũ LỌT QUA hình dạng này (nó là một cụm chữ-số
 * duy nhất) — đó là điều kiện để migration `…081` không giết mã đã in nào.
 */
const TOKEN_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Chuẩn hoá rồi kiểm hình dạng. Trả `null` nếu không hợp lệ — caller dùng giá
 * trị này để `notFound()` NGAY, không gọi DB.
 *
 * Chấp nhận chữ HOA và khoảng trắng thừa vì người dùng có thể gõ tay từ sách;
 * mọi thứ khác thì từ chối (fail-closed).
 */
export function normalizeFlashcardPublicToken(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase();
  if (
    value.length < TOKEN_MIN_LENGTH ||
    value.length > FLASHCARD_PUBLIC_TOKEN_MAX_LENGTH
  ) {
    return null;
  }
  return TOKEN_PATTERN.test(value) ? value : null;
}

/**
 * Mã CỐ ĐỊNH của một buổi — bản sao y hệt `app.flashcard_fixed_link_token()`
 * (migration `…081`).
 *
 * ⚠️ Hai bản cài đặt cho cùng một công thức là điều bình thường ở đây chứ không
 * phải `BUG_M10_01`: DB là nơi GHI (nguồn sự thật), bản này chỉ để màn Admin
 * **hiện trước** địa chỉ sẽ có trước khi bấm nút, và để bài kiểm đối chiếu hai
 * bên khớp nhau. Không có đường nào dùng giá trị này để ghi xuống DB.
 */
export function flashcardFixedPublicToken(
  courseCode: string,
  sessionNumber: number,
): string | null {
  const slug = courseCode
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) return null;
  if (!Number.isInteger(sessionNumber) || sessionNumber <= 0) return null;

  const token = `${slug}-${String(sessionNumber).padStart(2, "0")}`;
  return normalizeFlashcardPublicToken(token);
}

/** Địa chỉ đầy đủ để admin sao chép đem đi in mã QR. */
export function flashcardPublicUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/t/${token}`;
}
