"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Ô mật khẩu có nút hiện/ẩn.
 *
 * Tài khoản ở hệ này do quản trị viên cấp (`D-21`), nên người dùng thường phải
 * gõ lại một chuỗi được đọc cho nghe hoặc chép từ giấy — không nhìn thấy mình
 * gõ gì là nguyên nhân sai phổ biến nhất. Nút hiện/ẩn chỉ đổi `type` ở phía
 * trình duyệt: **không** đổi `name`, giá trị gửi lên, validation hay hành vi
 * server.
 *
 * Ba điểm bắt buộc, không phải trang trí:
 * - Nút mang `type="button"`. Thiếu nó thì nút nằm trong `<form>` mặc định là
 *   submit → bấm để xem mật khẩu lại thành gửi form.
 * - Khi hiện mật khẩu thì tắt spellcheck/autocorrect, vì lúc đó trình duyệt
 *   nhìn mật khẩu như văn bản thường và có thể gạch chân đỏ hoặc tự sửa.
 * - `fieldLabel` là **bắt buộc trong kiểu dữ liệu**, không phải tuỳ chọn.
 *   Màn "Đặt lại mật khẩu" có hai ô mật khẩu; nếu nhãn nút cố định là "Hiện
 *   mật khẩu" thì hai nút icon cạnh nhau mang **trùng tên gọi được** — đúng
 *   lỗi đã sửa ở M18 (`UX-UIUX-M18-003`). Bắt qua kiểu dữ liệu để lỗi đó
 *   không quay lại im lặng, giống cách `native-select.tsx` bắt buộc `id`.
 */
function PasswordInput({
  className,
  fieldLabel,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type"> & {
  /** Tên ô ở dạng thường, để ghép thành nhãn nút: `Hiện mật khẩu mới`. */
  fieldLabel: string;
}) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        // Chừa chỗ cho nút, nếu không chuỗi dài chạy xuống dưới nút và
        // ký tự cuối bị che.
        className={cn("pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        // `aria-pressed` để trình đọc màn hình nói được trạng thái hiện tại;
        // nhãn nói HÀNH ĐỘNG sắp xảy ra khi bấm.
        aria-pressed={visible}
        aria-label={`${visible ? "Ẩn" : "Hiện"} ${fieldLabel}`}
        data-size="icon-sm"
        className={cn(
          "text-muted-foreground hover:text-foreground absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-md",
          "focus-visible:ring-ring/50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:outline-none",
        )}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

export { PasswordInput };
