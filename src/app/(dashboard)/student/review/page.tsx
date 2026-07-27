import { BrainCircuit, Layers } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentFlashcardReader } from "@/features/flashcards/components/student-flashcard-reader";
import {
  getStudentFlashcardDeck,
  getStudentStarredPageIds,
} from "@/features/flashcards/server/queries";
import { getMyEnrollment } from "@/features/student/server/queries";
import { WrongAnswerReview } from "@/features/wrong-answer-review/components/wrong-answer-review";
import { getMyWrongAnswerReviews } from "@/features/wrong-answer-review/server/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ôn tập" };

export default async function StudentReviewPage() {
  await requireRole("student");
  const [enrollment, wrongAnswers] = await Promise.all([
    getMyEnrollment(),
    getMyWrongAnswerReviews(),
  ]);
  const course = enrollment?.class.course ?? null;
  const [deck, starredPageIds] = course
    ? await Promise.all([
        getStudentFlashcardDeck(course.id),
        getStudentStarredPageIds(),
      ])
    : [null, []];

  return (
    /*
     * `data-review-chrome` là mỏ neo cho chế độ ÔN THẺ TOÀN MÀN HÌNH.
     *
     * Khi học viên đang ôn flashcard, `student-flashcard-reader.tsx` đặt
     * `data-flashcard-focus` lên `<html>` và `globals.css` ẩn hai khối này. Chỉ
     * phủ đè bằng `fixed` là không đủ: tiêu đề và hai tab vẫn nằm trong thứ tự
     * Tab và trình đọc màn hình vẫn đọc, tức "toàn màn hình" chỉ đúng với người
     * sáng mắt. Bấm ✕ trong khung là chúng trở lại ngay.
     */
    <>
      <div data-review-chrome>
        <PageHeader
          title="Ôn tập"
          description="Ôn từ vựng theo từng buổi và luyện lại các câu bạn từng làm sai."
        />
      </div>
      <Tabs defaultValue="flashcards" className="space-y-4">
        <nav
          aria-label="Hình thức ôn tập"
          tabIndex={0}
          data-review-chrome
          className="border-student-sky-border bg-student-sky-surface focus-visible:ring-ring overflow-x-auto rounded-xl border p-1 focus-visible:ring-2 focus-visible:outline-none"
        >
          <TabsList className="min-w-max bg-transparent p-0">
            <TabsTrigger
              value="flashcards"
              className="text-student-sky-ink data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <Layers className="size-4" aria-hidden />
              Flashcard Từ Vựng
            </TabsTrigger>
            <TabsTrigger
              value="wrong-answers"
              className="text-student-sky-ink data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
            >
              <BrainCircuit className="size-4" aria-hidden />
              Ôn Tập Câu Sai
              <span className="rounded-full border border-current px-1.5 text-sm font-semibold">
                {wrongAnswers.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </nav>
        <TabsContent value="flashcards">
          <StudentFlashcardReader
            deck={deck}
            courseName={course?.title ?? null}
            starredPageIds={starredPageIds}
          />
        </TabsContent>
        <TabsContent value="wrong-answers">
          <WrongAnswerReview initialItems={wrongAnswers} />
        </TabsContent>
      </Tabs>
    </>
  );
}
