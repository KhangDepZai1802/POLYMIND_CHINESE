import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { homePathForRole } from "@/lib/permissions/routes";
import { createClient } from "@/lib/supabase/server";
import { isUserRole, type UserRole } from "@/types/roles";

export type CurrentUser = {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  avatarPath: string | null;
};

/**
 * Người đang đăng nhập, hoặc `null`.
 *
 * Role đọc từ bảng `profiles` — KHÔNG đọc từ `user.user_metadata` (client sửa
 * được nó; dùng làm nguồn phân quyền là tự mở cửa cho leo thang quyền).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, avatar_path, is_active")
    .eq("id", user.id)
    .single();

  // Fail-closed: thiếu profile hoặc bị khóa → coi như chưa đăng nhập.
  if (!profile || !profile.is_active) return null;
  if (!isUserRole(profile.role)) return null;

  return {
    id: user.id,
    email: user.email ?? "",
    role: profile.role,
    fullName: profile.full_name,
    avatarPath: profile.avatar_path,
  };
});

/** Bắt buộc đã đăng nhập. Chưa → về /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Bắt buộc đúng role. Sai role → đá về khu vực của chính họ.
 *
 * Dùng ở đầu MỌI page và server action. Middleware đã chặn một lớp rồi, nhưng
 * middleware chỉ là lớp UX — server action gọi trực tiếp không đi qua nó.
 */
export async function requireRole(
  ...allowed: readonly UserRole[]
): Promise<CurrentUser> {
  const user = await requireUser();

  if (!allowed.includes(user.role)) {
    redirect(homePathForRole(user.role));
  }

  return user;
}
