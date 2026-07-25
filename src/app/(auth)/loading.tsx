import { PageLoadingOverlay } from "@/components/shared/page-loading-overlay";

/**
 * ⚠️ File này TỪNG nằm ở `src/app/loading.tsx` (gốc). Chuyển xuống `(auth)` khi
 * làm trang công khai `/t/<mã>` — không phải để cho gọn, mà vì một lỗi ĐO ĐƯỢC:
 *
 * `loading.tsx` tạo một Suspense boundary tự động. Ở gốc, nó bọc **mọi** route,
 * nên Next flush vỏ trang ra trước → **mã trạng thái HTTP bị chốt 200** trước
 * khi `notFound()` kịp chạy. Hậu quả: trang "Liên kết không còn hiệu lực" trả
 * về **200 OK** thay vì 404 — sai với bot, sai với giám sát, và che mất lỗi thật.
 *
 * Số đo (cùng một URL `/t/<mã bịa>`, cả `next dev` lẫn bản build):
 *   có `src/app/loading.tsx`  → 200
 *   không có                  → 404
 *
 * `(dashboard)` đã có `loading.tsx` riêng nên không đổi gì; `(auth)` nhận file
 * này nên các màn đăng nhập giữ nguyên overlay; `/` chỉ `redirect()` nên không
 * cần. Kết quả: chỉ `(public)` là hết boundary — đúng chỗ cần.
 *
 * ⛔ Đừng chuyển ngược lên gốc.
 */
export default function AuthLoading() {
  return <PageLoadingOverlay />;
}
