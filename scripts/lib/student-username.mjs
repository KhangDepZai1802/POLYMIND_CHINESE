/**
 * CÔNG THỨC TÊN ĐĂNG NHẬP CỦA HỌC VIÊN — `đệm+tên.họ`, bỏ dấu.
 *
 * Ví dụ chuẩn (user chốt 2026-08-03): `Nguyễn Văn Ngà` → `vannga.nguyen`.
 *
 * 🔴 VÌ SAO LÀ `đệm+tên` CHỨ KHÔNG PHẢI `tên` KHÔNG: bản đầu định dùng `tên.họ`
 * cho giống giáo viên (`son.pham`). Đo trên đúng 55 người của danh sách thật thì
 * **Nguyễn Hữu Ngọc Ng`a`** và **Nguyễn Văn Ng`à`** cùng ra `nga.nguyen` — bỏ dấu
 * xong hai cái tên khác nhau thành một. Gộp cả phần đệm vào thì 55/55 duy nhất
 * mà không ai bị gắn số thứ tự.
 *
 * ⛔ Hàm này KHÔNG tự chống trùng. Trùng là chuyện phải để người quyết, không
 * phải chuyện script âm thầm thêm `2` phía sau rồi phát nhầm tài khoản cho người
 * khác. Bên gọi (`provision-student-accounts.mjs`) có cổng fail-closed dừng cả
 * lô khi phát hiện trùng.
 *
 * File này là .mjs (không phải .ts) vì script dữ liệu chạy bằng `node` trần,
 * không qua bundler. `USERNAME_PATTERN` bên dưới là bản sao của
 * `src/features/users/account.ts`; `tests/unit/student-username.test.ts` có một
 * bài ghim hai bản phải bằng nhau đúng từng ký tự, để chúng không âm thầm lệch
 * nhau thành hai nguồn sự thật.
 */

/** Bản sao của `USERNAME_PATTERN` trong `src/features/users/account.ts`. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

/** Bản sao của `INTERNAL_LOGIN_DOMAIN` trong `src/features/users/account.ts`. */
export const INTERNAL_LOGIN_DOMAIN = "login.polymind.local";

/**
 * Bỏ dấu tiếng Việt và mọi ký tự không phải `[a-z0-9]`.
 *
 * `đ`/`Đ` phải xử lý riêng: NFD tách được dấu thanh và dấu mũ, nhưng `đ` là một
 * ký tự Latin độc lập (U+0111) chứ không phải `d` + dấu, nên `normalize` không
 * đụng tới nó.
 */
export function asciiSlug(value) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function usernameToLoginEmail(username) {
  return `${username}@${INTERNAL_LOGIN_DOMAIN}`;
}

/**
 * `Họ Đệm Tên` → `{ ok: true, username: "demten.ho" }`.
 *
 * Trả về `{ ok: false, reason }` thay vì ném lỗi: bên gọi cần gom HẾT các ca
 * hỏng để in ra một lần rồi mới dừng, chứ không phải dừng ở người đầu tiên.
 */
export function buildStudentUsername(fullName) {
  const words = String(fullName ?? "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length < 2) {
    return {
      ok: false,
      reason: `Họ tên "${fullName}" chỉ có ${words.length} từ — không tách được họ và tên.`,
    };
  }

  const surname = asciiSlug(words[0]);
  const rest = asciiSlug(words.slice(1).join(""));

  if (!surname || !rest) {
    return {
      ok: false,
      reason: `Họ tên "${fullName}" không còn ký tự Latin nào sau khi bỏ dấu.`,
    };
  }

  const username = `${rest}.${surname}`;

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      reason: `"${fullName}" → "${username}" (${username.length} ký tự) không khớp định dạng tên đăng nhập 3–32 ký tự.`,
    };
  }

  return { ok: true, username };
}
