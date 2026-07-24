"use client";

import { AlertTriangle, RotateCw } from "lucide-react";

import "./globals.css";

import { Button } from "@/components/ui/button";

/**
 * Lưới an toàn cuối cùng (DS-018): chỉ chạy khi chính `RootLayout` đổ vỡ.
 *
 * Next thay thế toàn bộ cây gốc bằng file này, nên nó phải tự render `<html>`
 * và `<body>` và tự import `globals.css`. Font Be Vietnam Pro nạp trong
 * `RootLayout` không còn — `--font-sans` rơi về "Segoe UI"/system-ui, chấp nhận
 * được cho một trang chỉ hiện khi mọi thứ khác đã hỏng.
 *
 * `(dashboard)/error.tsx` mới là trang lỗi người dùng thực tế gặp; file này chỉ
 * để không bao giờ còn màn hình lỗi tiếng Anh của Next.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="bg-surface-page text-foreground flex min-h-full flex-col">
        <main className="flex flex-1 items-center justify-center p-4">
          <div className="bg-card flex max-w-lg flex-col items-center gap-4 rounded-xl border px-6 py-10 text-center shadow-sm">
            <div className="bg-destructive/10 flex size-12 items-center justify-center rounded-full">
              <AlertTriangle className="text-destructive size-6" aria-hidden />
            </div>

            <div>
              <h1 className="text-lg font-semibold">
                Ứng dụng gặp sự cố ngoài dự kiến
              </h1>
              <p className="text-text-secondary mx-auto mt-1 max-w-sm text-sm">
                Bạn thử tải lại trang. Nếu vẫn lỗi, báo cho quản trị viên kèm mã
                bên dưới.
              </p>
            </div>

            {error.digest && (
              <p className="text-muted-foreground font-mono text-sm">
                Mã lỗi: {error.digest}
              </p>
            )}

            <Button type="button" onClick={reset}>
              <RotateCw className="size-4" aria-hidden />
              Thử lại
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
