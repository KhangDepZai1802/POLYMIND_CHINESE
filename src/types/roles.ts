/**
 * Ba role cố định của hệ thống. Không thêm role thứ tư mà không sửa docs 01 §5
 * và toàn bộ RLS matrix (docs 02 §6).
 *
 * Đặc biệt: KHÔNG có role phụ huynh. Thông tin người giám hộ chỉ là field liên hệ
 * trên hồ sơ học viên.
 */
export const USER_ROLES = ["super_admin", "teacher", "student"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Quản trị viên",
  teacher: "Giáo viên",
  student: "Học viên",
};

export function isUserRole(value: unknown): value is UserRole {
  return (
    typeof value === "string" && USER_ROLES.includes(value as UserRole)
  );
}
