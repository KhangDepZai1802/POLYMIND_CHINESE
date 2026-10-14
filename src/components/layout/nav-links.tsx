"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  isNavItemActive,
  type NavGroup,
  type NavItem,
} from "@/lib/permissions/navigation";
import { cn } from "@/lib/utils";

/**
 * Danh sách link điều hướng dùng chung cho sidebar (desktop) và drawer (mobile).
 *
 * ⚠️ Đây CHỈ là điều hướng, KHÔNG phải phân quyền. Ẩn một mục ở đây không ngăn
 * được ai gõ thẳng URL. Phân quyền thật nằm ở middleware + server action + RLS.
 *
 * `onNavigate` để drawer mobile tự đóng sau khi bấm chọn một mục.
 */
/**
 * Điều hướng theo NHÓM — bề mặt duy nhất mà sidebar và drawer gọi.
 *
 * Nhóm không có tiêu đề (`label = null`) vẽ y hệt danh sách phẳng cũ, không
 * thêm một khoảng cách hay thẻ bọc nào: ba role cũ phải trông đúng như trước.
 * Chỉ giáo vụ mới có từ hai nhóm trở lên và mới thấy tiêu đề.
 */
export function NavGroups({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate?: () => void;
}) {
  return (
    <>
      {groups.map((group, index) => (
        <div
          key={group.label ?? `group-${index}`}
          className={cn("space-y-1", index > 0 && "mt-5")}
        >
          {group.label && (
            <p
              className="text-muted-foreground px-3 pb-1 text-xs font-semibold tracking-wide uppercase"
              // Tiêu đề nhóm là nhãn của chính danh sách bên dưới, không phải
              // một mục bấm được — nối bằng aria-label ở <ul> thì trình đọc màn
              // hình đọc thừa. Để nguyên dạng chữ tĩnh.
            >
              {group.label}
            </p>
          )}
          <NavLinks items={group.items} onNavigate={onNavigate} />
        </div>
      ))}
    </>
  );
}

export function NavLinks({
  items,
  onNavigate,
}: {
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {items.map((item) => {
        const active = isNavItemActive(item, pathname);
        const Icon = item.icon;
        const colorful =
          pathname.startsWith("/admin/b2c") ||
          pathname === "/teacher" ||
          pathname.startsWith("/teacher/");
        const iconTone = /tuition|teaching/.test(item.href)
          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
          : /teacher[s]?|exams/.test(
                item.href.replace(/^\/teacher(?=\/|$)/, ""),
              )
            ? "bg-violet-50 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
            : /attendance|admissions|evaluations/.test(item.href)
              ? "bg-orange-50 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
              : /students|parents|exercises/.test(item.href)
                ? "bg-teal-50 text-teal-600 dark:bg-teal-950 dark:text-teal-400"
                : "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400";

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={onNavigate}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              // Focus bàn phím phải thấy rõ trên CẢ nền trắng lẫn nền primary của
              // mục đang active — dùng offset để ring không chìm vào nền nút.
              "focus-visible:ring-ring focus-visible:ring-offset-card focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-brand-orange/15 hover:text-foreground",
              active &&
                (pathname === "/teacher" || pathname.startsWith("/teacher/")) &&
                "bg-gradient-to-r from-blue-700 to-blue-500 shadow-md shadow-blue-200/50 dark:shadow-none",
            )}
          >
            {colorful ? (
              <span
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                  active ? "bg-white/15 text-white" : iconTone,
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
              </span>
            ) : (
              <Icon className="size-5 shrink-0" aria-hidden />
            )}
            <span className="truncate">{item.label}</span>
            {active && (
              <span
                className="bg-brand-orange ml-auto size-2 shrink-0 rounded-full"
                aria-hidden
              />
            )}
          </Link>
        );
      })}
    </>
  );
}
