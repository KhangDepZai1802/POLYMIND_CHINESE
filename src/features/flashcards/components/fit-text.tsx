"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * THU CHỮ CHO VỪA CHIỀU CAO — user chốt 2026-07-25 cho **mặt sau thẻ từ vựng**.
 *
 * Mặt sau có 4 khối (Thẻ · Nghĩa · Câu ví dụ · Cụm từ). Ở cỡ chữ gốc, một thẻ
 * hai câu ví dụ + ba cụm từ cần ~800px — không vừa vùng thẻ ~500px của điện
 * thoại. User chốt **thu nhỏ chữ cho vừa** thay vì cuộn (tôi đã nêu vế đánh đổi
 * là chữ nhỏ khó đọc; user vẫn chọn phương án này).
 *
 * 🔴 THU BẰNG `font-size`, KHÔNG bằng `transform: scale()`. Đây là điểm dễ làm
 * sai nhất: `transform` **không đổi kích thước layout** — nội dung nhìn thì vừa
 * mà hộp vẫn cao như cũ, nên mặt thẻ vẫn sinh cuộn và bài kiểm "chữ KHÔNG bị
 * cắt" (`scrollHeight <= clientHeight`) vẫn đỏ đúng. Đổi `font-size` thì chữ
 * **chảy lại thật**, chiều cao layout co theo, và không có thanh cuộn nào.
 *
 * Hệ quả bắt buộc: mọi cỡ chữ/khoảng cách trong vùng này phải khai bằng `em`
 * (tương đối với gốc) chứ không `rem`. `rem` neo vào `<html>` nên sẽ **phớt lờ**
 * việc thu nhỏ — dấu hiệu là chữ không đổi cỡ dù `--fit-scale` đã giảm.
 *
 * Vòng đo CHỈ ĐI MỘT CHIỀU (giảm dần từ 1) nên không có dao động: mỗi lần chỉ co
 * thêm khi nội dung còn tràn, và dừng khi vừa hoặc khi chạm sàn.
 */

/**
 * Sàn cỡ chữ. `0.78 × 14px ≈ 11px` cho dòng nhỏ nhất của mặt sau.
 *
 * Có sàn vì "thu cho vừa" không có sàn sẽ tự trôi tới cỡ chữ không đọc nổi trên
 * đúng những thẻ nhiều nội dung nhất — mà thẻ nhiều nội dung mới là thẻ cần đọc.
 * Chạm sàn mà vẫn dài thì phần dư CUỘN trong lòng thẻ: chữ nhỏ còn đọc được,
 * chữ mất thì không.
 */
const MIN_SCALE = 0.78;

/** Dưới ngưỡng này coi như đã vừa — tránh co thêm vì lẻ sub-pixel. */
const FIT_TOLERANCE_PX = 2;

/** Chặn vòng lặp vô hạn nếu một bước co làm chữ chảy lại rồi cao lên. */
const MAX_STEPS = 8;

/**
 * ⚠️ Đặt lại tỉ lệ khi sang thẻ khác bằng **`key` của React** ở nơi gọi
 * (`<FitText key={…}>`), KHÔNG bằng `setState` trong effect: giữ lại tỉ lệ của
 * thẻ cũ sẽ làm một thẻ ngắn bị thu nhỏ vô cớ, còn reset bằng effect thì vừa
 * thêm một lượt render vừa phạm luật `react-hooks/set-state-in-effect`.
 */
export function FitText({
  className = "",
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const stepsRef = useRef(0);

  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    function fit() {
      const element = boxRef.current;
      if (!element) return;
      const available = element.clientHeight;
      const natural = element.scrollHeight;
      if (!available || !natural) return;
      if (natural <= available + FIT_TOLERANCE_PX) return;
      if (stepsRef.current >= MAX_STEPS) return;

      setScale((current) => {
        if (current <= MIN_SCALE) return current;
        stepsRef.current += 1;
        // Nhân theo tỉ lệ thiếu, nhưng mỗi bước không co quá 12% để một bước
        // không nhảy quá xa rồi thu nhỏ hơn mức cần.
        const wanted = current * Math.max(0.88, available / natural);
        return Math.max(MIN_SCALE, wanted);
      });
    }

    fit();
    // Đo lại khi vùng thẻ đổi kích thước (xoay ngang, đổi bề rộng cửa sổ) —
    // `ResizeObserver` theo dõi hộp LAYOUT nên việc đổi `font-size` cũng kích
    // hoạt nó, đúng thứ cần để vòng co chạy tiếp một bước nữa.
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [scale]);

  return (
    <div
      ref={boxRef}
      data-fit-scale={scale.toFixed(3)}
      style={{ fontSize: `${scale}rem` }}
      /*
       * `overflow-y-auto` là LƯỚI AN TOÀN cho ca chạm sàn, không phải cách xem
       * mặc định: khi vừa (gần như luôn) thì không có gì để cuộn.
       */
      className={`h-full overflow-y-auto overscroll-contain ${className}`}
    >
      {children}
    </div>
  );
}
