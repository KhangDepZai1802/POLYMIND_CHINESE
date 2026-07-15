import type { UserRole } from "@/types/roles";

export function notificationPathForRole(role: UserRole): string {
  return `/${role === "super_admin" ? "admin" : role}/notifications`;
}

/**
 * Notification link chỉ là điều hướng, không phải quyền. Chỉ render route nội bộ
 * trong đúng khu vực role; route đích vẫn tự kiểm role/RLS khi người dùng mở.
 */
export function safeNotificationLink(
  link: string | null,
  role: UserRole,
): string | null {
  if (!link || !link.startsWith("/") || link.startsWith("//")) return null;

  const root = role === "super_admin" ? "/admin" : `/${role}`;
  if (link !== root && !link.startsWith(`${root}/`)) return null;

  return link;
}
