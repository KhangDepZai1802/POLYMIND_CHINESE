import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/components/login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

// Trang auth không được cache — tránh phục vụ lại HTML của phiên trước.
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const initialError =
    error === "account_disabled"
      ? "Tài khoản đã bị khóa. Vui lòng liên hệ quản trị viên."
      : undefined;

  return <LoginForm initialError={initialError} />;
}
