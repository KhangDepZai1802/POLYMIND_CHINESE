import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getVerifiedIdentity } from "@/lib/auth/verified-identity";
import { getPublicEnv } from "@/lib/env";
import { homePathForRole } from "@/lib/permissions/routes";
import type { Database } from "@/types/database";
import { isUserRole } from "@/types/roles";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/accept-invite",
  "/auth",
  "/api/health",
  "/api/cron",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/**
 * Refresh session + chặn sớm anonymous.
 *
 * ⚠️ Đây CHỈ là lớp UX (chặn sớm, redirect cho đẹp). Nó KHÔNG phải phân quyền.
 * Role/is_active được kiểm ở Server Component/Action/Route Handler và RLS vẫn
 * chặn ở DB. Không query `profiles` tại middleware cho mọi navigation vì vừa
 * trùng việc vừa buộc thêm một network round-trip tuần tự.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const env = getPublicEnv();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          supabaseResponse = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // getClaims(), KHÔNG PHẢI getSession(). Production dùng ES256 nên SDK xác
  // minh chữ ký bằng public JWKS được cache, không cần gọi Auth server ở mỗi
  // request. Thiếu/sai claims luôn fail-closed trong helper dùng chung.
  const identity = await getVerifiedIdentity(supabase.auth);

  const { pathname } = request.nextUrl;

  if (!identity) {
    if (isPublicPath(pathname)) return supabaseResponse;

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Route đã đăng nhập được kiểm role + is_active lại ở Server Component/Action
  // và cuối cùng bởi RLS. Không query profiles thêm một lần tại middleware cho
  // mọi lần chuyển trang: việc đó tạo thêm một network round-trip nối tiếp trên
  // critical path nhưng không tăng quyền bảo mật (middleware chỉ là lớp UX).
  //
  // Riêng / và /login cần biết role để đưa user đã đăng nhập về đúng trang chủ.
  if (pathname !== "/" && pathname !== "/login") {
    return supabaseResponse;
  }

  // KHÔNG đọc role từ user.user_metadata: client sửa được nó.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", identity.id)
    .single();

  // Fail-closed: không có profile, hoặc bị khóa → đá ra ngoài.
  // Không có nhánh "thôi cho qua".
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("error", "account_disabled");
    return NextResponse.redirect(redirectUrl);
  }

  if (!isUserRole(profile.role)) {
    await supabase.auth.signOut();
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.search = "";
    redirectUrl.searchParams.set("error", "account_disabled");
    return NextResponse.redirect(redirectUrl);
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = homePathForRole(profile.role);
  redirectUrl.search = "";
  return NextResponse.redirect(redirectUrl);
}
