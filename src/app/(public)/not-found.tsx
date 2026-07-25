import { QrCode } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Liên kết không còn hiệu lực",
  robots: { index: false, follow: false },
};

/**
 * MỘT câu trả lời cho MỌI ca hỏng.
 *
 * Mã sai hình dạng · mã không tồn tại · đã thu hồi · buổi bị đưa về nháp · buổi
 * bị xoá mềm · bộ thẻ về nháp — tất cả đều rơi vào đây với **cùng một nội dung
 * và cùng một mã trạng thái**. Phân biệt được các ca này là tặng cho người dò
 * mã một cái máy đo: "sai hình dạng" khác "có tồn tại nhưng đã thu hồi" nghĩa
 * là họ biết mình đoán gần đúng.
 *
 * Cũng vì thế mà KHÔNG có nút "Đăng nhập": học sinh quét mã QR trong sách
 * không có tài khoản, chỉ vào đăng nhập cũng không giúp được gì.
 */
export default function PublicNotFound() {
  return (
    <main className="bg-surface-page flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <QrCode className="text-muted-foreground size-12" aria-hidden />
      <h1 className="text-2xl font-bold">Liên kết không còn hiệu lực</h1>
      <p className="text-muted-foreground max-w-sm text-base">
        Mã QR này đã được gỡ hoặc bài học chưa được mở. Bạn hãy hỏi giáo viên của
        mình để nhận liên kết mới nhé.
      </p>
    </main>
  );
}
