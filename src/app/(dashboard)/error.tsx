"use client";

import Link from "next/link";
import { AlertTriangle, Home, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Error boundary cho toàn bộ khu vực đã đăng nhập (DS-018).
 *
 * Trước đó `src/app/` KHÔNG có `error.tsx` ở bất kỳ đâu, nên mọi query `throw`
 * đều rơi vào trang lỗi mặc định của Next: tiếng Anh, không có đường phục hồi,
 * và mất luôn sidebar/header. Đặt ở `(dashboard)` thay vì ở gốc để giữ được
 * shell — người dùng vẫn thấy mình đang ở đâu và vẫn chuyển module được.
 *
 * KHÔNG nuốt lỗi: `error` vẫn đi lên Next để log ở server. Ở giao diện chỉ hiện
 * `digest` — mã tra cứu log — chứ không hiện `error.message`, vì message có thể
 * chứa tên bảng/cột hoặc chi tiết RLS (EX-21, EX-22: không lộ payload kỹ thuật).
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <div className="bg-destructive/10 flex size-12 items-center justify-center rounded-full">
          <AlertTriangle className="text-destructive size-6" aria-hidden />
        </div>

        <div>
          <h1 className="text-lg font-semibold">Không tải được nội dung</h1>
          <p className="text-text-secondary mx-auto mt-1 max-w-sm text-sm">
            Đã có lỗi khi lấy dữ liệu cho trang này. Bạn thử tải lại; nếu vẫn
            lỗi, báo cho quản trị viên kèm mã bên dưới.
          </p>
        </div>

        {error.digest && (
          <p className="text-muted-foreground font-mono text-sm">
            Mã lỗi: {error.digest}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button type="button" onClick={reset}>
            <RotateCw className="size-4" aria-hidden />
            Thử lại
          </Button>
          <Button asChild variant="outline">
            <Link href="/">
              <Home className="size-4" aria-hidden />
              Về trang chủ
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
