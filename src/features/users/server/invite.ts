import "server-only";

import { getPublicEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/roles";

/**
 * Mời một người dùng và tạo `profiles` cho họ.
 *
 * ⚠️ Đây là MỘT trong số rất ít chỗ được dùng admin client (service role, bypass
 * RLS). Lý do chính đáng: tạo `auth.users` là thao tác chỉ Supabase Auth Admin
 * API làm được — không có đường nào khác. Người gọi PHẢI đã kiểm
 * `requireRole("super_admin")` trước.
 *
 * IDEMPOTENT: mời lại một email đã tồn tại → trả về user cũ, KHÔNG tạo trùng.
 * Trung tâm sẽ bấm "Gửi lại lời mời" nhiều lần; mỗi lần tạo một user mới thì
 * hồ sơ sẽ nhân bản.
 */
export async function inviteUser(params: {
  email: string;
  fullName: string;
  role: UserRole;
  phone?: string | null;
  /** Trang người nhận sẽ tới sau khi bấm link trong email. */
  redirectPath?: string;
}): Promise<
  | { ok: true; userId: string; alreadyExisted: boolean }
  | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const env = getPublicEnv();
  const email = params.email.trim().toLowerCase();

  const redirectTo = `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=${
    params.redirectPath ?? "/accept-invite"
  }`;

  const { data: invited, error: inviteError } =
    await admin.auth.admin.inviteUserByEmail(email, { redirectTo });

  let userId: string;
  let alreadyExisted = false;

  if (inviteError) {
    // Đã có tài khoản → tìm và LINK vào tài khoản cũ, không tạo mới.
    const existing = await findUserByEmail(email);
    if (!existing) {
      return {
        ok: false,
        error: `Không gửi được lời mời: ${inviteError.message}`,
      };
    }
    userId = existing;
    alreadyExisted = true;
  } else {
    if (!invited.user) {
      return { ok: false, error: "Không tạo được tài khoản." };
    }
    userId = invited.user.id;
  }

  // Upsert profile: mời lại thì cập nhật tên, không nhân đôi dòng.
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      role: params.role,
      full_name: params.fullName,
      phone: params.phone ?? null,
      email,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return {
      ok: false,
      error: `Không tạo được hồ sơ: ${profileError.message}`,
    };
  }

  return { ok: true, userId, alreadyExisted };
}

/**
 * Tìm user theo email.
 *
 * Auth Admin API không có `getUserByEmail`, chỉ có `listUsers` phân trang → phải
 * duyệt. Với quy mô một trung tâm (vài trăm tài khoản) thì hoàn toàn ổn.
 */
async function findUserByEmail(email: string): Promise<string | null> {
  const admin = createAdminClient();
  const target = email.trim().toLowerCase();

  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error || data.users.length === 0) return null;

    const found = data.users.find((u) => u.email?.toLowerCase() === target);
    if (found) return found.id;

    if (data.users.length < 200) return null; // trang cuối
  }

  return null;
}

/** Gửi lại email mời (người dùng chưa bao giờ đăng nhập / mất mail). */
export async function resendInvite(
  email: string,
  redirectPath = "/accept-invite",
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const env = getPublicEnv();

  const { error } = await admin.auth.admin.inviteUserByEmail(
    email.trim().toLowerCase(),
    {
      redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=${redirectPath}`,
    },
  );

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Khóa / mở tài khoản.
 *
 * `is_active = false` chặn ở BA tầng: middleware (không vào được trang),
 * `getCurrentUser()` (server action từ chối), và `app.is_active()` trong mọi RLS
 * policy (DB từ chối). Khóa xong là khóa thật, không phải chỉ ẩn nút.
 */
export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
