import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * Đích đến của link trong email Supabase Auth (invite / reset password /
 * confirm email). Đổi token trong link lấy phiên đăng nhập, rồi chuyển tiếp.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  // Chỉ nhận đường dẫn nội bộ. Nhận URL tuyệt đối ở đây là mở toang
  // open-redirect: kẻ tấn công gửi link ...&next=https://site-gia-mao → nạn nhân
  // vừa đăng nhập xong bị đá thẳng sang trang lừa đảo.
  const safeNext = next && next.startsWith("/") && !next.startsWith("//")
    ? next
    : "/";

  if (!token_hash || !type) {
    redirect("/login?error=invalid_link");
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    redirect("/login?error=expired_link");
  }

  redirect(safeNext);
}
