import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/roles";

export type AccountRow = {
  id: string;
  username: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  /** Mã nghiệp vụ tương ứng (teacher_code / student_code) nếu có. */
  code: string | null;
};

/**
 * Toàn bộ TÀI KHOẢN đăng nhập của hệ thống, mọi role.
 *
 * Nguồn là bảng `profiles` — mỗi dòng ở đây là một `auth.users` thật. Học viên
 * chưa được cấp tài khoản KHÔNG có `profiles` nên không xuất hiện (đúng: trang
 * này quản lý tài khoản, không phải hồ sơ). Super admin có policy RLS `for all`
 * trên `profiles` nên đọc được tất cả mà không cần service role.
 */
export async function getAccounts(search?: string): Promise<AccountRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, username, full_name, email, phone, role, is_active")
    .order("full_name");

  const term = search?.trim().replace(/[%,()]/g, "");
  if (term) {
    query = query.or(
      `full_name.ilike.%${term}%,username.ilike.%${term}%,email.ilike.%${term}%`,
    );
  }

  const { data, error } = await query;
  if (error)
    throw new Error(`Không tải được danh sách tài khoản: ${error.message}`);

  const rows = data ?? [];
  const ids = rows.map((r) => r.id);

  // Ghép mã GV/HV để hiển thị. Học viên chưa có tài khoản không có id ở đây nên
  // không lọt vào — chỉ tài khoản thật mới có mã tương ứng.
  const [teachers, students] = ids.length
    ? await Promise.all([
        supabase.from("teachers").select("user_id, teacher_code").in("user_id", ids),
        supabase.from("students").select("user_id, student_code").in("user_id", ids),
      ])
    : [{ data: [] }, { data: [] }];

  const codeByUser = new Map<string, string>();
  for (const t of teachers.data ?? [])
    if (t.user_id) codeByUser.set(t.user_id, t.teacher_code);
  for (const s of students.data ?? [])
    if (s.user_id) codeByUser.set(s.user_id, s.student_code);

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    full_name: r.full_name,
    email: r.email,
    phone: r.phone,
    role: r.role as UserRole,
    is_active: r.is_active,
    code: codeByUser.get(r.id) ?? null,
  }));
}
