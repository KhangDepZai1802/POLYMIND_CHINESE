import { redirect } from "next/navigation";

/**
 * RPC `publish_evaluation` sinh notification trỏ tới `/student/evaluations`.
 *
 * Đánh giá hiển thị chung trang Kết quả (tab "Đánh giá") nên route này chỉ chuyển
 * hướng. Bỏ nó đi thì mọi thông báo "Đánh giá học tập mới" sẽ dẫn tới **404** —
 * link trong thông báo là hợp đồng, không phải chi tiết trang trí.
 */
export default function StudentEvaluationsPage() {
  redirect("/student/results?tab=evaluations");
}
