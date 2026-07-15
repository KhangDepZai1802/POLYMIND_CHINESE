import { Megaphone } from "lucide-react";

import { StatusBadge } from "@/components/shared/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AnnouncementRecord } from "@/features/announcements/types";
import { formatDateTime } from "@/lib/dates";

export function AnnouncementFeed({
  announcements,
}: {
  announcements: AnnouncementRecord[];
}) {
  if (announcements.length === 0) return null;

  return (
    <Card className="border-primary/20 mb-5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Megaphone className="size-4" aria-hidden />
          Announcement đang hiệu lực
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 lg:grid-cols-2">
          {announcements.map((announcement) => (
            <article
              key={announcement.id}
              className="bg-primary/5 rounded-lg border px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h2 className="font-semibold">{announcement.title}</h2>
                <StatusBadge
                  label={
                    announcement.class
                      ? `${announcement.class.code} — ${announcement.class.name}`
                      : "Toàn hệ thống"
                  }
                  tone="info"
                />
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">
                {announcement.body}
              </p>
              <p className="text-muted-foreground mt-2 text-xs">
                Phát hành {formatDateTime(announcement.published_at)}
                {announcement.expires_at
                  ? ` · Hết hạn ${formatDateTime(announcement.expires_at)}`
                  : ""}
              </p>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
