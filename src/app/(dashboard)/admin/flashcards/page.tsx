import { Layers, Youtube } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlashcardAdminManager } from "@/features/flashcards/components/flashcard-admin-manager";
import {
  getAdminFlashcardDeck,
  getAdminFlashcardDecks,
  getFlashcardCourseOptions,
} from "@/features/flashcards/server/queries";
import { VideoAdminPanel } from "@/features/videos/components/video-admin-panel";
import {
  getAdminVideoData,
  getVideoCourseOptions,
} from "@/features/videos/server/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Flashcard" };

/**
 * Trạng thái "đang xem gì" nằm ở **URL**, không ở state của client
 * (`MULTIDECK-1d`).
 *
 * Lý do là ca dùng thật: admin gửi cho nhau đường dẫn tới đúng một bộ để soát
 * lại, và bấm Back sau khi đổi bộ phải quay về bộ trước. Cả hai đều không làm
 * được nếu lựa chọn chỉ sống trong `useState` (`deep-linking`,
 * `state-preservation`).
 *
 * `session` là ngoại lệ có chủ ý: nó chỉ là **giá trị khởi tạo**. Đổi buổi sau
 * đó không điều hướng — xem ghi chú ở `selectSection` trong trình quản lý.
 */
export default async function AdminFlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string; deck?: string; session?: string }>;
}) {
  await requireRole("super_admin");
  const { course, deck: deckParam, session } = await searchParams;
  const courses = await getFlashcardCourseOptions();
  const selectedCourseId = courses.some((item) => item.id === course)
    ? course!
    : null;

  const decks = selectedCourseId
    ? await getAdminFlashcardDecks(selectedCourseId)
    : [];

  // Mã bộ trong URL không thuộc khoá đang chọn (link cũ, hoặc sửa tay) thì rơi
  // về bộ đầu tiên thay vì màn trống — fail-safe, không fail-closed: đây là
  // lựa chọn hiển thị, không phải phân quyền.
  const selectedDeckId =
    decks.find((item) => item.id === deckParam)?.id ?? decks[0]?.id ?? null;

  const deck = selectedDeckId
    ? await getAdminFlashcardDeck(selectedDeckId)
    : null;
  const initialSectionId =
    deck?.sections.find((item) => item.id === session)?.id ?? null;

  /*
   * Video bài giảng dùng CHUNG tham số `?course=` với tab Bộ thẻ, nên đổi khóa ở
   * tab này rồi chuyển tab kia vẫn đúng khóa đó (`VIDEO-1d`).
   *
   * Bản đầu mỗi khóa một bộ video, nên lấy bộ đầu tiên — nhưng schema đã chừa
   * nhiều bộ, đúng đường `flashcard_decks` đã đi ở `…083`.
   */
  const videoCourses = await getVideoCourseOptions();
  const videoData = selectedCourseId
    ? await getAdminVideoData(selectedCourseId)
    : { collection: null, loadError: null };

  return (
    <>
      <PageHeader
        title="Nội dung khóa học"
        description="Bộ thẻ flashcard và video bài giảng của từng khóa."
      />
      <Tabs defaultValue="decks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="decks" className="gap-2">
            <Layers className="size-4" aria-hidden />
            Bộ thẻ
          </TabsTrigger>
          <TabsTrigger value="videos" className="gap-2">
            <Youtube className="size-4" aria-hidden />
            Video bài giảng
          </TabsTrigger>
        </TabsList>

        <TabsContent value="decks">
          <FlashcardAdminManager
            courses={courses}
            selectedCourseId={selectedCourseId}
            decks={decks}
            deck={deck}
            initialSectionId={initialSectionId}
          />
        </TabsContent>

        <TabsContent value="videos">
          <VideoAdminPanel
            courses={videoCourses}
            selectedCourseId={selectedCourseId}
            collection={videoData.collection}
            loadError={videoData.loadError}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}
