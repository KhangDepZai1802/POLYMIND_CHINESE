import type { UserRole } from "@/types/roles";

/**
 * Trang chủ của mỗi role.
 *
 * Giáo vụ về `/admin` — nhánh "Quản lý" là việc chính hằng ngày của họ; nhánh
 * "Lớp được phân công" chỉ có khi họ cũng dạy.
 */
const ROLE_HOME: Record<UserRole, string> = {
  super_admin: "/admin",
  academic_manager: "/admin",
  teacher: "/teacher",
  student: "/student",
};

/**
 * Khu vực mỗi role được phép vào.
 *
 * ⚠️ `D-2` (user chốt 2026-08-03) PHÁ luật cũ *"mỗi role có đúng một cây route,
 * không chồng lấn"*. Giáo vụ cần cả `/admin` (quản lý) lẫn `/teacher` (lớp được
 * phân công), và user đã chọn dùng lại hai cây có sẵn thay vì dựng `/staff/*` —
 * nhân đôi ~10 trang quản lý đúng là hình dạng `BUG_M10_01`.
 *
 * Cái giá của lựa chọn đó: một prefix không còn đồng nghĩa một role, nên
 * **prefix thôi là không đủ** — phải có thêm danh sách chặn theo path.
 */
const ROLE_PREFIXES: Record<UserRole, readonly string[]> = {
  super_admin: ["/admin"],
  academic_manager: ["/admin", "/teacher"],
  teacher: ["/teacher"],
  student: ["/student"],
};

/**
 * Path nằm trong cây được phép NHƯNG vẫn cấm, theo role.
 *
 * Đúng ba trang quản trị mà `D-2` loại khỏi giáo vụ:
 *   • `/admin/system`              — quản trị & audit
 *   • `/admin/flashcards`          — điểm (3), user loại rõ khi được hỏi
 *   • `/admin/question-bank-review`— điểm (3)
 *
 * ⚠️ Đây là lớp UX/điều hướng. Chốt chặn thật là `requireRole`/`requireManager`
 * ở đầu từng page + server action, và cuối cùng là RLS. Xoá dòng nào ở đây
 * KHÔNG mở được cửa nào — nhưng thêm nhầm thì menu và trang nói hai chuyện
 * khác nhau.
 */
const ROLE_DENIED_PATHS: Partial<Record<UserRole, readonly string[]>> = {
  academic_manager: [
    "/admin/system",
    "/admin/flashcards",
    "/admin/question-bank-review",
  ],
};

export function homePathForRole(role: UserRole): string {
  return ROLE_HOME[role];
}

/**
 * Role này có được phép ở trên path này không?
 *
 * Fail-closed: path không thuộc prefix nào của role → từ chối. Path lạ (không
 * thuộc khu vực nào) → cũng từ chối. Không có nhánh `return true` mặc định —
 * đúng là lỗi đã làm hệ cũ "nhắn loạn xạ" (CR-M14-3).
 *
 * Thứ tự xét: CẤM trước, CHO PHÉP sau. Ngược lại thì `/admin` khớp prefix của
 * giáo vụ và `/admin/system` được cho qua.
 */
export function isRoleAllowedOnPath(role: UserRole, pathname: string): boolean {
  const denied = ROLE_DENIED_PATHS[role] ?? [];
  if (denied.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false;
  }

  return ROLE_PREFIXES[role].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
