import { Construction } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

/**
 * Chỗ giữ chỗ cho màn hình sẽ làm ở phase sau.
 *
 * Có mặt để app shell + điều hướng + phân quyền chạy được end-to-end ngay từ
 * Phase 1 — không phải để giả vờ tính năng đã xong. `phase` nói rõ khi nào có thật.
 */
export function ComingSoon({ phase }: { phase: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <Construction className="text-muted-foreground size-8" aria-hidden />
        <div>
          <p className="font-medium">Màn hình này chưa được xây dựng</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Dự kiến hoàn thành ở <span className="font-medium">{phase}</span>.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
