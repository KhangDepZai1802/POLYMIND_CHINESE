import type { UserRole } from "@/types/roles";

/**
 * Mỗi role có đúng một cây route. Không chồng lấn.
 */
const ROLE_ROUTE_PREFIX: Record<UserRole, string> = {
  super_admin: "/admin",
  teacher: "/teacher",
  student: "/student",
};

export function homePathForRole(role: UserRole): string {
  return ROLE_ROUTE_PREFIX[role];
}

/**
 * Role này có được phép ở trên path này không?
 *
 * Fail-closed: path nằm trong khu vực của MỘT role khác → từ chối. Path lạ
 * (không thuộc khu vực nào) → cũng từ chối, vì mọi trang nghiệp vụ đều phải
 * nằm dưới một trong ba prefix. Không có nhánh `return true` mặc định — đây
 * đúng là lỗi đã làm hệ cũ "nhắn loạn xạ" (CR-M14-3).
 */
export function isRoleAllowedOnPath(role: UserRole, pathname: string): boolean {
  const ownPrefix = ROLE_ROUTE_PREFIX[role];

  return pathname === ownPrefix || pathname.startsWith(`${ownPrefix}/`);
}
