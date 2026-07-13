import type { ZodError } from "zod";

/**
 * Kết quả trả về của server action, dùng chung cho mọi form.
 */
export type ActionState = {
  error?: string;
  success?: string;
  /** Lỗi theo từng field, để hiển thị ngay dưới ô nhập. */
  fieldErrors?: Record<string, string>;
};

export const EMPTY_ACTION_STATE: ActionState = {};

export function zodToActionState(error: ZodError): ActionState {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return {
    error: "Dữ liệu chưa hợp lệ. Vui lòng kiểm tra lại.",
    fieldErrors,
  };
}

/**
 * Dịch lỗi Postgres sang thông báo người dùng đọc được.
 *
 * Không ném nguyên văn lỗi DB ra UI: nó lộ tên bảng, tên constraint, cấu trúc
 * schema — thông tin miễn phí cho kẻ tấn công, và vô nghĩa với người dùng.
 */
export function dbErrorToMessage(
  error: { code?: string; message?: string } | null,
  fallback = "Không thực hiện được. Vui lòng thử lại.",
): string {
  if (!error) return fallback;

  switch (error.code) {
    case "23505": // unique_violation
      return "Dữ liệu đã tồn tại (mã bị trùng). Vui lòng dùng mã khác.";
    case "23503": // foreign_key_violation
      return "Không thể thực hiện vì dữ liệu đang được sử dụng ở nơi khác.";
    case "23514": // check_violation
      return "Giá trị nhập không hợp lệ.";
    case "42501": // insufficient_privilege
      return "Bạn không có quyền thực hiện thao tác này.";
    case "P0001": // raise_exception — thông điệp do chính RPC của ta viết, an toàn
      return error.message ?? fallback;
    default:
      return fallback;
  }
}
