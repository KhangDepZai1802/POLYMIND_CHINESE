import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";

import { getVerifiedIdentity } from "@/lib/auth/verified-identity";
import { homePathForRole } from "@/lib/permissions/routes";
import { createClient } from "@/lib/supabase/server";
import { isUserRole, MANAGER_ROLES, type UserRole } from "@/types/roles";

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
export async function loadCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const identity = await getVerifiedIdentity(supabase.auth);
  if (!identity) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, avatar_path, is_active")
    .eq("id", identity.id)
    .single();

  // Fail-closed: thiếu profile hoặc bị khóa → coi như chưa đăng nhập.
  if (!profile || !profile.is_active) return null;
  if (!isUserRole(profile.role)) return null;

  return {
    id: identity.id,
    email: identity.email,
    role: profile.role,
    fullName: profile.full_name,
    avatarPath: profile.avatar_path,
  };
}

export const getCurrentUser = cache(loadCurrentUser);

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

/**
 * Bắt buộc có quyền QUẢN LÝ nghiệp vụ: `super_admin` hoặc `academic_manager`.
 *
 * Đây là cặp song sinh phía TS của `app.is_manager()` dưới DB — cùng một khái
 * niệm, hai tầng.
 *
 * ⚠️ Dùng hàm này thay vì gõ tay `requireRole("super_admin", "academic_manager")`
 * ở ~30 chỗ. Không phải để gõ ít hơn: một danh sách role lặp lại 30 lần là 30 cơ
 * hội để sót một chỗ khi luật đổi, và sót ở đây nghĩa là giáo vụ bị đá ra khỏi
 * đúng một trang mà không ai biết vì sao. Đúng bài học `BUG_M10_01`.
 *
 * ⛔ KHÔNG dùng cho quản trị tài khoản và audit — hai việc đó gọi thẳng
 * `requireRole("super_admin")`.
 */
export async function requireManager(): Promise<CurrentUser> {
  return requireRole(...MANAGER_ROLES);
}

/**
 * Bắt buộc là người ĐỨNG LỚP: `teacher` hoặc `academic_manager`.
 *
 * Giáo vụ được phân công dạy lớp thì phải vào được khu `/teacher` — nếu không,
 * nhánh menu "Lớp được phân công" hiện ra rồi bấm vào là bị đá về `/admin`.
 * `GIAOVU-ROUTE-002` (Codex tìm ra 2026-08-03) đúng là ca đó: `…087` mở
 * `my_teacher_id()` và `teaches_class()` cho giáo vụ ở tầng DB, nhưng 17 page
 * `/teacher` vẫn gác `requireRole("teacher")` nên chặn ngay trước khi tới RLS.
 *
 * ⚠️ Hàm này KHÔNG kiểm "có lớp nào không" — phạm vi dữ liệu là việc của RLS
 * (`app.teaches_class()`). Giáo vụ chưa được phân lớp vào đây sẽ thấy trang
 * rỗng, đúng như một giáo viên chưa có lớp.
 */
export async function requireTeaching(
  ...extra: readonly UserRole[]
): Promise<CurrentUser> {
  return requireRole("teacher", "academic_manager", ...extra);
}

/**
 * Giáo vụ này có đang được phân công dạy lớp nào không?
 *
 * Quyết định nhánh menu thứ hai ("Lớp được phân công") có hiện hay không —
 * user chốt *"chỉ xuất hiện khi role này cũng được phân công dạy các lớp"*.
 *
 * ⚠️ ĐẾM TỪ `class_teachers`, KHÔNG suy từ role. Điểm (2) của `D-2` cho mọi giáo
 * vụ một hàng `teachers` sẵn ngay khi tạo tài khoản, nên "có hồ sơ giáo viên"
 * đúng với 100% giáo vụ và không phân biệt được gì cả. Chỉ có phân công thật
 * mới nói lên điều đó.
 *
 * Chỉ chạy cho `academic_manager`: ba role còn lại có menu một nhánh, hỏi thêm
 * là thêm hai round-trip vào mọi lần dựng layout mà không dùng vào việc gì.
 */
export const hasAssignedClasses = cache(async function hasAssignedClasses(
  user: CurrentUser,
): Promise<boolean> {
  if (user.role !== "academic_manager") return false;

  const supabase = await createClient();

  const { data: teacher } = await supabase
    .from("teachers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!teacher) return false;

  const { count } = await supabase
    .from("class_teachers")
    .select("class_id", { count: "exact", head: true })
    .eq("teacher_id", teacher.id);

  return (count ?? 0) > 0;
});
