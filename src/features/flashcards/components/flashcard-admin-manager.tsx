"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronDown,
  ImagePlus,
  Layers,
  ListPlus,
  Loader2,
  PanelLeft,
  Pencil,
  Plus,
  QrCode,
  Send,
  Trash2,
  TriangleAlert,
  Undo2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { useConfirmation } from "@/components/shared/confirmation-provider";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { useNavProgress } from "@/components/shared/use-nav-progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  FlashcardFaceCard,
  type Face,
} from "@/features/flashcards/components/flashcard-face";
import { compressFlashcardImage } from "@/features/flashcards/client/compress-image";
import { FlashcardImportDialog } from "@/features/flashcards/components/flashcard-import-dialog";
import { FlashcardDeckDialog } from "@/features/flashcards/components/flashcard-deck-dialog";
import { FlashcardBulkPublishActions } from "@/features/flashcards/components/flashcard-bulk-publish";
import { FlashcardDeckCoverDialog } from "@/features/flashcards/components/flashcard-deck-cover-dialog";
import { FlashcardDeckPublicLinks } from "@/features/flashcards/components/flashcard-deck-public-links";
import { FlashcardNavRail } from "@/features/flashcards/components/flashcard-nav-rail";
import { FlashcardPublicLinkPanel } from "@/features/flashcards/components/flashcard-public-link-panel";
import { flashcardImportKey } from "@/features/flashcards/domain/bulk-import";
import { flashcardDeckCodeSlug } from "@/features/flashcards/domain/public-link";
import {
  VocabularySublistEditor,
  type SublistDraft,
} from "@/features/flashcards/components/vocabulary-sublist-editor";
import {
  exampleMediaSlot,
  FLASHCARD_MEDIA_BUCKET,
  FLASHCARD_MEDIA_CACHE_CONTROL,
  MAX_FLASHCARD_EXAMPLE_SENTENCES,
  MAX_FLASHCARD_PHRASE_ITEMS,
  type FlashcardMediaSlot,
} from "@/features/flashcards/domain/media";
import { readFlashcardSublists } from "@/features/flashcards/domain/sublists";
import {
  archiveFlashcardDeckSectionsAction,
  archiveFlashcardPageAction,
  archiveFlashcardSectionPagesAction,
  createFlashcardSectionsAction,
  createFlashcardUploadTicketsAction,
  discardFlashcardUploadsAction,
  moveFlashcardPageAction,
  publishFlashcardSectionAction,
  saveFlashcardPageAction,
  saveFlashcardSectionAction,
  unpublishFlashcardSectionAction,
} from "@/features/flashcards/server/actions";
import type {
  FlashcardCourseOption,
  FlashcardDeckSummary,
  FlashcardDeckView,
  FlashcardPageView,
  FlashcardSectionView,
} from "@/features/flashcards/server/queries";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/client";

/**
 * Gợi ý mã cho bộ MỚI: slug của mã khoá, và nếu đã có bộ mang mã đó thì thêm
 * hậu tố số cho tới khi trống.
 *
 * Chỉ là **gợi ý** — người dùng sửa được, và chốt chặn thật là unique index ở
 * DB. Nhưng gợi ý phải đúng ngay từ đầu vì nó là thứ 9/10 lần được giữ nguyên.
 */
