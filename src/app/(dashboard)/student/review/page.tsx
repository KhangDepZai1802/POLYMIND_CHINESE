import { BrainCircuit, Layers, Youtube } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { ResponsiveTabs } from "@/components/shared/responsive-tabs";
import { TabsContent } from "@/components/ui/tabs";
import { StudentFlashcardDeckPicker } from "@/features/flashcards/components/student-flashcard-deck-picker";
import { StudentFlashcardReader } from "@/features/flashcards/components/student-flashcard-reader";
import {
  getStudentFlashcardDeck,
  getStudentFlashcardDeckOptions,
  getStudentStarredPageIds,
} from "@/features/flashcards/server/queries";
import { getMyEnrollment } from "@/features/student/server/queries";
import { StudentVideoList } from "@/features/videos/components/student-video-list";
import { getStudentVideoCollection } from "@/features/videos/server/queries";
import { WrongAnswerReview } from "@/features/wrong-answer-review/components/wrong-answer-review";
import { getMyWrongAnswerReviews } from "@/features/wrong-answer-review/server/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Ôn tập" };

export default async function StudentReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ deck?: string }>;
}) {
  await requireRole("student");
  const [{ deck: deckParam }, enrollment, wrongAnswers] = await Promise.all([
    searchParams,
    getMyEnrollment(),
    getMyWrongAnswerReviews(),
  ]);
  const course = enrollment?.class.course ?? null;

  const [deckOptions, starredPageIds, videoCollection] = course
    ? await Promise.all([
        getStudentFlashcardDeckOptions(course.id),
        getStudentStarredPageIds(),
        getStudentVideoCollection(course.id),
      ])
    : [[], [], null];

  /**
   * Khoá **một** bộ thì vào thẳng, không bắt bấm qua màn chọn (`MULTIDECK-1f`).
   * Khoá nhiều bộ mà chưa chọn thì `null` — và đó là tín hiệu để hiện màn chọn,
   * không phải lỗi.
   */
  const selectedDeckId =
    deckOptions.find((item) => item.id === deckParam)?.id ??
    (deckOptions.length === 1 ? (deckOptions[0]?.id ?? null) : null);

  const deck = selectedDeckId
    ? await getStudentFlashcardDeck(selectedDeckId)
    : null;

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
      <ResponsiveTabs
        label="Hình thức ôn tập"
        defaultValue="flashcards"
        className="space-y-4"
        navProps={{ "data-review-chrome": "" }}
        items={[
          {
            value: "flashcards",
            label: "Flashcard Từ Vựng",
            icon: <Layers className="size-4" aria-hidden />,
          },
          {
            value: "wrong-answers",
            label: "Ôn Tập Câu Sai",
            icon: <BrainCircuit className="size-4" aria-hidden />,
            badge: (
              <span className="rounded-full border border-current px-1.5 text-sm font-semibold">
                {wrongAnswers.length}
              </span>
            ),
          },
          /*
            Tab thứ ba chỉ hiện khi khoá THẬT SỰ có video đã công bố. Bày một
            tab rỗng ra cho cả lớp bấm vào rồi thấy trống là bắt người ta trả
            giá bằng một cú bấm để biết "không có gì" (`empty-nav-state` chỉ
            đòi giải thích khi đích đến TỒN TẠI mà chưa mở).
          */
          ...(videoCollection && videoCollection.items.length > 0
            ? [
                {
                  value: "videos",
                  label: "Video Bài Giảng",
                  icon: <Youtube className="size-4" aria-hidden />,
                },
              ]
            : []),
        ]}
        listWrapperClassName="border-student-sky-border bg-student-sky-surface rounded-xl border p-1"
        listClassName="bg-transparent p-0"
        triggerClassName="text-student-sky-ink data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
        pickerClassName="border-student-sky-border bg-student-sky-surface text-student-sky-ink"
      >
        <TabsContent value="flashcards">
          {course && deckOptions.length > 1 && !selectedDeckId ? (
            <StudentFlashcardDeckPicker
              decks={deckOptions}
              courseName={course.title}
            />
          ) : (
            <StudentFlashcardReader
              deck={deck}
              courseName={course?.title ?? null}
              starredPageIds={starredPageIds}
              canSwitchDeck={deckOptions.length > 1}
            />
          )}
        </TabsContent>
        <TabsContent value="wrong-answers">
          <WrongAnswerReview initialItems={wrongAnswers} />
        </TabsContent>
        {videoCollection && videoCollection.items.length > 0 ? (
          <TabsContent value="videos">
            <StudentVideoList
              collection={videoCollection}
              courseName={course?.title ?? null}
            />
          </TabsContent>
        ) : null}
      </ResponsiveTabs>
    </>
  );
}
