import {
  BookOpen,
  CalendarDays,
  ClipboardCheck,
  ClipboardList,
  ClipboardPen,
  FileText,
  GraduationCap,
  LayoutDashboard,
  Layers,
  Repeat,
  Bell,
  ShieldCheck,
  Users,
  Wallet,
  BarChart3,
  School,
  UserCircle,
  TrendingUp,
  History,
  Award,
  type LucideIcon,
} from "lucide-react";

import type { UserRole } from "@/types/roles";
import { canReadXkld, CANDIDATES_PATH } from "@/features/xkld/domain/candidates";
import { ORDERS_PATH } from "@/features/xkld/domain/orders";
import { DOCUMENTS_PATH } from "@/features/xkld/domain/documents";
import { FINANCE_PATH } from "@/features/xkld/domain/finance";
import { PIPELINE_PATH } from "@/features/xkld/domain/pipeline";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: readonly UserRole[];
};

/**
 * Một nhóm mục trong menu.
 *
 * `label = null` ⇒ danh sách phẳng, không vẽ tiêu đề nhóm. Ba role cũ dùng dạng
 * này và trông y hệt trước đây — thêm nhóm cho giáo vụ không được đổi một pixel
 * nào của ba menu kia.
 */
export type NavGroup = {
  label: string | null;
  items: NavItem[];
};

/**
 * Menu theo role — đúng đặc tả §16.
 *
 * ⚠️ Đây CHỈ là điều hướng, KHÔNG phải phân quyền. Ẩn một mục ở đây không ngăn
 * được ai gõ thẳng URL. Phân quyền thật nằm ở middleware + server action + RLS.
 */
