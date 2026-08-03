/**
 * Bốn role của hệ thống. Thêm role thứ năm thì phải sửa cùng một bộ thay đổi:
 * enum `public.user_role` trong DB, docs 01 §5 và RLS matrix docs 02 §6.
 *
 * Đặc biệt: KHÔNG có role phụ huynh. Thông tin người giám hộ chỉ là field liên hệ
 * trên hồ sơ học viên.
 */
export const USER_ROLES = [
  "super_admin",
  "academic_manager",
  "teacher",
  "student",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Quản trị viên",
  academic_manager: "Giáo vụ",
  teacher: "Giáo viên",
  student: "Học viên",
};

/**
 * QUẢN LÝ nghiệp vụ đào tạo — bản sao phía TS của `app.is_manager()` dưới DB.
 *
 * ⚠️ Hai danh sách phải khớp nhau từng phần tử. Lệch một cái là app cho qua còn
 * RLS chặn (người dùng thấy lỗi khó hiểu), hoặc ngược lại — app ẩn nút nhưng RLS
 * vẫn mở, tức `D-13` "ẩn menu ≠ phân quyền" bị vi phạm mà không ai thấy.
 * `tests/unit/permissions/roles.test.ts` ghim cặp này.
 *
 * KHÔNG bao gồm quản trị tài khoản và đọc audit — hai việc đó vẫn chỉ
 * `super_admin` (`D-2`).
 */
export const MANAGER_ROLES = ["super_admin", "academic_manager"] as const;

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.includes(value as UserRole);
}

export function isManagerRole(role: UserRole): boolean {
  return (MANAGER_ROLES as readonly UserRole[]).includes(role);
}
