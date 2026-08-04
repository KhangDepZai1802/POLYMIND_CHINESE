import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export type StatTile = {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  /** `warning` tô giá trị bằng màu cảnh báo — luôn đi kèm nhãn chữ, không chỉ màu. */
  tone?: "default" | "warning";
};

/**
 * Dãy KPI của báo cáo học tập (D9/D11).
 *
 * Cấu trúc `<dl>` nằm TRONG từng thẻ — bài học từ `Summary` của trang báo cáo
 * học phí: bọc `<dl>` ra ngoài các `Card` thì `<dt>` sâu hai cấp so với `<dl>`
 * và axe báo `definition-list`/`dlitem`.
 */
export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Card key={tile.label} className="h-full gap-1 py-4">
            <CardContent className="flex items-start gap-3 px-4">
              {Icon && (
                <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <Icon className="text-muted-foreground size-4" aria-hidden />
                </span>
              )}
              <dl className="min-w-0">
                <dt className="text-text-secondary text-sm">{tile.label}</dt>
                <dd
                  className={`mt-0.5 text-2xl font-semibold tabular-nums ${
                    tile.tone === "warning" ? "text-warning" : ""
                  }`}
                >
                  {tile.value}
                </dd>
                {tile.hint && (
                  <dd className="text-muted-foreground mt-0.5 text-sm">
                    {tile.hint}
                  </dd>
                )}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