export const NAVIGATION: Record<UserRole, NavItem[]> = {
  executive: [{ label: "Tổng quan điều hành", href: "/workspace", icon: LayoutDashboard }, { label: "Ứng viên XKLĐ", href: CANDIDATES_PATH, icon: Users }, { label: "Thị trường & đơn hàng", href: ORDERS_PATH, icon: ClipboardList }, { label: "Pipeline XKLĐ", href: PIPELINE_PATH, icon: TrendingUp }, { label: "Hồ sơ giấy tờ", href: DOCUMENTS_PATH, icon: FileText }, { label: "Tài chính & công nợ", href: FINANCE_PATH, icon: Wallet }],
  center_manager: [{ label: "Quản lý trung tâm", href: "/workspace", icon: School }],
  consultant: [{ label: "Công việc hôm nay", href: "/workspace", icon: ClipboardList }],
  xkld_staff: [{ label: "Xuất khẩu lao động", href: "/workspace", icon: LayoutDashboard }, { label: "Ứng viên", href: CANDIDATES_PATH, icon: Users }, { label: "Thị trường & đơn hàng", href: ORDERS_PATH, icon: ClipboardList }, { label: "Pipeline", href: PIPELINE_PATH, icon: TrendingUp }, { label: "Hồ sơ giấy tờ", href: DOCUMENTS_PATH, icon: FileText }, { label: "Tài chính & công nợ", href: FINANCE_PATH, icon: Wallet }],
  super_admin: [
    { label: "Tổng quan", href: "/admin", icon: LayoutDashboard },
    { label: "Học viên", href: "/admin/students", icon: Users },
    { label: "Giáo viên", href: "/admin/teachers", icon: GraduationCap },
    { label: "Khóa học", href: "/admin/courses", icon: BookOpen },
    { label: "Lớp học", href: "/admin/classes", icon: School },
    { label: "Flashcard", href: "/admin/flashcards", icon: Layers },
    { label: "Lịch học", href: "/admin/schedule", icon: CalendarDays },
    { label: "Học phí", href: "/admin/tuition", icon: Wallet },
    { label: "Báo cáo", href: "/admin/reports", icon: BarChart3 },
    {
      label: "Duyệt câu hỏi",
      href: "/admin/question-bank-review",
      icon: ClipboardCheck,
    },
    { label: "Thông báo", href: "/admin/notifications", icon: Bell },
    { label: "Quản trị & Audit", href: "/admin/system", icon: ShieldCheck },
  ],

  teacher: [
    { label: "Hôm nay", href: "/teacher", icon: LayoutDashboard },
    { label: "Lớp của tôi", href: "/teacher/classes", icon: School },
    { label: "Điểm danh", href: "/teacher/attendance", icon: ClipboardCheck },
    {
      label: "Chấm công",
      href: "/teacher/b2c-teaching",
      icon: CalendarDays,
    },
    // Đứng ngay sau Điểm danh vì đó là thứ tự làm việc thật: điểm danh xong mới
    // báo cáo được. Giáo vụ có đứng lớp cũng thấy mục này — nhánh "Lớp được
    // phân công" dùng chung đúng danh sách `NAVIGATION.teacher` (`D-2`).
    {
      label: "Báo cáo buổi dạy",
      href: "/teacher/reports",
      icon: ClipboardList,
    },
    { label: "Bài tập", href: "/teacher/exercises", icon: FileText },
    { label: "Kiểm tra / Thi", href: "/teacher/exams", icon: GraduationCap },
    {
      label: "Đánh giá & Ghi chú",
      href: "/teacher/evaluations",
      icon: ClipboardPen,
    },
    { label: "Báo cáo lớp", href: "/teacher/progress", icon: TrendingUp },
  ],

  student: [
    { label: "Tổng quan", href: "/student", icon: LayoutDashboard },
    { label: "Lớp của tôi", href: "/student/class", icon: School },
    { label: "Bài tập", href: "/student/exercises", icon: FileText },
    { label: "Kiểm tra / Thi", href: "/student/exams", icon: GraduationCap },
    { label: "Ôn tập", href: "/student/review", icon: Repeat },
    { label: "Kết quả", href: "/student/results", icon: BarChart3 },
    { label: "Học phí", href: "/student/tuition", icon: Wallet },
    { label: "Hồ sơ", href: "/student/profile", icon: UserCircle },
  ],

  /**
   * Giáo vụ — nhánh "Quản lý", ĐÚNG 9 mục user liệt kê (`D-2` điểm 3).
   *
   * ⛔ Ba mục của admin cố tình KHÔNG có mặt, đừng "bổ sung cho đủ":
   *   • Flashcard          — user loại rõ khi được hỏi
   *   • Duyệt câu hỏi      — user loại rõ khi được hỏi
   *   • Quản trị & Audit   — quyền quản trị, không thuộc role này
   *
   * Nhánh thứ hai ("Lớp được phân công") KHÔNG nằm ở đây: nó phụ thuộc dữ liệu
   * thật (giáo vụ có được phân lớp nào không), mà file này thì thuần tĩnh.
   * Ghép ở `getNavigationGroups()` bên dưới.
   */
  academic_manager: [
    { label: "Tổng quan", href: "/admin", icon: LayoutDashboard },
    { label: "Học viên", href: "/admin/students", icon: Users },
    { label: "Giáo viên", href: "/admin/teachers", icon: GraduationCap },
    { label: "Khóa học", href: "/admin/courses", icon: BookOpen },
    { label: "Lớp học", href: "/admin/classes", icon: School },
    { label: "Lịch học", href: "/admin/schedule", icon: CalendarDays },
    { label: "Học phí", href: "/admin/tuition", icon: Wallet },
    { label: "Báo cáo", href: "/admin/reports", icon: BarChart3 },
    { label: "Thông báo", href: "/admin/notifications", icon: Bell },
  ],
};

/** Menu riêng của module trung tâm; không được trỏ sang dữ liệu doanh nghiệp. */
export const B2C_NAVIGATION: NavItem[] = [
  { label: "Tổng quan", href: "/admin/b2c/overview", icon: LayoutDashboard },
  { label: "Việc hôm nay", href: "/admin/b2c/today", icon: ClipboardList },
  { label: "Tuyển sinh", href: "/admin/b2c/admissions", icon: TrendingUp },
  { label: "Lớp học", href: "/admin/b2c", icon: School },
  { label: "Học viên", href: "/admin/b2c/students", icon: Users },
  { label: "Giáo viên", href: "/admin/b2c/teachers", icon: GraduationCap },
  { label: "Thời khóa biểu GV", href: "/admin/b2c/timetable", icon: CalendarDays },
  { label: "Giờ dạy & Lương", href: "/admin/b2c/teaching", icon: CalendarDays },
  { label: "Phụ huynh", href: "/admin/b2c/parents", icon: UserCircle },
  { label: "Kết quả chứng chỉ", href: "/admin/b2c/certificates", icon: Award },
  { label: "Khảo sát phụ huynh", href: "/admin/b2c/nps", icon: ClipboardList },
  { label: "Học phí", href: "/admin/b2c/tuition", icon: Wallet },
  { label: "Báo cáo", href: "/admin/b2c/reports", icon: BarChart3 },
  {
    label: "Nhật ký thay đổi",
    href: "/admin/b2c/history",
    icon: History,
    roles: ["super_admin"],
  },
  { label: "Phân quyền", href: "/admin/b2c/permissions", icon: ShieldCheck },
];

