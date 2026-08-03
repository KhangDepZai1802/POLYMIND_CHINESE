import type { UserRole } from "@/types/roles";

/**
 * Khu vực route của mỗi role.
 *
 * ⚠️ `academic_manager` KHÔNG có cây route mang tên nó. Bản cũ dựng đường bằng
 * `/${role}` nên giáo vụ nhận `/academic_manager/notifications` — một route
 * không tồn tại, chuông thông báo bấm vào ra 404 (`GIAOVU-NOTIFY-004`, Codex
 * tìm ra 2026-08-03). Không suy đường từ tên role nữa; tra bảng.
 */
const ROLE_ROOTS: Record<UserRole, readonly string[]> = {
  super_admin: ["/admin"],
  // Giáo vụ sống ở HAI cây (`D-2`): quản lý ở `/admin`, lớp được phân công ở
  // `/teacher`. Phần tử ĐẦU là nhà chính — nơi các đường mặc định trỏ về.
  academic_manager: ["/admin", "/teacher"],
  teacher: ["/teacher"],
  student: ["/student"],
};

export function notificationPathForRole(role: UserRole): string {
  return `${ROLE_ROOTS[role][0]}/notifications`;
}

/**
 * Notification link chỉ là điều hướng, không phải quyền. Chỉ render route nội bộ
 * trong đúng khu vực role; route đích vẫn tự kiểm role/RLS khi người dùng mở.
 *
 * Fail-closed giữ nguyên: link rỗng, link tuyệt đối, hay link nằm ngoài MỌI
 * khu vực của role đều trả `null`. Giáo vụ được nhận link ở cả hai cây vì họ
 * thật sự vào được cả hai — một thông báo về buổi dạy trỏ `/teacher/...`, một
 * thông báo về học phí trỏ `/admin/...`.
 */
export function safeNotificationLink(
  link: string | null,
  role: UserRole,
): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return null;

  const allowed = ROLE_ROOTS[role].some(
    (root) => link === root || link.startsWith(`${root}/`),
  );

  return allowed ? link : null;
}
