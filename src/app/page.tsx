import { redirect } from "next/navigation";

/**
 * Trang gốc không có nội dung riêng.
 *
 * Người đã đăng nhập được middleware đưa thẳng về khu vực của role họ; người
 * chưa đăng nhập rơi xuống đây và về trang login.
 */
export default function RootPage() {
  redirect("/login");
}
