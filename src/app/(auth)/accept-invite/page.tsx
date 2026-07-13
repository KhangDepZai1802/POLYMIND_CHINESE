import type { Metadata } from "next";

import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = { title: "Kích hoạt tài khoản" };
export const dynamic = "force-dynamic";

/**
 * Trang người được mời đặt mật khẩu lần đầu.
 *
 * Về mặt kỹ thuật giống hệt reset-password (Supabase Auth đã xác thực token
 * trong link invite và tạo phiên tạm), nên dùng chung form — chỉ đổi chữ.
 */
export default function AcceptInvitePage() {
  return (
    <ResetPasswordForm
      title="Kích hoạt tài khoản"
      description="Chào mừng bạn đến với POLYMIND CHINESE. Hãy đặt mật khẩu để bắt đầu."
      submitLabel="Kích hoạt tài khoản"
    />
  );
}
