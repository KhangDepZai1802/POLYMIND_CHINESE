"use client";

import {
  FlashcardFaceContent,
  type Face,
  type FlashcardFaceData,
} from "@/features/flashcards/components/flashcard-face";

/**
 * CƠ CHẾ LẬT THẺ — dùng chung giữa màn học viên và trang công khai `/t/<mã>`.
 *
 * Tách khỏi `student-flashcard-reader.tsx` khi làm trang công khai. Chép bản
 * thứ hai của khối này là đúng hình dạng `BUG_M10_01`: hai đường code cùng dựng
 * một thứ rồi trôi khác nhau ở chỗ nhìn thấy được — mà `FlashcardSizer` dưới đây
 * là thứ đã tốn cả một đợt QA để làm cho đúng.
 *
 * ⛔ Đừng gộp ngược vào reader. `tests/unit/flashcard-face-single-source.test.ts`
 * đang canh việc chỉ có MỘT nơi dựng mặt thẻ.
 */

/**
 * Chiều cao THẬT của thẻ.
 *
 * Hai mặt đều `absolute inset-0` (bắt buộc, để lật 3D được), nên tự chúng không
 * đẩy được chiều cao nào. Trước Phase 16 thẻ là ẢNH nên một `min-height` cố định
 * là đủ; nay mặt sau là CHỮ và dài ngắn tuỳ thẻ. Khối này dựng cả hai mặt trong
 * CÙNG một ô grid, để trong luồng nhưng ẩn đi — ô grid vì thế cao bằng mặt cao
 * hơn, và thẻ luôn vừa đủ chứa chữ.
 *
 * Đây chính là chỗ sửa lời than gốc: chữ TỰ XUỐNG DÒNG và thẻ nở theo, thay vì
 * `object-cover` cắt cụt nội dung.
 */
export function FlashcardSizer({ page }: { page: FlashcardFaceData }) {
  return (
    <div aria-hidden className="pointer-events-none invisible grid">
      {/*
        `border` để box-model KHỚP với `FlashcardFaceShell` (shell có viền 1px).
        Thiếu nó thì ô sizer cao hơn shell đúng 2px viền → mặt sau tràn 1–2px và
        bài "chữ không bị cắt" đỏ vì làm tròn.
      */}
      <div className="col-start-1 row-start-1 rounded-2xl border">
        <FlashcardFaceContent page={page} face="front" />
      </div>
      <div className="col-start-1 row-start-1 rounded-2xl border">
        <FlashcardFaceContent page={page} face="back" />
      </div>
    </div>
  );
}

export function FlashcardFaces({
  page,
  face,
  /**
   * Thời lượng lật. Màn học viên giữ 500ms như cũ; trang công khai dùng 300ms
   * vì trên điện thoại học sinh lật liên tục hàng chục thẻ, 500ms thành lê thê
   * (ngưỡng khuyến nghị cho chuyển cảnh phức tạp là ≤400ms).
   */
  durationClassName = "duration-500",
}: {
  page: FlashcardFaceData;
  face: Face;
  durationClassName?: string;
}) {
  return (
    <div
      data-face={face}
      className={`absolute inset-0 origin-center transition-transform [transform-style:preserve-3d] motion-reduce:transition-none ${durationClassName}`}
      style={{
        transform: `rotateX(${face === "back" ? 180 : 0}deg)`,
      }}
    >
      <FlashcardFaceShell>
        {/* Ảnh trang mở đầu là LCP của cả hai màn — giữ `priority`. */}
        <FlashcardFaceContent page={page} face="front" priority />
      </FlashcardFaceShell>
      <FlashcardFaceShell back>
        <FlashcardFaceContent page={page} face="back" />
      </FlashcardFaceShell>
    </div>
  );
}

function FlashcardFaceShell({
  children,
  back = false,
}: {
  children: React.ReactNode;
  back?: boolean;
}) {
  return (
    <div
      // Mốc để bài kiểm soi đúng MỘT mặt: cùng một chữ Hán có mặt ở cả mặt
      // trước lẫn khối "Thẻ" của mặt sau.
      data-face-side={back ? "back" : "front"}
      className={`bg-card absolute inset-0 overflow-hidden rounded-2xl border shadow-lg [backface-visibility:hidden] ${
        back ? "[transform:rotateX(180deg)]" : ""
      }`}
    >
      {children}
    </div>
  );
}

export function FlashcardSurface({
  page,
  face,
  className = "min-h-[var(--fc-face-min-h)]",
  durationClassName,
  fill = false,
}: {
  page: FlashcardFaceData;
  face: Face;
  className?: string;
  durationClassName?: string;
  /**
   * `true` ⇒ thẻ cao ĐÚNG bằng ô chứa nó, không dùng `FlashcardSizer`.
   *
   * Dùng cho **khung đọc thẻ** (`flashcard-reader-frame.tsx`). Lý do là lời than
   * thật của user 2026-07-25: *"phần nội dung flashcard thì phải lướt lên lướt
   * xuống thì mới thấy đầy đủ nội dung"*. Gốc rễ là `FlashcardSizer` — nó đo
   * chiều cao bằng mặt CAO HƠN của hai mặt, nên một thẻ có mặt sau bốn khối làm
   * cả thẻ cao gấp đôi màn hình, và mặt trước (ngắn) bị đẩy lệch khỏi vùng nhìn.
   *
   * Ở chế độ này thẻ vừa khít vùng thẻ, còn việc "vừa nội dung" chuyển vào TỪNG
   * MẶT: mặt trước cho ảnh co (`flex-1 min-h-0`), mặt sau thu cỡ chữ
   * (`FitText`). Nhờ vậy không mặt nào phải cuộn.
   *
   * ⚠️ Ô xem trước của màn Quản trị vẫn dùng `FlashcardSizer` (mặc định
   * `false`): ở đó thẻ nằm trong ô cao cố định và cần nở theo nội dung.
   */
  fill?: boolean;
}) {
  if (fill) {
    return (
      <div className={`relative h-full rounded-2xl ${className}`}>
        <FlashcardFaces
          page={page}
          face={face}
          durationClassName={durationClassName}
        />
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl ${className}`}>
      <FlashcardSizer page={page} />
      <FlashcardFaces
        page={page}
        face={face}
        durationClassName={durationClassName}
      />
    </div>
  );
}
