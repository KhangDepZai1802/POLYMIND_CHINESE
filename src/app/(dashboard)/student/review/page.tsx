import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentFlashcardReader } from "@/features/flashcards/components/student-flashcard-reader";
import { getStudentFlashcardDeck } from "@/features/flashcards/server/queries";
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
  const deck = course ? await getStudentFlashcardDeck(course.id) : null;

  return (
    <>
      <PageHeader
        title="Ôn tập"
        description="Ôn từ vựng theo từng buổi và luyện lại các câu bạn từng làm sai."
      />
      <Tabs defaultValue="flashcards" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="min-w-max">
            <TabsTrigger value="flashcards">Flashcard Từ Vựng</TabsTrigger>
            <TabsTrigger value="wrong-answers">Ôn Tập Câu Sai</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="flashcards">
          <StudentFlashcardReader
            deck={deck}
            courseName={course?.title ?? null}
          />
        </TabsContent>
        <TabsContent value="wrong-answers">
          <WrongAnswerReview initialItems={wrongAnswers} />
        </TabsContent>
      </Tabs>
    </>
  );
}
