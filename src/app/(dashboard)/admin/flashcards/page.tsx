import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { FlashcardAdminManager } from "@/features/flashcards/components/flashcard-admin-manager";
import {
  getAdminFlashcardDeck,
  getAdminFlashcardDecks,
  getFlashcardCourseOptions,
} from "@/features/flashcards/server/queries";
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

  return (
    <>
      <PageHeader
        title="Flashcard"
        description="Mỗi khóa học có thể có nhiều bộ thẻ; mỗi bộ chia theo buổi và có dải địa chỉ QR riêng."
      />
      <FlashcardAdminManager
        courses={courses}
        selectedCourseId={selectedCourseId}
        decks={decks}
        deck={deck}
        initialSectionId={initialSectionId}
      />
    </>
  );
}
