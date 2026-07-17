import "server-only";

import {
  normalizeUsername,
  usernameToLoginEmail,
} from "@/features/users/account";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/types/roles";

type AccountParams = {
  userId?: string | null;
  username: string;
  password: string;
  fullName: string;
  role: UserRole;
  phone?: string | null;
  contactEmail?: string | null;
};

export async function provisionPasswordAccount(
  params: AccountParams,
): Promise<
  { ok: true; userId: string; created: boolean } | { ok: false; error: string }
> {
  const admin = createAdminClient();
  const username = normalizeUsername(params.username);
  const loginEmail = usernameToLoginEmail(username);
  const contactEmail = params.contactEmail?.trim().toLowerCase() || null;

  let userId = params.userId ?? null;
  let created = false;

  if (userId) {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      email: loginEmail,
      password: params.password,
      email_confirm: true,
    });
    if (error) {
      return {
        ok: false,
        error: error.message.toLowerCase().includes("already")
          ? "Tên đăng nhập đã được sử dụng."
          : "Không cập nhật được thông tin đăng nhập.",
      };
    }
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: loginEmail,
      password: params.password,
      email_confirm: true,
    });
    if (error || !data.user) {
      return {
        ok: false,
        error: error?.message.toLowerCase().includes("already")
          ? "Tên đăng nhập đã được sử dụng."
          : "Không tạo được tài khoản đăng nhập.",
      };
    }
    userId = data.user.id;
    created = true;
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      username,
      role: params.role,
      full_name: params.fullName,
      phone: params.phone ?? null,
      email: contactEmail,
      is_active: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    if (created) await admin.auth.admin.deleteUser(userId);
    return {
      ok: false,
      error:
        profileError.code === "23505"
          ? "Tên đăng nhập đã được sử dụng."
          : "Không lưu được hồ sơ tài khoản.",
    };
  }

  return { ok: true, userId, created };
}
