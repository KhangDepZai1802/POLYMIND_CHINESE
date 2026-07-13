import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";
import { homePathForRole, isRoleAllowedOnPath } from "@/lib/permissions/routes";
import type { Database } from "@/types/database";
import type { UserRole } from "@/types/roles";

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
 * Refresh session + guard route theo role.
 *
 * ⚠️ Đây CHỈ là lớp UX (chặn sớm, redirect cho đẹp). Nó KHÔNG phải phân quyền.
 * Mỗi Server Action / Route Handler vẫn phải tự kiểm quyền, và RLS vẫn chặn ở DB.
 * Ba lớp — không lớp nào được coi là đủ một mình.
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

  // getUser(), KHÔNG PHẢI getSession().
  // getSession() đọc cookie mà không xác minh chữ ký với Auth server — cookie giả
  // mạo sẽ lọt. getUser() luôn xác minh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user) {
    if (isPublicPath(pathname)) return supabaseResponse;

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Đã đăng nhập → lấy role + is_active từ bảng profiles.
  // KHÔNG đọc từ user.user_metadata: client sửa được nó, dùng làm nguồn phân
  // quyền là tự mở cửa cho leo thang quyền.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
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

  const role = profile.role as UserRole;

  // Đã đăng nhập mà vào trang login → về khu vực của mình
  if (pathname === "/login" || pathname === "/") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = homePathForRole(role);
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (isPublicPath(pathname)) return supabaseResponse;

  if (!isRoleAllowedOnPath(role, pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = homePathForRole(role);
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
