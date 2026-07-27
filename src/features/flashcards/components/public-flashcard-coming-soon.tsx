import { CalendarClock } from "lucide-react";

/**
 * Mã QR HỢP LỆ nhưng buổi chưa được công bố (`D-39`).
 *
 * Vì sao màn này tồn tại: sách được in TRƯỚC khi soạn xong nội dung, nên trong
 * vài tuần đầu sẽ có người quét trúng buổi chưa mở. Trả `not-found` cho họ là
 * để người mua kết luận sách in sai hoặc web hỏng — mà cả hai đều không đúng,
 * và họ không có cách nào biết là chỉ cần quay lại sau.
 *
 * ⚠️ Màn này KHÔNG được hiển thị bất cứ thứ gì từ nội dung buổi học: không tiêu
 * đề, không tên bộ thẻ, không ảnh. Số buổi là ngoại lệ duy nhất vì nó vốn nằm
 * sẵn trong mã trên URL (`vcb-bank-07`) — không lộ thêm gì. RPC ở
 * migration `…081` cũng chỉ trả đúng chừng đó.
 */
export function PublicFlashcardComingSoon({
  sessionNumber,
}: {
  sessionNumber: number;
}) {
  return (
    <main className="bg-surface-page flex min-h-dvh flex-col items-center justify-center gap-4 px-6 py-10 text-center">
      <CalendarClock className="text-muted-foreground size-12" aria-hidden />
      <h1 className="text-2xl font-bold">Buổi {sessionNumber} sắp mở</h1>
      {/*
       * `text-secondary` chứ không `muted-foreground`: cùng bẫy tương phản đã
       * đo ở `flashcard-public-link-panel.tsx` — token phụ được chọn cho nền
       * trắng, và đây là chữ dài người ta phải đọc hết.
       */}
      <p className="text-text-secondary max-w-sm text-base">
        Mã QR của bạn đúng rồi. Nội dung buổi học này chưa được mở, bạn quay lại
        sau nhé — vẫn dùng đúng mã này, không cần mã mới.
      </p>
    </main>
  );
}