function suggestDeckCode(
  courseCode: string,
  decks: FlashcardDeckSummary[],
): string {
  const base = flashcardDeckCodeSlug(courseCode) || "bo-the";
  const taken = new Set(decks.map((deck) => deck.code));
  if (!taken.has(base)) return base;
  for (let index = 2; index < 100; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

/**
 * Màn quản trị flashcard — bố cục **hai cột** từ `MULTIDECK-1e`.
 *
 * 🔴 Vì sao dựng lại thay vì chỉ gấp bảng QR lại: bản cũ xếp mọi thứ thành MỘT
 * cột dọc, theo thứ tự `chọn khoá → bảng 35 địa chỉ QR → dải 35 nút buổi → khu
 * soạn thẻ`. Hai khối ở giữa đẩy khu soạn thẻ — việc làm hằng ngày — xuống dưới
 * màn hình đầu tiên, trong khi bảng QR chỉ dùng mỗi kỳ in. Cộng thêm tầng "bộ
 * thẻ" mới thì một cột không còn chứa nổi.
 *
 * Bố cục mới theo `content-priority` và `adaptive-navigation`:
 *   • **cột trái** giữ điều hướng (bộ thẻ + mục lục buổi), cuộn riêng, dính màn;
 *   • **cột phải** chỉ có khu soạn thẻ, luôn ở đầu màn hình;
 *   • **bảng QR** vào ngăn kéo, mở bằng nút ở thanh trên;
 *   • **dưới 1024px** cột trái thành ngăn kéo — không nhân đôi thành bản thẻ
 *     riêng (`D-31` điểm 2 cấm nhân đôi giao diện theo kích thước màn).
 */
export function FlashcardAdminManager({
  courses,
  selectedCourseId,
  decks,
  deck,
  initialSectionId,
}: {
  courses: FlashcardCourseOption[];
  selectedCourseId: string | null;
  decks: FlashcardDeckSummary[];
  deck: FlashcardDeckView | null;
  initialSectionId: string | null;
}) {
  const { navigate, isPending: isNavigating } = useNavProgress();
  const selectedCourse = courses.find(
    (course) => course.id === selectedCourseId,
  );

  const [selectedSectionId, setSelectedSectionId] = useState(
    initialSectionId ?? deck?.sections[0]?.id ?? null,
  );
  const [navOpen, setNavOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deckDialog, setDeckDialog] = useState<
    { mode: "create" } | { mode: "edit"; deck: FlashcardDeckSummary } | null
  >(null);

  const section =
    deck?.sections.find((item) => item.id === selectedSectionId) ??
    deck?.sections[0] ??
    null;
  const deckSummary = decks.find((item) => item.id === deck?.id) ?? null;
  const nextSession = selectedCourse?.defaultSessionCount
    ? (Array.from(
        { length: selectedCourse.defaultSessionCount },
        (_, index) => index + 1,
      ).find(
        (sessionNumber) =>
          !deck?.sections.some((item) => item.session_number === sessionNumber),
      ) ?? null)
    : null;

  /*
   * Đi qua `useNavProgress` chứ không `router.push` trần: `router.push` không
   * phát `navstart` nên thanh tiến trình ở đỉnh màn cũng đứng im, mà đổi khoá /
   * đổi bộ là một vòng máy chủ thật (đo được ~443ms ở `PERF-NAV-1`). Cùng một
   * khuôn với `class-picker.tsx`.
   */
  function goToCourse(courseId: string) {
    setSelectedSectionId(null);
    navigate(`/admin/flashcards?course=${courseId}`);
  }

  function goToDeck(deckId: string) {
    if (!selectedCourseId) return;
    setSelectedSectionId(null);
    setNavOpen(false);
    navigate(`/admin/flashcards?course=${selectedCourseId}&deck=${deckId}`);
  }

  /**
   * Chọn buổi giữ ở state cục bộ, KHÔNG đi qua `router.push`.
   *
   * Dữ liệu của mọi buổi trong bộ đã nằm sẵn ở client, nên đổi buổi bằng điều
   * hướng chỉ tổ trả thêm một vòng máy chủ cho thứ đã có trong tay — đúng loại
   * chi phí mà `PERF-NAV-1` vừa đo được là ~443ms/lượt. Địa chỉ vẫn được cập
   * nhật bằng `history.replaceState` để chia sẻ link và F5 không mất chỗ đang
   * đứng (`state-preservation`), nhưng nó không kích hoạt render lại ở máy chủ.
   */
  /*
    Đếm buổi theo trạng thái để hai nút hàng loạt nói trước sẽ đụng bao nhiêu.
    `archived_at` không lọt vào `deck.sections` nên không phải trừ ở đây.
  */
  const draftSectionCount =
    deck?.sections.filter((item) => item.status !== "published").length ?? 0;
  const publishedSectionCount =
    deck?.sections.filter((item) => item.status === "published").length ?? 0;

  /**
   * Nhảy tới một buổi theo SỐ BUỔI — lối thoát của hộp thoại kết quả công bố
   * hàng loạt. Buổi hỏng liệt kê theo số, còn `selectSection` cần id.
   */
  function jumpToSessionNumber(sessionNumber: number) {
    const target = deck?.sections.find(
      (item) => item.session_number === sessionNumber,
    );
    if (target) selectSection(target.id);
  }

  function selectSection(sectionId: string) {
    setSelectedSectionId(sectionId);
    setNavOpen(false);
    if (typeof window === "undefined" || !selectedCourseId || !deck) return;
    const url = new URL(window.location.href);
    url.searchParams.set("course", selectedCourseId);
    url.searchParams.set("deck", deck.id);
    url.searchParams.set("session", sectionId);
    window.history.replaceState(null, "", url);
  }

  const rail = deck ? (
    <FlashcardNavRail
      decks={decks}
      selectedDeckId={deck.id}
      sections={deck.sections}
      selectedSectionId={section?.id ?? null}
      onSelectDeck={goToDeck}
      onSelectSection={selectSection}
      onCreateDeck={() => {
        setNavOpen(false);
        setDeckDialog({ mode: "create" });
      }}
    />
  ) : null;

  return (
    <div className="space-y-4">
      {/*
        Thanh trên gom đúng ba thứ ở cấp KHOÁ HỌC: đang ở khoá nào, mở mục lục
        (dưới 1024px), và mở bảng địa chỉ QR. Không nhét hành động cấp buổi vào
        đây — chúng thuộc về khu soạn thẻ, nơi người dùng đang nhìn.
      */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-3">
          <div className="flex min-w-56 flex-1 items-center gap-2">
            <Label htmlFor="flashcard-course" className="sr-only">
              Khóa học
            </Label>
            <Select
              value={selectedCourseId ?? undefined}
              disabled={isNavigating}
              onValueChange={goToCourse}
            >
              <SelectTrigger id="flashcard-course" className="w-full">
                <SelectValue placeholder="Chọn khóa học để quản trị flashcard" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.code} · {course.title}
                    {course.deckCount > 0 ? ` · ${course.deckCount} bộ` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCourse && (
            <StatusBadge
              label={
                selectedCourse.defaultSessionCount
                  ? `${selectedCourse.defaultSessionCount} buổi`
                  : "Chưa chốt số buổi"
              }
              tone={selectedCourse.defaultSessionCount ? "info" : "warning"}
            />
          )}

          {deck && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="lg:hidden"
                onClick={() => setNavOpen(true)}
              >
                <PanelLeft className="size-4" aria-hidden />
                Mục lục
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setQrOpen(true)}
              >
                <QrCode className="size-4" aria-hidden />
                Địa chỉ QR
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {!selectedCourse ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={BookOpen}
              title="Chọn một khóa học"
              description="Mỗi khóa có thể có nhiều bộ flashcard, mỗi bộ chia mục lục theo từng buổi."
            />
          </CardContent>
        </Card>
      ) : !selectedCourse.defaultSessionCount ? (
        <Alert>
          <AlertDescription>
            Khóa học này chưa có số buổi mặc định. Hãy cập nhật khóa học trước
            khi tạo nội dung flashcard.
          </AlertDescription>
        </Alert>
      ) : !deck ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Layers}
              title="Khoá này chưa có bộ flashcard"
              description="Tạo bộ đầu tiên, đặt mã bộ rồi thêm các buổi. Mỗi bộ có dải địa chỉ QR riêng."
              action={
                <Button
                  type="button"
                  onClick={() => setDeckDialog({ mode: "create" })}
                >
                  <Plus className="size-4" aria-hidden />
                  Tạo bộ flashcard
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
          {/*
            Cột trái DÍNH và cuộn riêng: tìm buổi 27 không được kéo khu soạn thẻ
            đi mất. `max-h` trừ đi chiều cao thanh trên để cột không tràn ra
            ngoài khung nhìn (`fixed-element-offset`).

            `overflow-y-auto` ở đây là VAN AN TOÀN, không phải vùng cuộn chính:
            bình thường mục lục buổi tự co và cuộn bên trong nên cột này không
            bao giờ cần cuộn. Nó chỉ mở ra khi các phần KHÔNG co được (danh sách
            bộ thẻ + sàn 16rem của mục lục) vượt quá chiều cao cột — thà cuộn
            thêm một tầng còn hơn để nội dung tràn ra ngoài khung thẻ.
          */}
          <aside className="bg-card sticky top-4 hidden max-h-[calc(100dvh-7rem)] overflow-y-auto rounded-xl border p-3 lg:flex lg:flex-col">
            {rail}
          </aside>

          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                {/*
                  Nút "Sửa bộ" đứng NGOÀI `<h2>`: nhét nút vào trong tiêu đề thì
                  tên trợ năng của tiêu đề thành "… vcb-bank Sửa bộ" — trình đọc
                  màn hình đọc một câu lẫn lộn giữa tên bộ và một hành động.
                */}
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                    {deck.title}
                    <code className="text-text-secondary bg-surface-sunken rounded px-1.5 py-0.5 font-mono text-xs">
                      {deck.code}
                    </code>
                  </h2>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    disabled={!deckSummary}
                    onClick={() =>
                      deckSummary &&
                      setDeckDialog({ mode: "edit", deck: deckSummary })
                    }
                  >
                    <Pencil className="size-4" aria-hidden />
                    Sửa bộ
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm">
                  {deck.description || "Chưa có mô tả."}
                </p>
              </div>
              {/*
                HÀNG NÚT CẤP BỘ — mọi thứ ở đây tác động tới cả bộ thẻ, không
                phải tới buổi đang mở.

                MỘT hành động chính mỗi vùng (`primary-action`): "Thêm buổi" là
                nút mặc định, hai nút còn lại ở dạng viền. "Ảnh mở đầu hàng loạt"
                đứng ở ĐÂY chứ không ở thanh chọn khoá học (trộn hai tầng) và
                không ở cột trái (vùng điều hướng thuần) — `D-41` điểm 5. Hành
                động PHÁ HUỶ không nằm ở đây: chúng ở "Vùng nguy hiểm" cuối trang
                (`destructive-nav-separation`).

                Nút ảnh mở đầu hiện cả khi bộ đã đủ số buổi — nó không tạo buổi,
                nó chỉ gắn ảnh cho buổi đã có; gói nó vào nhánh `nextSession` thì
                đúng bộ đã soạn xong 35 buổi lại là bộ mất nút.
              */}
              {/*
                HAI CỤM, cách nhau bằng khoảng trống rộng gấp bốn (`gap-x-6` vs
                `gap-2`) chứ không thêm vạch ngăn: mắt tự đọc ra "tạo buổi" và
                "thao tác cả bộ" là hai nhóm khác nhau — Gestalt proximity, đỡ
                được một phần tử trang trí.

                Dưới `sm` cả hàng này ẩn đi, nhường cho nút "Thao tác hàng loạt"
                mở bảng trượt: năm nút xếp dọc chiếm ~220px trước khi thấy nội
                dung, đúng thứ `UX-MOBILE-1` vừa dọn khỏi repo.
              */}
              <div className="hidden flex-wrap items-center gap-x-6 gap-y-2 sm:flex">
                <div className="flex flex-wrap items-center gap-2">
                  {nextSession ? (
                    <>
                      <SectionDialog
                        deckId={deck.id}
                        maxSessions={selectedCourse.defaultSessionCount}
                        nextSession={nextSession}
                      />
                      <SectionRangeDialog
                        deckId={deck.id}
                        maxSessions={selectedCourse.defaultSessionCount}
                        nextSession={nextSession}
                      />
                    </>
                  ) : (
                    <StatusBadge label="Đã đủ số buổi" tone="success" />
                  )}
                </div>

                {deck.sections.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <FlashcardDeckCoverDialog deck={deck} />
                    <FlashcardBulkPublishActions
                      deckId={deck.id}
                      draftCount={draftSectionCount}
                      publishedCount={publishedSectionCount}
                      onJumpToSession={jumpToSessionNumber}
                    />
                  </div>
                )}
              </div>

              {deck.sections.length > 0 && (
                <Sheet open={bulkOpen} onOpenChange={setBulkOpen}>
                  <SheetTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 w-full justify-between sm:hidden"
                    >
                      Thao tác hàng loạt
                      <ChevronDown className="size-4" aria-hidden />
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="bottom"
                    className="max-h-[80dvh] gap-0 rounded-t-2xl"
                  >
                    <SheetHeader>
                      <SheetTitle>Thao tác hàng loạt</SheetTitle>
                      <SheetDescription>
                        Áp dụng cho tất cả các buổi trong bộ {deck.title}.
                      </SheetDescription>
                    </SheetHeader>
                    {/*
                      Hai nhóm có tiêu đề: thao tác đổi thứ HỌC VIÊN NHÌN THẤY
                      không được lẫn với thao tác soạn bài.
                    */}
                    <div className="grid gap-2 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                      <p className="text-muted-foreground pt-1 text-xs font-semibold tracking-wide uppercase">
                        Tạo nội dung
                      </p>
                      {nextSession && (
                        <SectionRangeDialog
                          deckId={deck.id}
                          maxSessions={selectedCourse.defaultSessionCount}
                          nextSession={nextSession}
                        />
                      )}
                      <FlashcardDeckCoverDialog deck={deck} />

                      <p className="text-muted-foreground pt-2 text-xs font-semibold tracking-wide uppercase">
                        Hiển thị với học viên
                      </p>
                      <FlashcardBulkPublishActions
                        deckId={deck.id}
                        draftCount={draftSectionCount}
                        publishedCount={publishedSectionCount}
                        onJumpToSession={(sessionNumber) => {
                          setBulkOpen(false);
                          jumpToSessionNumber(sessionNumber);
                        }}
                        layout="stack"
                      />
                    </div>
                  </SheetContent>
                </Sheet>
              )}
            </div>

            {deck.sections.length === 0 ? (
              <Card>
                <CardContent className="p-0">
                  <EmptyState
                    icon={BookOpen}
                    title="Chưa có buổi flashcard"
                    description="Thêm Buổi 1, sau đó tạo trang mở đầu và các trang từ vựng."
                  />
                </CardContent>
              </Card>
            ) : (
              section && (
                <>
                  <SectionWorkspace
                    deck={deck}
                    section={section}
                    maxSessions={selectedCourse.defaultSessionCount}
                  />
                  <FlashcardDangerZone deck={deck} section={section} />
                </>
              )
            )}
          </div>
        </div>
      )}

      {/* Cột trái ở dạng ngăn kéo cho màn dưới 1024px — cùng một component. */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-76 sm:max-w-none">
          <SheetHeader>
            <SheetTitle>Mục lục</SheetTitle>
            <SheetDescription>
              Chọn bộ thẻ và buổi cần soạn.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{rail}</div>
        </SheetContent>
      </Sheet>

      {/*
        Ngăn kéo địa chỉ QR — rộng hơn mặc định vì mỗi dòng mang một URL đầy đủ.
        Đặt ở đây chứ không giữa trang: xem `FlashcardDeckPublicLinks`.
      */}
      <Sheet open={qrOpen} onOpenChange={setQrOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-2xl"
          aria-describedby={undefined}
        >
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <QrCode className="size-4" aria-hidden />
              Địa chỉ QR — {deck?.title}
            </SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {deck && (
              <FlashcardDeckPublicLinks deck={deck} deckCode={deck.code} />
            )}
          </div>
        </SheetContent>
      </Sheet>

      {selectedCourse && deckDialog && (
        <FlashcardDeckDialog
          // Đổi bộ đang sửa ⇒ dựng lại hộp thoại, để ô mã bắt đầu từ mã của bộ
          // đó thay vì giữ giá trị của lần mở trước.
          key={deckDialog.mode === "edit" ? deckDialog.deck.id : "new"}
          open
          onOpenChange={(next) => {
            if (!next) setDeckDialog(null);
          }}
          course={selectedCourse}
          deck={deckDialog.mode === "edit" ? deckDialog.deck : undefined}
          suggestedCode={suggestDeckCode(selectedCourse.code, decks)}
        />
      )}
    </div>
  );
}

function SectionDialog({
  deckId,
  maxSessions,
  nextSession,
  section,
}: {
  deckId: string;
  maxSessions: number;
  nextSession: number;
  section?: FlashcardSectionView;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({});
  const sessionNumber = section?.session_number ?? nextSession;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={section ? "outline" : "default"}>
          {section ? (
            <Pencil className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          {section ? "Sửa tên buổi" : "Thêm buổi"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {section ? "Cập nhật buổi" : "Thêm buổi flashcard"}
          </DialogTitle>
          <DialogDescription>
            Số buổi nằm trong khoảng 1–{maxSessions} theo cấu hình khóa học.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await saveFlashcardSectionAction(data);
              setState(result);
              if (result.success) {
                toast.success(result.success);
                setOpen(false);
                router.refresh();
              }
            });
          }}
        >
          <input type="hidden" name="deck_id" value={deckId} />
          {section && <input type="hidden" name="id" value={section.id} />}
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor={`session-number-${section?.id ?? "new"}`}>
              Số buổi *
            </Label>
            <Input
              id={`session-number-${section?.id ?? "new"}`}
              name="session_number"
              type="number"
              min={1}
              max={maxSessions}
              defaultValue={sessionNumber}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`session-title-${section?.id ?? "new"}`}>
              Tên buổi *
            </Label>
            <Input
              id={`session-title-${section?.id ?? "new"}`}
              name="title"
              defaultValue={section?.title ?? `Buổi ${sessionNumber}`}
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Lưu buổi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Tạo NHIỀU buổi trong một lượt: nhập "từ buổi X đến buổi Y". */
function SectionRangeDialog({
  deckId,
  maxSessions,
  nextSession,
}: {
  deckId: string;
  maxSessions: number;
  nextSession: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({});

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setState({});
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <ListPlus className="size-4" aria-hidden />
          Tạo nhiều buổi
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo nhiều buổi cùng lúc</DialogTitle>
          <DialogDescription>
            Tạo liền một dải buổi, ví dụ từ buổi {nextSession} đến buổi{" "}
            {maxSessions}. Buổi nào đã có sẵn sẽ được giữ nguyên, không tạo
            trùng.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await createFlashcardSectionsAction(data);
              setState(result);
              if (result.success) {
                toast.success(result.success);
                setOpen(false);
                router.refresh();
              }
            });
          }}
        >
          <input type="hidden" name="deck_id" value={deckId} />
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="range-from">Từ buổi *</Label>
              <Input
                id="range-from"
                name="from_session"
                type="number"
                min={1}
                max={maxSessions}
                defaultValue={nextSession}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="range-to">Đến buổi *</Label>
              <Input
                id="range-to"
                name="to_session"
                type="number"
                min={1}
                max={maxSessions}
                defaultValue={maxSessions}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Tạo các buổi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * VÙNG NGUY HIỂM — hai hành động phá huỷ, đặt TÁCH khỏi cụm nút thường.
 *
 * Luật áp dụng (`ui-ux-pro-max`): `destructive-nav-separation` (hành động nguy
 * hiểm phải tách cả về THỊ GIÁC lẫn VỊ TRÍ khỏi nút thường), `primary-action`
 * (mỗi vùng chỉ một CTA chính — ở khu trên là "Công bố buổi"), và
 * `confirmation-dialogs`. Đặt "Xoá tất cả trang" cạnh "Thêm trang" là công thức
 * để một cú bấm nhầm xoá sạch buổi vừa soạn.
 *
 * User chốt (`D-35` điểm 4): chỉ cần hộp thoại xác nhận thường với nút Xoá màu
 * destructive — KHÔNG bắt gõ lại tên.
 */
