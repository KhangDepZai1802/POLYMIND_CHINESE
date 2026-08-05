import { ArrowUpRight, Lock, Youtube } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { youtubeWatchUrl } from "@/features/videos/domain/youtube-url";
import type { VideoCollectionView } from "@/features/videos/server/queries";

/**
 * Danh sách video bài giảng của học viên (`VIDEO-1e`).
 *
 * User chốt 2026-08-05: *"chỉ để tiêu đề vid và icon youtube, mà phải nhỏ gọn
 * cẩn thận giao diện điện thoại học viên"* — nên mỗi hàng đúng ba thứ: icon,
 * tiêu đề, mũi tên ra ngoài. Không thumbnail, không mô tả, không hai dòng.
 *
 * Dùng lại ngôn ngữ thị giác của `student-flashcard-deck-picker.tsx`
 * (`student-sky-*`, chip trắng `size-10`, bo `rounded-xl`) để tab thứ ba trông
 * như cùng một hệ với hai tab đã có.
 *
 * ⚠️ Video nằm trên YouTube: ai có link đều xem được. RLS chỉ giấu **danh sách**
 * link khỏi người ngoài khoá. Đánh đổi user đã chốt — xem `docs/13`.
 */
export function StudentVideoList({
  collection,
  courseName,
}: {
  collection: VideoCollectionView | null;
  courseName: string | null;
}) {
  const items = collection?.items ?? [];

  if (!collection || items.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <h2 className="font-semibold">Video bài giảng</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {courseName
              ? `${courseName} chưa có video bài giảng.`
              : "Bạn chưa được xếp vào lớp nào nên chưa có video."}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4 sm:p-6">
        <div>
          <h2 className="font-semibold">{collection.title}</h2>
          <p className="text-muted-foreground text-sm">
            {items.length} buổi · video mở ở YouTube trong tab mới.
          </p>
        </div>

        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const locked = item.status !== "published";

            /*
             * Buổi chưa công bố hiện MỜ chứ không ẩn (`empty-nav-state`).
             * Giấu đi thì học viên tưởng khóa chỉ có mấy buổi; thấy ổ khóa thì
             * biết còn bao nhiêu buổi phía trước.
             */
            if (locked) {
              return (
                <li key={item.id}>
                  <div
                    aria-disabled="true"
                    className="border-border bg-muted text-muted-foreground flex min-h-14 w-full items-center gap-3 rounded-xl border p-2 pr-3"
                  >
                    <span className="bg-card flex size-10 shrink-0 items-center justify-center rounded-lg">
                      <Lock className="text-muted-foreground size-5" aria-hidden />
                    </span>
                    {/*
                      `min-w-0` là BẮT BUỘC, không phải cho đẹp. Lỗi này đã cắn
                      repo ba lần (`UX-UIUX-M16-002`, `UX-STUDENTS-1`): khối
                      `flex-1` cạnh khối `shrink-0` mà thiếu `min-w-0` thì nó
                      KHÔNG co, nó đẩy phần tử bên cạnh ra ngoài thẻ.
                    */}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">
                        <span className="font-semibold">
                          Buổi {item.session_number}
                        </span>{" "}
                        · Chưa mở
                      </span>
                    </span>
                  </div>
                </li>
              );
            }

            return (
              <li key={item.id}>
                {/*
                  `<a>` chứ không `<button onClick={window.open}>`: thẻ `a` cho
                  sẵn bấm giữa chuột, nhấn giữ hiện menu trên điện thoại, và
                  trình đọc màn hình đọc đúng là *liên kết*.
                  `rel="noopener"` là bắt buộc về an ninh — thiếu nó thì trang
                  YouTube vừa mở giữ được `window.opener` trỏ ngược về web này.
                */}
                <a
                  href={youtubeWatchUrl(item.youtube_video_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={item.displayTitle}
                  className="border-student-sky-border bg-student-sky-surface hover:border-primary focus-visible:ring-ring flex min-h-14 w-full items-center gap-3 rounded-xl border p-2 pr-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="bg-card flex size-10 shrink-0 items-center justify-center rounded-lg">
                    {/* Đỏ YouTube trên chip TRẮNG đạt 4,0:1; đặt thẳng lên nền
                        xanh `--student-sky-surface` chỉ còn 3,64:1. */}
                    <Youtube className="size-5 text-[#f00]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      <span className="text-student-sky-ink font-semibold">
                        Buổi {item.session_number}
                      </span>{" "}
                      · {item.displayTitle}
                    </span>
                  </span>
                  <ArrowUpRight
                    className="text-student-sky-ink size-5 shrink-0"
                    aria-hidden
                  />
                  <span className="sr-only">(mở ở YouTube, tab mới)</span>
                </a>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
