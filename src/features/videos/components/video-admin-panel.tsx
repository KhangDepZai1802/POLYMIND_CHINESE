"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ExternalLink,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw,
  Trash2,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VideoImportDialog } from "@/features/videos/components/video-import-dialog";
import { youtubeWatchUrl } from "@/features/videos/domain/youtube-url";
import {
  createVideoCollectionAction,
  deleteVideoItemAction,
  refreshVideoTitlesAction,
  setVideoCollectionStatusAction,
} from "@/features/videos/server/actions";
import type {
  VideoCollectionView,
  VideoCourseOption,
} from "@/features/videos/server/queries";

/**
 * Màn quản trị video bài giảng (`VIDEO-1d`).
 *
 * Trạng thái "đang xem khoá nào" nằm ở **URL** (`?course=`) chứ không ở
 * `useState`, dùng chung đúng tham số với tab Bộ thẻ — đổi khoá ở tab này rồi
 * chuyển tab kia thì vẫn đúng khoá đó, và gửi link cho nhau vẫn mở ra đúng chỗ
 * (`deep-linking`, `state-preservation`, đúng ghi chú `MULTIDECK-1d`).
 */
export function VideoAdminPanel({
  courses,
  selectedCourseId,
  collection,
  loadError,
}: {
  courses: VideoCourseOption[];
  selectedCourseId: string | null;
  collection: VideoCollectionView | null;
  loadError: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  const course = courses.find((item) => item.id === selectedCourseId) ?? null;

  function run(work: () => Promise<{ error?: string; success?: string }>) {
    startTransition(async () => {
      const result = await work();
      if (result.error) toast.error(result.error);
      else toast.success(result.success ?? "Xong.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/*
        Lỗi tải hiện NGAY ĐẦU màn và ở lại đó, không phải toast thoáng qua:
        đây là sự cố máy chủ cần người sửa, khác hẳn lỗi thao tác.
        `role="alert"` để trình đọc màn hình đọc ngay (`aria-live-errors`).
      */}
      {loadError ? (
        <Alert role="alert" variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          {/*
            Dùng Radix `Select` y như tab Bộ thẻ (`flashcard-admin-manager.tsx`),
            KHÔNG dùng `NativeSelect`. Hai tab nằm cạnh nhau trên cùng một trang
            nên `<select>` gốc của trình duyệt đứng cạnh Select đã tạo kiểu là
            thấy lệch ngay — user báo đúng 2026-08-05.

            `NativeSelect` để dành cho `<form>` GET không có JavaScript riêng
            (bộ lọc Ngân hàng câu hỏi); ở đây điều hướng bằng `router.push` nên
            không có lý do gì phải dùng nó.
          */}
          <div className="flex min-w-56 flex-1 items-center gap-2">
            <Label htmlFor="video-course" className="sr-only">
              Khóa học
            </Label>
            <Select
              value={selectedCourseId ?? undefined}
              onValueChange={(next) =>
                router.push(`/admin/flashcards?course=${next}`)
              }
            >
              <SelectTrigger id="video-course" className="w-full">
                <SelectValue placeholder="Chọn khóa học để quản trị video" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.code} · {item.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!course ? (
            <p className="text-muted-foreground text-sm">
              Chọn một khóa học để quản lý video bài giảng.
            </p>
          ) : loadError ? (
            /*
              Tải hỏng thì KHÔNG bày "chưa có bộ video nào" kèm nút Tạo — câu đó
              là một lời khẳng định sai (ta không biết khoá có gì), và cái nút
              chắc chắn hỏng nốt vì cùng một nguyên nhân. Bấm vào chỉ nhận thêm
              một thông báo lỗi nữa.
            */
            <p className="text-muted-foreground text-sm">
              Chưa đọc được dữ liệu video của khóa này — xem thông báo phía trên.
            </p>
          ) : !collection ? (
            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Khóa <strong>{course.title}</strong> chưa có bộ video nào.
              </p>
              <Button
                disabled={pending}
                onClick={() =>
                  run(() =>
                    createVideoCollectionAction({
                      courseId: course.id,
                      title: `Video bài giảng — ${course.title}`,
                    }),
                  )
                }
              >
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                Tạo bộ video
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="mr-auto min-w-0">
                <h2 className="truncate font-semibold">{collection.title}</h2>
                <p className="text-muted-foreground text-sm">
                  {collection.items.length}/{course.maxSessionNumber} buổi ·{" "}
                  {collection.status === "published" ? (
                    <span className="font-medium text-success">
                      Đã công bố
                    </span>
                  ) : (
                    <span className="font-medium">Bản nháp</span>
                  )}
                </p>
              </div>

              <VideoImportDialog
                collectionId={collection.id}
                maxSessionNumber={course.maxSessionNumber}
                existingSessionNumbers={collection.items.map(
                  (item) => item.session_number,
                )}
              />

              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={pending || collection.items.length === 0}
                onClick={() =>
                  run(() => refreshVideoTitlesAction({ collectionId: collection.id }))
                }
              >
                <RefreshCw className="size-4" aria-hidden />
                Lấy lại tiêu đề
              </Button>

              <Button
                size="sm"
                variant={collection.status === "published" ? "outline" : "default"}
                className="gap-2"
                disabled={pending || collection.items.length === 0}
                onClick={() =>
                  run(() =>
                    setVideoCollectionStatusAction({
                      collectionId: collection.id,
                      status:
                        collection.status === "published" ? "draft" : "published",
                    }),
                  )
                }
              >
                {collection.status === "published" ? (
                  <>
                    <EyeOff className="size-4" aria-hidden />
                    Gỡ công bố
                  </>
                ) : (
                  <>
                    <Eye className="size-4" aria-hidden />
                    Công bố cho học viên
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {collection && collection.status === "published" ? (
        <Alert>
          <AlertDescription>
            Bộ đang công bố nên <strong>khóa sửa</strong>. Muốn nhập thêm hoặc thay
            link thì bấm <em>Gỡ công bố</em> trước — sửa link dưới chân học viên
            đang học là thay đổi im lặng mà không ai thấy.
          </AlertDescription>
        </Alert>
      ) : null}

      {collection && collection.items.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  Danh sách video theo buổi của {collection.title}
                </caption>
                <thead className="bg-surface-sunken">
                  <tr>
                    <th scope="col" className="px-4 py-2 text-left font-medium">
                      Buổi
                    </th>
                    <th scope="col" className="px-4 py-2 text-left font-medium">
                      Tiêu đề hiển thị cho học viên
                    </th>
                    <th scope="col" className="px-4 py-2 text-left font-medium">
                      Video
                    </th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">
                      <span className="sr-only">Thao tác</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {collection.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="px-4 py-2 font-semibold tabular-nums">
                        {item.session_number}
                      </td>
                      {/*
                        Hiện `displayTitle` — tức ĐÚNG chuỗi học viên sẽ thấy sau
                        khi cắt tiền tố "Buổi N" trùng. Bày tiêu đề thô ở đây thì
                        admin không bao giờ biết học viên thật sự đọc được gì.
                      */}
                      <td className="max-w-0 px-4 py-2">
                        <span className="block truncate" title={item.title}>
                          {item.displayTitle}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <a
                          href={youtubeWatchUrl(item.youtube_video_id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary inline-flex items-center gap-1 font-mono text-xs hover:underline"
                        >
                          <Youtube className="size-3.5" aria-hidden />
                          {item.youtube_video_id}
                          <ExternalLink className="size-3" aria-hidden />
                          <span className="sr-only">(mở ở YouTube, tab mới)</span>
                        </a>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-11 text-destructive"
                          disabled={pending || collection.status === "published"}
                          onClick={() => {
                            if (
                              !window.confirm(
                                `Xóa liên kết video buổi ${item.session_number}? Video vẫn còn trên YouTube.`,
                              )
                            ) {
                              return;
                            }
                            setBusyItemId(item.id);
                            run(() => deleteVideoItemAction({ itemId: item.id }));
                          }}
                        >
                          {busyItemId === item.id && pending ? (
                            <Loader2 className="size-4 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="size-4" aria-hidden />
                          )}
                          <span className="sr-only">
                            Xóa video buổi {item.session_number}
                          </span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
