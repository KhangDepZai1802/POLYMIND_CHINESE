"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Loader2 } from "lucide-react";

import { loginAction, type ActionState } from "@/features/auth/server/actions";
import { AuthFormFeedback } from "@/features/auth/components/auth-form-feedback";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

const ERROR_ID = "login-error";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    loginAction,
    { error: initialError },
  );

  // Câu lỗi của `loginAction` cố ý gộp hai khả năng ("Tên đăng nhập hoặc mật
  // khẩu không đúng") để không lộ tài khoản nào có thật. Vì nó nói về CẢ HAI ô
  // nên đánh dấu cả hai là `aria-invalid` mới đúng sự thật — server không cho
  // biết ô nào sai, và đoán bừa một ô là nói sai với người dùng.
  const invalid = state.error ? { "aria-invalid": true as const } : {};

  // Ô có điều khiển (`value` + `onChange`) chứ không để trình duyệt tự giữ.
  //
  // React 19 gọi `form.reset()` sau khi mỗi form action chạy xong, nên gõ sai
  // mật khẩu một lần là MẤT LUÔN tên đăng nhập vừa gõ. Đo được: sau khi báo
  // sai, `#identifier` có giá trị `""`. Đã kiểm chứng ngược bằng `git stash`
  // trên code gốc — cũng ra `""`, tức lỗi có sẵn chứ không phải do đợt này.
  // Với tên đăng nhập do trung tâm cấp kiểu `gv.an` thì bắt gõ lại từ đầu sau
  // mỗi lần sai mật khẩu là phiền vô cớ.
  //
  // Cố ý CHỈ giữ tên đăng nhập, không giữ mật khẩu: giữ mật khẩu trong state
  // của React là kéo dài vòng đời của nó trong bộ nhớ trang mà không đổi lại
  // được gì — trình quản lý mật khẩu của trình duyệt đã điền hộ rồi.
  const [identifier, setIdentifier] = useState("");

  return (
    <Card>
      <CardHeader>
        {/* `asChild` → <h1>: đây là tiêu đề thật của trang. Xem ghi chú ở
            `(auth)/layout.tsx` về việc 4 màn từng dùng chung một heading. */}
        <CardTitle asChild>
          <h1 className="text-lg">Đăng nhập</h1>
        </CardTitle>
        <CardDescription>
          Dùng tên đăng nhập và mật khẩu được trung tâm cấp.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form action={formAction} className="space-y-4">
          <AuthFormFeedback
            isPending={isPending}
            error={state.error}
            errorId={ERROR_ID}
          />

          <div className="space-y-2">
            <Label htmlFor="identifier">Tên đăng nhập</Label>
            <Input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              // Bàn phím di động viết hoa chữ đầu theo mặc định, biến "gv.an"
              // thành "Gv.an" ngay trước mắt người dùng. Máy chủ đã
              // `.toLowerCase()` (`loginIdentifierToEmail`) nên đăng nhập vẫn
              // chạy — nhưng người dùng nhìn thấy chữ hoa lại tưởng mình gõ sai
              // và xoá đi gõ lại.
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              placeholder="Ví dụ: gv.an"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              {...invalid}
              aria-describedby={state.error ? ERROR_ID : undefined}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Mật khẩu</Label>
              {/* Bản cũ đo được 111×20px trên desktop — hụt ngưỡng 24px của
                  WCAG 2.5.8 (`DS-034`).
                  ⚠️ Nới bằng `py-1` chứ KHÔNG bằng `min-h-6`. Đã thử `min-h-6`
                  và đo lại thì trên Pixel 7 link tụt từ 44px xuống 24px: khối
                  `@media (pointer: coarse)` của `globals.css` nằm trong
                  `@layer base`, còn class Tailwind nằm ở `@layer utilities` —
                  layer sau thắng bất kể độ đặc hiệu, nên `min-h-6` xoá sạch
                  luật 44px. Padding không đụng `min-height` nên `globals.css`
                  vẫn là NƠI DUY NHẤT ép 44px, đúng kiến trúc `DS-013`.
                  Kết quả: chuột 20+8 = 28px, cảm ứng vẫn 44px. */}
              <Link
                href="/forgot-password"
                className="text-primary focus-visible:ring-ring/50 inline-flex items-center rounded-sm py-1 text-sm hover:underline focus-visible:ring-[3px] focus-visible:outline-none"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <PasswordInput
              id="password"
              name="password"
              fieldLabel="mật khẩu"
              autoComplete="current-password"
              required
              {...invalid}
              aria-describedby={state.error ? ERROR_ID : undefined}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            )}
            {isPending ? "Đang đăng nhập…" : "Đăng nhập"}
          </Button>

          {/* `text-sm` chứ không `text-xs`: đây là lối thoát duy nhất cho người
              chưa có tài khoản, đo được 12px ở bản cũ. */}
          <p className="text-muted-foreground text-center text-sm">
            Chưa có tài khoản? Liên hệ quản trị viên của trung tâm để được cấp.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
