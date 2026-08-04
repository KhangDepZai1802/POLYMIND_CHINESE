"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Nút In (AC4.1) — client component nhỏ nhất có thể: chỉ để gọi
 * `window.print()`. Toàn bộ bản in là print stylesheet, không render lại gì.
 */
export function PrintButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()}>
      <Printer /> In báo cáo
    </Button>
  );
}
