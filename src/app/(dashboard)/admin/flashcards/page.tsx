import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { FlashcardAdminManager } from "@/features/flashcards/components/flashcard-admin-manager";
import {
  getAdminFlashcardDeck,
  getFlashcardCourseOptions,
} from "@/features/flashcards/server/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Flashcard" };

export default async function AdminFlashcardsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string }>;
}) {
  await requireRole("super_admin");
  const { course } = await searchParams;
  const courses = await getFlashcardCourseOptions();
  const selectedCourseId = courses.some((item) => item.id === course)
    ? course!
    : null;
  const deck = selectedCourseId
    ? await getAdminFlashcardDeck(selectedCourseId)
    : null;

  return (
    <>
      <PageHeader
        title="Flashcard"
        description="Quản trị ảnh mặt trước, mặt sau và audio theo từng khóa học, từng buổi."
      />
      <FlashcardAdminManager
        courses={courses}
        selectedCourseId={selectedCourseId}
        deck={deck}
      />
    </>
  );
}
