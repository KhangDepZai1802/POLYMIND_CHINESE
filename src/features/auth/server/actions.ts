"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/features/auth/schema";
import { getPublicEnv } from "@/lib/env";
import { homePathForRole } from "@/lib/permissions/routes";
import { createClient } from "@/lib/supabase/server";
import { isUserRole } from "@/types/roles";

export type ActionState = {
  error?: string;
  success?: string;
};

/**
 * Thông báo lỗi đăng nhập LUÔN chung chung.
 *
 * Nói "email không tồn tại" là tặng cho kẻ tấn công một công cụ dò danh sách
 * user (account enumeration). Sai email hay sai mật khẩu — người dùng đều nhận
 * đúng một câu.
 */
const GENERIC_LOGIN_ERROR = "Email hoặc mật khẩu không đúng.";

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? GENERIC_LOGIN_ERROR };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error || !data.user) {
    return { error: GENERIC_LOGIN_ERROR };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .single();

  // Tài khoản bị khóa → đăng xuất ngay, không cho vào.
  // Kiểm ở đây VÀ ở middleware VÀ ở RLS — ba lớp, không lớp nào đủ một mình.
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    return {
      error: "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên.",
    };
  }

  if (!isUserRole(profile.role)) {
    await supabase.auth.signOut();
    return { error: "Tài khoản chưa được cấu hình đúng vai trò." };
  }

  revalidatePath("/", "layout");
  redirect(homePathForRole(profile.role));
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function forgotPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Email không hợp lệ" };
  }

  const supabase = await createClient();
  const env = getPublicEnv();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/confirm?next=/reset-password`,
  });

  // Luôn báo thành công, kể cả khi email không tồn tại — cùng lý do với
  // GENERIC_LOGIN_ERROR: không để lộ email nào có trong hệ thống.
  return {
    success:
      "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi link đặt lại mật khẩu.",
  };
}

export async function resetPasswordAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Mật khẩu không hợp lệ",
    };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "Link đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu link mới.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: "Không đặt lại được mật khẩu. Vui lòng thử lại." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  revalidatePath("/", "layout");
  redirect(
    profile && isUserRole(profile.role)
      ? homePathForRole(profile.role)
      : "/login",
  );
}
