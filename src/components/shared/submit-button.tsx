"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

/**
 * Nút submit tự khóa khi form đang gửi.
 *
 * Không chỉ để đẹp: chặn double-submit ở tầng UI. Nhưng nó KHÔNG PHẢI là cơ chế
 * chống trùng — người dùng vẫn có thể gửi request bằng tay. Chống trùng thật nằm
 * ở DB (unique index + ON CONFLICT).
 */
export function SubmitButton({
  children,
  pendingText,
  className,
  variant,
  size,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      disabled={pending}
      className={className}
      variant={variant}
      size={size}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending ? (pendingText ?? "Đang lưu…") : children}
    </Button>
  );
}
