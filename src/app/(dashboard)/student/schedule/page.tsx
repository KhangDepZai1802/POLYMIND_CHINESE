import { redirect } from "next/navigation";

/**
 * "Lịch học" đã được gộp vào module "Lớp của tôi" (`/student/class`).
 *
 * Giữ route này làm redirect để các thông báo cũ (và job cron) trỏ tới
 * `/student/schedule` vẫn mở đúng trang lớp.
 */
export default function StudentScheduleRedirect() {
  redirect("/student/class");
}
