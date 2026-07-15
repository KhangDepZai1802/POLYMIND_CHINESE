import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardPen,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Bell,
  ShieldCheck,
  Users,
  Wallet,
  BarChart3,
  School,
  UserCircle,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/types/roles";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hiện ở bottom nav mobile. Tối đa 5 mục/role — quá đó là không bấm nổi. */
  mobile?: boolean;
};

/**
 * Menu theo role — đúng đặc tả §16.
 *
 * ⚠️ Đây CHỈ là điều hướng, KHÔNG phải phân quyền. Ẩn một mục ở đây không ngăn
 * được ai gõ thẳng URL. Phân quyền thật nằm ở middleware + server action + RLS.
 */
export const NAVIGATION: Record<UserRole, NavItem[]> = {
  super_admin: [
    { label: "Tổng quan", href: "/admin", icon: LayoutDashboard, mobile: true },
    { label: "Học viên", href: "/admin/students", icon: Users, mobile: true },
    {
      label: "Giáo viên",
      href: "/admin/teachers",
      icon: GraduationCap,
    },
    { label: "Khóa học", href: "/admin/courses", icon: BookOpen },
    { label: "Lớp học", href: "/admin/classes", icon: School, mobile: true },
    { label: "Lịch học", href: "/admin/schedule", icon: CalendarDays },
    { label: "Học phí", href: "/admin/tuition", icon: Wallet, mobile: true },
    { label: "Báo cáo", href: "/admin/reports", icon: BarChart3 },
    { label: "Thông báo", href: "/admin/notifications", icon: Bell },
    { label: "Quản trị & Audit", href: "/admin/system", icon: ShieldCheck },
  ],

  teacher: [
    { label: "Hôm nay", href: "/teacher", icon: LayoutDashboard, mobile: true },
    {
      label: "Lớp của tôi",
      href: "/teacher/classes",
      icon: School,
      mobile: true,
    },
    {
      label: "Điểm danh",
      href: "/teacher/attendance",
      icon: ClipboardCheck,
      mobile: true,
    },
    {
      label: "Bài tập & Chấm bài",
      href: "/teacher/assignments",
      icon: FileText,
      mobile: true,
    },
    {
      label: "Kiểm tra & Điểm",
      href: "/teacher/assessments",
      icon: GraduationCap,
    },
    {
      label: "Đánh giá & Ghi chú",
      href: "/teacher/evaluations",
      icon: ClipboardPen,
    },
    {
      label: "Báo cáo lớp",
      href: "/teacher/progress",
      icon: TrendingUp,
      mobile: true,
    },
  ],

  student: [
    {
      label: "Tổng quan",
      href: "/student",
      icon: LayoutDashboard,
      mobile: true,
    },
    {
      label: "Lịch học",
      href: "/student/schedule",
      icon: CalendarDays,
      mobile: true,
    },
    {
      label: "Bài tập",
      href: "/student/assignments",
      icon: FileText,
      mobile: true,
    },
    {
      label: "Kết quả",
      href: "/student/results",
      icon: BarChart3,
      mobile: true,
    },
    { label: "Học phí", href: "/student/tuition", icon: Wallet, mobile: true },
    { label: "Hồ sơ", href: "/student/profile", icon: UserCircle },
  ],
};

export function getNavigation(role: UserRole): NavItem[] {
  return NAVIGATION[role];
}

export function getMobileNavigation(role: UserRole): NavItem[] {
  return NAVIGATION[role].filter((item) => item.mobile);
}

/**
 * Mục nào đang active.
 *
 * So khớp tiền tố, nhưng route gốc (`/admin`) phải khớp CHÍNH XÁC — nếu không
 * thì `/admin` sẽ luôn sáng đèn kể cả khi đang ở `/admin/students`.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  const segments = item.href.split("/").filter(Boolean);
  const isRoleRoot = segments.length === 1;

  if (isRoleRoot) return pathname === item.href;

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
