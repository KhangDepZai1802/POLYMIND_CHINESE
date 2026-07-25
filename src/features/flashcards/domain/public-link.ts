/**
 * Mã liên kết công khai in trong sách giáo khoa.
 *
 * Hình dạng phải khớp CHÍNH XÁC với `flashcard_public_links_token_shape_check`
 * và vế lọc trong `public.get_public_flashcard_session` (migration `…080`).
 * Hai nơi cùng một luật là cố ý: tầng app chặn trước để token rác không bao giờ
 * chạm tới DB, DB chặn sau vì tầng app không phải chốt chặn cuối.
 */

/**
 * 32 ký tự, cố ý BỎ `i` `l` `o` `u`.
 *
 * Mã này được in ra giấy rồi có người gõ lại bằng tay, mà đọc nhầm `1/l` và
 * `0/O` là chuyện có thật. Bỏ `u` để tránh sinh ra vài tổ hợp chữ thô tục
 * ngoài ý muốn trên bìa sách.
 */
export const FLASHCARD_PUBLIC_TOKEN_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/** 12 ký tự × 5 bit = 60 bit ngẫu nhiên. */
export const FLASHCARD_PUBLIC_TOKEN_LENGTH = 12;

const TOKEN_PATTERN = /^[0-9a-hjkmnp-tv-z]{12}$/;

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
  return TOKEN_PATTERN.test(value) ? value : null;
}

/** Địa chỉ đầy đủ để admin sao chép đem đi in mã QR. */
export function flashcardPublicUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/t/${token}`;
}
