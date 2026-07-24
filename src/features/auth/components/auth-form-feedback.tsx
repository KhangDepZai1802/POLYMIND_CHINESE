"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * Khối thông báo kết quả cho 3 form auth, kèm phần TRẢ LẠI TIÊU ĐIỂM.
 *
 * Vì sao phải có: nút gửi mang `disabled={isPending}`. Trình duyệt không giữ
 * tiêu điểm trên một phần tử vừa bị `disabled`, nên ngay khi bấm Đăng nhập,
 * tiêu điểm rơi về `<body>` — đo được ở cả Chromium lẫn Pixel 7: trước khi bấm
 * là `INPUT#password`, sau khi có lỗi là `BODY`. Hệ quả với người dùng bàn
 * phím: sai mật khẩu xong phải bấm **5 lần Tab** mới quay lại được ô mật khẩu.
 * Nút được bật lại sau đó, nhưng tiêu điểm thì không tự về.
 *
 * Cách sửa: sau mỗi lượt gửi kết thúc, đưa tiêu điểm vào chính khối thông báo.
 * Người dùng nghe/đọc được lý do hỏng, và Tab tiếp theo đi thẳng vào form.
 *
 * ⚠️ Bám theo chuyển trạng thái `isPending: true → false`, **không** bám theo
 * nội dung thông báo. Lý do: thông báo đăng nhập sai luôn là một câu cố định
 * (`GENERIC_LOGIN_ERROR` — cố ý chung chung để không lộ tài khoản nào có
 * thật), nên nếu bám theo chuỗi thì lần sai thứ hai trở đi chuỗi không đổi,
 * effect không chạy lại và tiêu điểm lại mất.
 *
 * Cũng vì vậy mà lần render đầu tiên KHÔNG cướp tiêu điểm: `?error=` trên URL
 * hiện lỗi sẵn khi vừa mở trang, tự nhảy vào đó là giật tiêu điểm của người
 * dùng chứ không giúp gì.
 */
export function AuthFormFeedback({
  isPending,
  error,
  success,
  errorId,
}: {
  isPending: boolean;
  error?: string;
  success?: string;
  /** Để ô nhập trỏ về bằng `aria-describedby` khi lỗi thuộc về ô đó. */
  errorId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    const justFinished = wasPending.current && !isPending;
    wasPending.current = isPending;
    if (justFinished) ref.current?.focus();
  }, [isPending, error, success]);

  if (!error && !success) return null;

  return (
    <Alert
      ref={ref}
      // `-1` = nhận được tiêu điểm bằng mã, nhưng KHÔNG chen vào thứ tự Tab.
      // Dùng `0` sẽ thêm một chặng Tab vô nghĩa vào form.
      tabIndex={-1}
      id={error ? errorId : undefined}
      variant={error ? "destructive" : "default"}
      className="focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
    >
      {error ? (
        <AlertCircle className="size-4" aria-hidden />
      ) : (
        <CheckCircle2 className="size-4" aria-hidden />
      )}
      <AlertDescription>{error ?? success}</AlertDescription>
    </Alert>
  );
}
