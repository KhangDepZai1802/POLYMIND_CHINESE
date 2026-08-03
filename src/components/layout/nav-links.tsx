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
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
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