function FlashcardDangerZone({
  deck,
  section,
}: {
  deck: FlashcardDeckView;
  section: FlashcardSectionView;
}) {
  const draftSections = deck.sections.filter(
    (item) => item.status === "draft",
  ).length;
  const publishedSections = deck.sections.length - draftSections;
  const canClearPages =
    section.status === "draft" && section.pages.length > 0;

  if (!canClearPages && draftSections === 0) return null;

  return (
    <section
      aria-labelledby="flashcard-danger-zone"
      className="border-destructive/40 bg-destructive/5 rounded-lg border p-4"
    >
      {/*
        `text-danger-ink` (#b91c1c) chứ KHÔNG phải `text-destructive` (#dc2626):
        trên nền `bg-destructive/5` (trộn ra #f5edf0) thì #dc2626 chỉ được
        **4.19:1**, hụt AA — axe bắt đúng chỗ này. `--danger-ink` là token đã
        được tạo sẵn ở `DS-030` cho đúng tình huống "chữ đỏ trên nền đỏ nhạt";
        đo lại trên nền này được **5.62:1**. Nút bên dưới vẫn dùng
        `text-destructive` vì nền của chúng là `bg-background` trắng (4.83:1).
      */}
      <h3
        id="flashcard-danger-zone"
        className="text-danger-ink flex items-center gap-2 text-sm font-semibold"
      >
        <TriangleAlert className="size-4" aria-hidden />
        Vùng nguy hiểm
      </h3>
      <p className="text-muted-foreground mt-1 text-sm">
        Các thao tác dưới đây xoá hàng loạt và không tự hoàn tác được. Buổi đã
        công bố luôn được giữ lại — muốn xoá thì đưa về nháp trước.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {canClearPages && (
          <DangerAction
            label={`Xoá tất cả trang trong buổi ${section.session_number}`}
            title={`Xoá tất cả ${section.pages.length} trang của buổi ${section.session_number}?`}
            description={`Toàn bộ trang mở đầu và thẻ từ vựng của "${section.title}" sẽ bị xoá, kèm ảnh và audio đã tải lên. Buổi vẫn còn, nhưng trống.`}
            fields={{ id: section.id }}
            action={archiveFlashcardSectionPagesAction}
          />
        )}
        {draftSections > 0 && (
          <DangerAction
            label="Xoá tất cả buổi của bộ thẻ"
            title={`Xoá ${draftSections} buổi nháp của "${deck.title}"?`}
            description={
              publishedSections > 0
                ? `Mọi buổi đang nháp cùng toàn bộ trang bên trong sẽ bị xoá. ${publishedSections} buổi đã công bố được giữ nguyên.`
                : "Mọi buổi cùng toàn bộ trang bên trong sẽ bị xoá. Số buổi được giải phóng nên bạn tạo lại từ đầu được."
            }
            fields={{ deck_id: deck.id }}
            action={archiveFlashcardDeckSectionsAction}
          />
        )}
      </div>
    </section>
  );
}