export function getB2CNavigation(role: UserRole): NavItem[] {
  if (role !== "super_admin" && role !== "academic_manager") return [];
  return B2C_NAVIGATION.filter(
    (item) => !item.roles || item.roles.includes(role),
  );
}

export function getXkldNavigation(role: UserRole): NavItem[] {
  return canReadXkld(role) ? [{ label: "Ứng viên", href: CANDIDATES_PATH, icon: Users }, { label: "Thị trường & đơn hàng", href: ORDERS_PATH, icon: ClipboardList }, { label: "Pipeline", href: PIPELINE_PATH, icon: TrendingUp }, { label: "Hồ sơ giấy tờ", href: DOCUMENTS_PATH, icon: FileText }, { label: "Tài chính & công nợ", href: FINANCE_PATH, icon: Wallet }] : [];
}

export function getNavigation(role: UserRole): NavItem[] {
  return NAVIGATION[role];
}

/**
 * Menu dạng nhóm — thứ mà sidebar/mobile-nav thật sự vẽ.
 *
 * Ba role cũ: đúng một nhóm không tiêu đề ⇒ giao diện không đổi.
 *
 * Giáo vụ: hai nhánh. Nhánh "Lớp được phân công" chỉ hiện khi
 * `hasAssignedClasses` — user chốt *"chỉ xuất hiện khi role này cũng được phân
 * công dạy các lớp"*.
 *
 * ⚠️ `hasAssignedClasses` phải ĐẾM TỪ DB (`class_teachers`), không được suy từ
 * role. Suy từ role thì mọi giáo vụ đều thấy nhánh 2, bấm vào ra trang rỗng —
 * và đó là kiểu hỏng khó truy nhất vì không có lỗi nào được ném ra.
 */
export function getNavigationGroups(
  role: UserRole,
  options: { hasAssignedClasses?: boolean; canManageAdmissions?: boolean; canManageCenterTuition?: boolean; canManageB2CParents?: boolean; canManageStudentData?: boolean } = {},
): NavGroup[] {
  const teacherItems = options.canManageAdmissions
    ? [...NAVIGATION.teacher, { label: "Tuyển sinh", href: "/teacher/admissions", icon: TrendingUp }]
    : [...NAVIGATION.teacher];
  if (options.canManageCenterTuition) teacherItems.push({ label: "Học phí", href: "/teacher/tuition", icon: Wallet });
  if (options.canManageB2CParents) teacherItems.push({ label: "Phụ huynh", href: "/teacher/parents", icon: UserCircle });
  if (options.canManageStudentData) teacherItems.push({ label: "Học viên", href: "/teacher/students", icon: Users });
  if (role !== "academic_manager") {
    return [{ label: null, items: role === "teacher" ? teacherItems : NAVIGATION[role] }];
  }

  const groups: NavGroup[] = [
    { label: "Quản lý", items: NAVIGATION.academic_manager },
  ];

  if (options.hasAssignedClasses) {
    groups.push({ label: "Lớp được phân công", items: teacherItems });
  }

  return groups;
}

/**
 * Mục nào đang active.
 *
 * So khớp tiền tố, nhưng route gốc (`/admin`) phải khớp CHÍNH XÁC — nếu không
 * thì `/admin` sẽ luôn sáng đèn kể cả khi đang ở `/admin/students`.
 */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/admin/b2c") return pathname === item.href;
  const segments = item.href.split("/").filter(Boolean);
  const isRoleRoot = segments.length === 1;

  if (isRoleRoot) return pathname === item.href;

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
