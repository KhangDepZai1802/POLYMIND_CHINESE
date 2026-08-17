"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * XUẤT BÁO CÁO RA PDF — bằng hộp thoại In của trình duyệt (user chốt 2026-08-17).
 *
 * =============================================================================
 * VÌ SAO TÊN FILE ĐI QUA `document.title`
 * =============================================================================
 *
 * User yêu cầu file PDF phải tên `LOP-03_Buoi-4_17-08-2026.pdf` ở **cả** trang
 * giáo vụ lẫn trang giáo viên, và chốt không thêm thư viện PDF nào. Chrome, Edge
 * và Firefox lấy **`document.title`** làm tên file gợi ý trong hộp thoại In rồi
 * tự thêm `.pdf` — nên đổi tiêu đề tài liệu ngay trước khi in là toàn bộ cách
 * điều khiển tên file mà ta có.
 *
 * ⚠️ Vì vậy `fileName` truyền vào đây **không được** có đuôi `.pdf`
 * (`sessionReportFileBase()` lo chuyện đó) — có sẵn đuôi là ra `....pdf.pdf`.
 *
 * =============================================================================
 * 🔴 CHỜ ẢNH TẢI XONG MỚI IN
 * =============================================================================
 *
 * Mục 8 nhúng ảnh minh chứng qua URL ký hạn ngắn. Gọi `window.print()` ngay lúc
 * mở trang là hộp thoại chụp lấy DOM khi ảnh còn trống ⇒ PDF ra **ô trắng** ở
 * đúng phần minh chứng — cùng họ với lỗi `next/image` tải lười mà
 * `TEACHER-REPORT-3a` đã sửa. `img.complete` là cờ duy nhất nói được "ảnh này đã
 * ở trong DOM rồi"; ảnh lỗi cũng resolve (fail-open) để một URL hết hạn không
 * treo cả lượt xuất.
 *
 * =============================================================================
 * KHÔI PHỤC TIÊU ĐỀ Ở `afterprint`, KHÔNG PHẢI NGAY SAU `print()`
 * =============================================================================
 *
 * `window.print()` chặn luồng trên Chrome desktop nhưng KHÔNG chặn trên Safari
 * và trên điện thoại. Khôi phục tiêu đề ngay dòng sau là có máy đổi tiêu đề lúc
 * hộp thoại còn mở, tức tên file gợi ý bị đổi ngược lại đúng lúc người dùng sắp
 * bấm Lưu.
 */

/** Chờ mọi ảnh trong bản in vào DOM. Ảnh lỗi cũng tính là xong (fail-open). */
async function waitForReportImages(): Promise<void> {
  if (typeof document === "undefined") return;

  const images = Array.from(
    document.querySelectorAll<HTMLImageElement>("[data-report-print] img"),
  );

  await Promise.all(
    images.map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            image.addEventListener("load", () => resolve(), { once: true });
            image.addEventListener("error", () => resolve(), { once: true });
          }),
    ),
  );

  // Font chưa xong thì trang bị in bằng font dự phòng, chữ tràn khác hẳn bản xem.
  await document.fonts?.ready;
}

async function printWithFileName(fileName: string): Promise<void> {
  const previousTitle = document.title;
  document.title = fileName;

  window.addEventListener(
    "afterprint",
    () => {
      document.title = previousTitle;
    },
    { once: true },
  );

  await waitForReportImages();
  window.print();
}

/**
 * Nút "Xuất báo cáo" — dùng ở trang chi tiết báo cáo của GIÁO VỤ.
 *
 * Trạng thái chờ hiện ra vì `waitForReportImages()` có thể mất một nhịp khi mục
 * 8 có mấy tấm ảnh: bấm mà không có tín hiệu nào là người dùng bấm tiếp lần hai
 * (bài học `UX-MOBILE-3`).
 */
export function ExportReportPdfButton({
  fileName,
  label = "Xuất báo cáo",
}: {
  /** KHÔNG kèm `.pdf` — xem chú thích đầu file. */
  fileName: string;
  label?: string;
}) {
  const [preparing, setPreparing] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      aria-busy={preparing}
      disabled={preparing}
      onClick={async () => {
        setPreparing(true);
        try {
          await printWithFileName(fileName);
        } finally {
          setPreparing(false);
        }
      }}
    >
      {preparing ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <Printer className="size-4" aria-hidden />
      )}
      {preparing ? "Đang chuẩn bị…" : label}
    </Button>
  );
}

/**
 * Tự mở hộp thoại In khi trang bản in của GIÁO VIÊN tải xong.
 *
 * Giáo viên bấm *"Xuất báo cáo"* ở danh sách → sang trang này → hộp thoại In bật
 * sẵn. Không bắt họ tìm thêm một cái nút nữa cho một việc họ đã nói là muốn làm.
 *
 * `printedRef` chặn in hai lần: React ở chế độ dev gọi effect hai lượt, và
 * `window.print()` hai lượt là hai hộp thoại xếp lên nhau.
 */
export function AutoPrintOnLoad({ fileName }: { fileName: string }) {
  const printedRef = useRef(false);

  useEffect(() => {
    if (printedRef.current) return;
    printedRef.current = true;
    void printWithFileName(fileName);
  }, [fileName]);

  return null;
}