function DangerAction({
  label,
  title,
  description,
  fields,
  action,
}: {
  label: string;
  title: string;
  description: string;
  fields: Record<string, string>;
  action: (data: FormData) => Promise<ActionState>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      {/*
        `alert-dialog.tsx` cố ý KHÔNG export `AlertDialogTrigger` — nút mở do
        chính component client này dựng và điều khiển bằng state (`DS-051`).
      */}
      <Button
        type="button"
        variant="outline"
        className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2 className="size-4" aria-hidden />
        {label}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-destructive hover:bg-destructive/90 text-white"
              onClick={(event) => {
                event.preventDefault();
                const data = new FormData();
                for (const [key, value] of Object.entries(fields)) {
                  data.set(key, value);
                }
                startTransition(async () => {
                  const result = await action(data);
                  if (result.error) toast.error(result.error);
                  if (result.success) toast.success(result.success);
                  setOpen(false);
                  router.refresh();
                });
              }}
            >
              {pending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function SectionWorkspace({
  deck,
  section,
  maxSessions,
}: {
  deck: FlashcardDeckView;
  section: FlashcardSectionView;
  maxSessions: number;
}) {
  const router = useRouter();
  const confirm = useConfirmation();
  const [pending, startTransition] = useTransition();

  /**
   * Khoá của thẻ đã có trong buổi, để ô "Nhập hàng loạt" báo trước dòng nào sẽ
   * bị bỏ qua. Chỗ chặn thật vẫn là unique index ở DB (`BUG_M09_01`) — danh sách
   * này chỉ để nói trước, nên có cũ đi cũng không sinh thẻ trùng.
   */
  const existingVocabKeys = useMemo(
    () =>
      new Set(
        section.pages
          .filter((page) => page.kind === "vocabulary")
          .map((page) =>
            flashcardImportKey(page.hanzi ?? "", page.pinyin_syllables ?? ""),
          ),
      ),
    [section.pages],
  );

  function run(action: (data: FormData) => Promise<ActionState>) {
    const data = new FormData();
    data.set("id", section.id);
    startTransition(async () => {
      const result = await action(data);
      if (result.error) toast.error(result.error);
      if (result.success) toast.success(result.success);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="flex flex-wrap items-center gap-2 text-base">
            Buổi {section.session_number} · {section.title}
            <StatusBadge
              label={section.status === "published" ? "Đã công bố" : "Bản nháp"}
              tone={section.status === "published" ? "success" : "warning"}
            />
          </CardTitle>
          <p className="text-muted-foreground mt-1 text-sm">
            {section.pages.length} trang · trang mở đầu luôn ở vị trí đầu tiên.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SectionDialog
            deckId={deck.id}
            maxSessions={maxSessions}
            nextSession={section.session_number}
            section={section}
          />
          {section.status === "draft" && (
            <>
              <PageDialog deckId={deck.id} section={section} />
              <FlashcardImportDialog
                deckId={deck.id}
                section={section}
                existingKeys={existingVocabKeys}
              />
            </>
          )}
          <Button
            type="button"
            variant={section.status === "published" ? "outline" : "default"}
            disabled={pending}
            onClick={async () => {
              if (section.status !== "published") {
                run(publishFlashcardSectionAction);
                return;
              }
              // Đưa về nháp sẽ CẮT luôn liên kết công khai — hành vi DB đúng
              // (fail-closed), nhưng người bấm phải biết hậu quả vật lý: mã QR
              // đã in trong sách sẽ chết.
              if (section.publicLink) {
                const ok = await confirm({
                  title: "Buổi này đang có liên kết công khai",
                  description:
                    "Đưa về nháp sẽ làm mã QR đã in trong sách NGỪNG hoạt động " +
                    "ngay lập tức. Công bố lại thì mã cũ hoạt động trở lại.",
                  confirmLabel: "Vẫn đưa về nháp",
                  variant: "destructive",
                });
                if (!ok) return;
              }
              run(unpublishFlashcardSectionAction);
            }}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : section.status === "published" ? (
              <Undo2 className="size-4" aria-hidden />
            ) : (
              <Send className="size-4" aria-hidden />
            )}
            {section.status === "published" ? "Đưa về nháp" : "Công bố buổi"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {section.pages.length === 0 ? (
          <EmptyState
            icon={ImagePlus}
            title="Buổi này chưa có trang"
            description="Tạo trang mở đầu trước, sau đó thêm các trang từ vựng."
          />
        ) : (
          <div className="space-y-3">
            {section.pages.map((page, index) => (
              <FlashcardPageRow
                key={page.id}
                deckId={deck.id}
                section={section}
                page={page}
                index={index}
                total={section.pages.length}
              />
            ))}
          </div>
        )}
        <FlashcardPublicLinkPanel section={section} />
      </CardContent>
    </Card>
  );
}

function FlashcardPageRow({
  deckId,
  section,
  page,
  index,
  total,
}: {
  deckId: string;
  section: FlashcardSectionView;
  page: FlashcardPageView;
  index: number;
  total: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const isCover = page.kind === "session_cover";
  const pageLabel = isCover ? "trang mở đầu" : (page.hanzi ?? "trang từ vựng");
  const sublists = readFlashcardSublists(page);
  // Còn trang mở đầu thì vị trí 0 bị khóa; đã lưu trữ thì từ vựng được đứng đầu.
  const minIndex = section.pages.some((item) => item.kind === "session_cover")
    ? 1
    : 0;

  function mutate(
    action: (data: FormData) => Promise<ActionState>,
    extra?: Record<string, string>,
  ) {
    const data = new FormData();
    data.set("id", page.id);
    for (const [key, value] of Object.entries(extra ?? {}))
      data.set(key, value);
    startTransition(async () => {
      const result = await action(data);
      if (result.error) toast.error(result.error);
      if (result.success) toast.success(result.success);
      router.refresh();
    });
  }

  return (
    <article className="grid gap-3 rounded-lg border p-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center">
      <div className="bg-muted flex size-11 items-center justify-center rounded-md font-semibold tabular-nums">
        {index + 1}
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
        <FlashcardFacePreviewPair page={page} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">
              {isCover ? "Trang mở đầu" : page.hanzi}
            </p>
            <StatusBadge
              label={isCover ? "Mục lục" : "Từ vựng"}
              tone={isCover ? "info" : "neutral"}
            />
            {/*
              Thẻ nhập hàng loạt chưa có audio. Nói ngay ở đây thay vì để admin
              chỉ biết lúc bấm Công bố rồi bị từ chối.
            */}
            {!isCover && !page.audio_path && (
              <StatusBadge label="Thiếu audio" tone="warning" />
            )}
          </div>
          {!isCover && (
            <>
              <p className="text-muted-foreground text-sm">
                {page.pinyin_syllables} · {page.meaning_vi}
              </p>
              <p className="text-muted-foreground text-sm">
                Câu ví dụ {sublists.examples.length} · Cụm từ{" "}
                {sublists.phrases.length}
              </p>
            </>
          )}
          {page.audioUrl ? (
            <audio controls preload="none" className="mt-2 h-9 w-full max-w-sm">
              <source src={page.audioUrl} />
            </audio>
          ) : page.audio_path ? (
            <p className="text-destructive mt-2 text-xs">
              Không ký được audio.
            </p>
          ) : null}
        </div>
      </div>
      {section.status === "draft" && (
        <div className="flex flex-wrap items-center justify-end gap-1">
          {!isCover && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                disabled={pending || index <= minIndex}
                aria-label={`Đưa ${pageLabel} lên`}
                onClick={() =>
                  mutate(moveFlashcardPageAction, { direction: "up" })
                }
              >
                <ArrowUp className="size-4" aria-hidden />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                disabled={pending || index >= total - 1}
                aria-label={`Đưa ${pageLabel} xuống`}
                onClick={() =>
                  mutate(moveFlashcardPageAction, { direction: "down" })
                }
              >
                <ArrowDown className="size-4" aria-hidden />
              </Button>
            </>
          )}
          <PageDialog deckId={deckId} section={section} page={page} />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive size-11"
            disabled={pending}
            aria-label={`Lưu trữ ${pageLabel}`}
            onClick={() => {
              const confirmText = isCover
                ? "Lưu trữ trang mở đầu? Buổi sẽ không công bố được cho tới khi thêm trang mở đầu mới."
                : `Lưu trữ thẻ “${page.hanzi}”?`;
              if (window.confirm(confirmText)) {
                mutate(archiveFlashcardPageAction);
              }
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      )}
    </article>
  );
}

/**
 * XEM TRƯỚC ĐÚNG THỨ HỌC VIÊN NHÌN THẤY.
 *
 * Bản cũ ở đây là hai ô `MediaPreview` — ảnh THÔ của hai cột, kèm chữ "Không có
 * ảnh" cho thẻ chữ thuần. Tức admin soạn xong không cách nào biết thẻ hiện ra
 * thế nào, vì từ Phase 16 mặt thẻ được dựng BẰNG CHỮ chứ không còn là ảnh.
 *
 * Nay hai ô này là chính `FlashcardFaceCard` mà màn học viên dùng, thu nhỏ lại.
 * Vẽ một bản thứ hai cho Quản trị là tự tạo hai nguồn sự thật (`BUG_M10_01`).
 */
const PREVIEW_NATURAL_WIDTH = 600;
const PREVIEW_BOX_WIDTH = 160;
const PREVIEW_SCALE = PREVIEW_BOX_WIDTH / PREVIEW_NATURAL_WIDTH;

function FlashcardFaceThumbnail({
  page,
  face,
}: {
  page: FlashcardPageView;
  face: Face;
}) {
  return (
    // Khung cắt nằm BÊN TRONG nút, không bọc ngoài: `overflow-hidden` bọc quanh
    // một nút sẽ cắt mất vòng focus 3px của chính nút đó.
    <span
      aria-hidden
      className="bg-card block h-37.5 w-40 overflow-hidden rounded-md border"
    >
      <span
        className="block origin-top-left"
        style={{
          width: PREVIEW_NATURAL_WIDTH,
          transform: `scale(${PREVIEW_SCALE})`,
        }}
      >
        <FlashcardFaceCard page={page} face={face} />
      </span>
    </span>
  );
}

function FlashcardFacePreviewPair({ page }: { page: FlashcardPageView }) {
  const [open, setOpen] = useState(false);
  const isCover = page.kind === "session_cover";
  const name = isCover ? "trang mở đầu" : `thẻ ${page.hanzi ?? "từ vựng"}`;

  /*
   * Trang mở đầu nay chỉ vẽ MỘT ô (`D-41`), thẻ từ vựng vẫn hai.
   *
   * Vẽ hai ô giống hệt nhau cho trang mở đầu là thứ đọc lên như một lỗi hiển
   * thị: admin sẽ dừng lại soi xem mình có up nhầm cùng một ảnh hai lần không.
   * Một ô kèm chú "dùng cho cả hai mặt" nói đúng sự thật và nói ngay.
   */
  const faces = isCover ? (["front"] as const) : (["front", "back"] as const);
  const faceLabel = (face: Face) =>
    isCover ? "Cả hai mặt" : face === "front" ? "Mặt trước" : "Mặt sau";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex shrink-0 flex-wrap gap-2">
        {faces.map((face) => (
          <DialogTrigger asChild key={face}>
            <button
              type="button"
              className="focus-visible:ring-ring cursor-pointer rounded-md focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <FlashcardFaceThumbnail page={page} face={face} />
              <span className="sr-only">
                Phóng to {faceLabel(face).toLowerCase()} của {name}
              </span>
            </button>
          </DialogTrigger>
        ))}
      </div>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Xem trước {name}</DialogTitle>
          <DialogDescription>
            {isCover
              ? "Đúng bằng thứ học viên nhìn thấy khi buổi đã công bố. Trang mở đầu dùng một ảnh cho cả hai mặt."
              : "Đúng bằng thứ học viên nhìn thấy khi buổi đã công bố."}
          </DialogDescription>
        </DialogHeader>
        {/*
          Hiện CẢ HAI mặt cùng lúc thay vì bắt lật: admin đang soát nội dung, cần
          so hai mặt với nhau, không cần diễn lại thao tác học.
        */}
        <div className="space-y-4">
          {faces.map((face) => (
            <section key={face} className="space-y-2">
              <h3 className="text-sm font-semibold">{faceLabel(face)}</h3>
              <FlashcardFaceCard page={page} face={face} />
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp";
const AUDIO_ACCEPT = "audio/mpeg,audio/mp4,.mp3,.m4a";

// Khe `back` đã nghỉ hưu (`…084`): trang mở đầu một ảnh, thẻ từ vựng mặt sau chữ.
type FixedMediaFiles = Partial<Record<"front" | "audio", File>>;

function toDrafts(
  items: Array<{
    hanzi: string;
    pinyin: string;
    meaning_vi: string;
    image_path?: string | null;
  }>,
): SublistDraft[] {
  return items.map((item) => ({
    key: crypto.randomUUID(),
    hanzi: item.hanzi,
    pinyin: item.pinyin,
    meaning_vi: item.meaning_vi,
    image_path: item.image_path ?? null,
  }));
}

function PageDialog({
  deckId,
  section,
  page,
}: {
  deckId: string;
  section: FlashcardSectionView;
  page?: FlashcardPageView;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState<ActionState>({});
  const [files, setFiles] = useState<FixedMediaFiles>({});
  // Chỉ còn MỘT ô "bỏ ảnh" (thẻ từ vựng): trang mở đầu không bỏ ảnh được vì ảnh
  // là thứ duy nhất nó có.
  const [clearedFront, setClearedFront] = useState(false);

  const isEdit = Boolean(page);
  const hasCover = section.pages.some((item) => item.kind === "session_cover");
  const defaultKind = page?.kind ?? (hasCover ? "vocabulary" : "session_cover");
  const [kind, setKind] = useState<"session_cover" | "vocabulary">(defaultKind);

  const stored = useMemo(
    () => (page ? readFlashcardSublists(page) : { examples: [], phrases: [] }),
    [page],
  );
  const [examples, setExamples] = useState<SublistDraft[]>(() =>
    toDrafts(stored.examples),
  );
  const [phrases, setPhrases] = useState<SublistDraft[]>(() =>
    toDrafts(stored.phrases),
  );

  const fieldId = (name: string) => `${name}-${page?.id ?? "new"}`;

  function reset() {
    setFiles({});
    setState({});
    setKind(defaultKind);
    setClearedFront(false);
    setExamples(toDrafts(stored.examples));
    setPhrases(toDrafts(stored.phrases));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // Trang mở đầu bắt buộc ĐÚNG MỘT ảnh (`D-41`); thẻ từ vựng bắt buộc audio,
    // còn ảnh là tuỳ chọn (§7ter). Chặn ở đây để không tải file lên rồi mới báo
    // lỗi.
    if (!isEdit) {
      if (kind === "session_cover" && !files.front) {
        setState({ error: "Trang mở đầu cần một ảnh." });
        return;
      }
    }

    const uploads: Array<{ slot: FlashcardMediaSlot; file: File }> = [];
    if (files.front) uploads.push({ slot: "front", file: files.front });
    if (kind === "vocabulary" && files.audio) {
      uploads.push({ slot: "audio", file: files.audio });
    }
    if (kind === "vocabulary") {
      examples.forEach((example, index) => {
        if (example.file) {
          uploads.push({ slot: exampleMediaSlot(index), file: example.file });
        }
      });
    }

    setSaving(true);
    setState({});
    let pageId = page?.id;
    const uploadedPaths: string[] = [];
    const uploadedBySlot = new Map<string, string>();

    const discard = async () => {
      if (!pageId || uploadedPaths.length === 0) return;
      await discardFlashcardUploadsAction({
        deckId,
        sectionId: section.id,
        pageId,
        paths: uploadedPaths,
      });
    };

    try {
      if (uploads.length > 0) {
        /*
         * NÉN TRƯỚC KHI XIN VÉ (`PERF-IMG-1`), không phải sau.
         *
         * Đường dẫn trong bucket do server dựng từ `fileName` + `mimeType` gửi
         * lên (`actions.ts`), và bước soi sau khi tải xong đối chiếu đuôi file
         * với `contentType` thật của object. Nén sau khi xin vé là vé mang đuôi
         * `.jpg` còn byte là WebP — lệch đúng chỗ đó và cả lượt tải bị vứt.
         *
         * Audio đi qua nguyên vẹn: `compressFlashcardImage` chỉ đụng vào ảnh.
         */
        const compressed: Array<{ slot: FlashcardMediaSlot; file: File }> = [];
        for (const item of uploads) {
          const { file } = await compressFlashcardImage(item.file);
          compressed.push({ slot: item.slot, file });
        }

        const result = await createFlashcardUploadTicketsAction({
          sectionId: section.id,
          pageId,
          files: compressed.map(({ slot, file }) => ({
            slot,
            fileName: file.name,
            mimeType: file.type,
            sizeBytes: file.size,
          })),
        });
        if ("error" in result) {
          setState({ error: result.error });
          return;
        }
        pageId = result.pageId;

        const supabase = createClient();
        const fileBySlot = new Map(
          compressed.map(({ slot, file }) => [slot as string, file]),
        );
        for (const ticket of result.tickets) {
          const file = fileBySlot.get(ticket.slot);
          if (!file) continue;
          const { error } = await supabase.storage
            .from(FLASHCARD_MEDIA_BUCKET)
            .uploadToSignedUrl(ticket.path, ticket.token, file, {
              contentType: ticket.contentType,
              cacheControl: FLASHCARD_MEDIA_CACHE_CONTROL,
            });
          if (error) {
            await discard();
            setState({
              error: "Tải media thất bại. Kiểm tra kết nối rồi thử lại.",
            });
            return;
          }
          uploadedPaths.push(ticket.path);
          uploadedBySlot.set(ticket.slot, ticket.path);
        }
      }

      // Thẻ chữ thuần (không ảnh, không audio — hợp lệ từ khi audio thành tuỳ
      // chọn) không đi qua luồng upload nên chưa có `pageId`. Sinh một mã ở đây;
      // `saveFlashcardPageAction` chấp nhận id do client cấp cho trang mới.
      pageId ??= crypto.randomUUID();

      formData.set("id", pageId);
      formData.set("section_id", section.id);
      formData.set("kind", kind);

      // Chỉ còn MỘT khe ảnh cho cả hai loại trang (`…084`): trang mở đầu vẽ một
      // ảnh ra hai mặt, thẻ từ vựng có mặt sau bằng chữ.
      const uploadedFront = uploadedBySlot.get("front");
      formData.set(
        "front_image_path",
        uploadedFront ??
          (kind === "vocabulary" && clearedFront
            ? ""
            : (page?.front_image_path ?? "")),
      );

      if (kind === "vocabulary") {
        formData.set(
          "audio_path",
          uploadedBySlot.get("audio") ?? page?.audio_path ?? "",
        );
        formData.set(
          "common_phrases",
          JSON.stringify(
            phrases.map((item) => ({
              hanzi: item.hanzi,
              pinyin: item.pinyin,
              meaning_vi: item.meaning_vi,
            })),
          ),
        );
        formData.set(
          "example_sentences",
          JSON.stringify(
            examples.map((item, index) => ({
              hanzi: item.hanzi,
              pinyin: item.pinyin,
              meaning_vi: item.meaning_vi,
              image_path:
                uploadedBySlot.get(exampleMediaSlot(index)) ??
                item.image_path ??
                null,
            })),
          ),
        );
      }

      const result = await saveFlashcardPageAction(formData);
      if (result.error) {
        await discard();
        setState(result);
        return;
      }
      toast.success(result.success);
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      await discard();
      setState({ error: "Không thể lưu trang lúc này. Vui lòng thử lại." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      {/*
        `DS-051`: nút mở dialog do CHÍNH component client này dựng, suy từ cờ
        `isEdit` — không nhận React element qua prop rồi đưa xuống `asChild`.
      */}
      <DialogTrigger asChild>
        {isEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`Sửa ${page?.hanzi ?? "trang mở đầu"}`}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
        ) : (
          <Button type="button" variant="outline">
            <Plus className="size-4" aria-hidden />
            Thêm trang
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Chỉnh sửa trang" : "Thêm trang flashcard"}
          </DialogTitle>
          <DialogDescription>
            {kind === "vocabulary"
              ? "Thẻ từ vựng cần Hán tự, pinyin và nghĩa. Ảnh là tuỳ chọn; audio phát âm là bắt buộc."
              : "Trang mở đầu chỉ gồm một ảnh dùng cho cả hai mặt, không nhập chữ và không có audio."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor={fieldId("page-kind")}>Loại trang</Label>
            <Select
              value={kind}
              onValueChange={(value) => {
                setKind(value as "session_cover" | "vocabulary");
                if (value === "session_cover") {
                  setFiles((current) => ({ ...current, audio: undefined }));
                }
              }}
              disabled={isEdit}
            >
              <SelectTrigger id={fieldId("page-kind")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!hasCover || page?.kind === "session_cover" ? (
                  <SelectItem value="session_cover">
                    Trang mở đầu buổi
                  </SelectItem>
                ) : null}
                <SelectItem value="vocabulary">Thẻ từ vựng</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === "vocabulary" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor={fieldId("hanzi")}>Hán tự *</Label>
                <Input
                  id={fieldId("hanzi")}
                  name="hanzi"
                  defaultValue={page?.hanzi ?? ""}
                  placeholder="Ví dụ: 胡萝卜"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={fieldId("pinyin")}>
                  Pinyin — tách theo âm tiết *
                </Label>
                <Input
                  id={fieldId("pinyin")}
                  name="pinyin_syllables"
                  defaultValue={page?.pinyin_syllables ?? ""}
                  placeholder="hú luó bo"
                  aria-describedby={fieldId("pinyin-help")}
                  required
                />
                <p
                  id={fieldId("pinyin-help")}
                  className="text-muted-foreground text-sm"
                >
                  Mỗi âm tiết cách nhau một dấu cách, đúng số chữ Hán ở trên.
                  Mặt sau tự ghép lại thành dạng viết liền.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor={fieldId("meaning")}>Nghĩa tiếng Việt *</Label>
                <Input
                  id={fieldId("meaning")}
                  name="meaning_vi"
                  defaultValue={page?.meaning_vi ?? ""}
                  placeholder="Củ cà rốt"
                  required
                />
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {/*
              MỘT ô ảnh duy nhất cho cả hai loại trang (`D-41`).

              Nhãn đổi theo loại trang chứ không dùng chung một câu: với trang mở
              đầu thì "mặt trước" là chữ SAI — nó là ảnh của cả hai mặt, và gọi
              nó là mặt trước sẽ khiến người soạn đi tìm ô mặt sau không tồn tại.
              Câu `input-helper-text` bên dưới nói thẳng hệ quả, thay vì để người
              dùng phát hiện sau khi lưu.
            */}
            <MediaFileField
              id={fieldId("front")}
              label={
                kind === "session_cover" ? "Ảnh trang mở đầu" : "Ảnh mặt trước"
              }
              accept={IMAGE_ACCEPT}
              required={!isEdit && kind === "session_cover"}
              optionalHint={
                kind === "vocabulary"
                  ? "tuỳ chọn"
                  : isEdit
                    ? "để trống nếu giữ ảnh cũ"
                    : undefined
              }
              helperText={
                kind === "session_cover"
                  ? "Dùng cho cả mặt trước và mặt sau — thẻ vẫn lật, hai mặt hiện cùng ảnh này."
                  : undefined
              }
              onFile={(file) =>
                setFiles((current) => ({ ...current, front: file }))
              }
            />
          </div>

          {/*
            Chỉ thẻ từ vựng mới bỏ được ảnh: ảnh là thứ DUY NHẤT trang mở đầu có,
            bỏ nó đi thì trang rỗng và DB từ chối (`flashcard_pages_image_kind_check`).
          */}
          {kind === "vocabulary" && isEdit && page?.front_image_path && (
            <div className="flex flex-wrap gap-4">
              <label
                className="flex items-center gap-2 text-sm"
                htmlFor={fieldId("clear-front")}
              >
                <input
                  id={fieldId("clear-front")}
                  type="checkbox"
                  className="size-4"
                  checked={clearedFront}
                  onChange={(event) => setClearedFront(event.target.checked)}
                />
                Bỏ ảnh mặt trước khỏi thẻ
              </label>
            </div>
          )}

          {kind === "vocabulary" && (
            <MediaFileField
              id={fieldId("audio")}
              label="Audio phát âm"
              accept={AUDIO_ACCEPT}
              required={false}
              // Audio gắn được sau, nhưng buổi KHÔNG công bố được khi còn thẻ
              // thiếu audio — `validate_flashcard_section_publish` chặn.
              optionalHint="bắt buộc trước khi công bố buổi"
              onFile={(file) =>
                setFiles((current) => ({ ...current, audio: file }))
              }
            />
          )}

          {kind === "vocabulary" && (
            <div className="space-y-3">
              <VocabularySublistEditor
                idPrefix={fieldId("example")}
                legend="Câu ví dụ"
                description="Mỗi câu gồm câu Hán, pinyin, nghĩa tiếng Việt và ảnh minh hoạ tuỳ chọn."
                itemNoun="câu ví dụ"
                hanziLabel="Câu ví dụ (Hán tự)"
                meaningLabel="Nghĩa tiếng Việt"
                items={examples}
                max={MAX_FLASHCARD_EXAMPLE_SENTENCES}
                withImage
                onChange={setExamples}
              />
              <VocabularySublistEditor
                idPrefix={fieldId("phrase")}
                legend="Cụm từ thường dùng"
                description="Các cụm hay gặp chứa từ này."
                itemNoun="cụm từ"
                hanziLabel="Cụm từ (Hán tự)"
                meaningLabel="Nghĩa tiếng Việt"
                items={phrases}
                max={MAX_FLASHCARD_PHRASE_ITEMS}
                onChange={setPhrases}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Volume2 className="size-4" aria-hidden />
              )}
              {saving ? "Đang tải và lưu…" : "Lưu trang"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MediaFileField({
  id,
  label,
  accept,
  required,
  optionalHint,
  helperText,
  onFile,
}: {
  id: string;
  label: string;
  accept: string;
  required: boolean;
  optionalHint?: string;
  /** Câu giải thích BỀN, nằm dưới ô — không phải placeholder biến mất khi gõ. */
  helperText?: string;
  onFile: (file: File | undefined) => void;
}) {
  const helperId = `${id}-help`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required ? "*" : optionalHint ? `(${optionalHint})` : null}
      </Label>
      <Input
        id={id}
        type="file"
        accept={accept}
        required={required}
        aria-describedby={helperText ? helperId : undefined}
        onChange={(event) => onFile(event.target.files?.[0])}
      />
      {helperText && (
        <p id={helperId} className="text-muted-foreground text-sm">
          {helperText}
        </p>
      )}
    </div>
  );
}
