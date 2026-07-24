"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ImagePlus,
  ListPlus,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
  Undo2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { Textarea } from "@/components/ui/textarea";
import {
  FlashcardFaceCard,
  type Face,
} from "@/features/flashcards/components/flashcard-face";
import { FlashcardImportDialog } from "@/features/flashcards/components/flashcard-import-dialog";
import { flashcardImportKey } from "@/features/flashcards/domain/bulk-import";
import {
  VocabularySublistEditor,
  type SublistDraft,
} from "@/features/flashcards/components/vocabulary-sublist-editor";
import {
  exampleMediaSlot,
  FLASHCARD_MEDIA_BUCKET,
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
  saveFlashcardDeckAction,
  saveFlashcardPageAction,
  saveFlashcardSectionAction,
  unpublishFlashcardSectionAction,
} from "@/features/flashcards/server/actions";
import type {
  FlashcardCourseOption,
  FlashcardDeckView,
  FlashcardPageView,
  FlashcardSectionView,
} from "@/features/flashcards/server/queries";
import type { ActionState } from "@/lib/action-state";
import { createClient } from "@/lib/supabase/client";

export function FlashcardAdminManager({
  courses,
  selectedCourseId,
  deck,
}: {
  courses: FlashcardCourseOption[];
  selectedCourseId: string | null;
  deck: FlashcardDeckView | null;
}) {
  const router = useRouter();
  const selectedCourse = courses.find(
    (course) => course.id === selectedCourseId,
  );
  const [selectedSectionId, setSelectedSectionId] = useState(
    deck?.sections[0]?.id ?? null,
  );
  const section =
    deck?.sections.find((item) => item.id === selectedSectionId) ??
    deck?.sections[0] ??
    null;
  const nextSession = selectedCourse?.defaultSessionCount
    ? (Array.from(
        { length: selectedCourse.defaultSessionCount },
        (_, index) => index + 1,
      ).find(
        (sessionNumber) =>
          !deck?.sections.some((item) => item.session_number === sessionNumber),
      ) ?? null)
    : null;

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="space-y-2">
            <Label htmlFor="flashcard-course">Khóa học</Label>
            <Select
              value={selectedCourseId ?? undefined}
              onValueChange={(courseId) => {
                setSelectedSectionId(null);
                router.push(`/admin/flashcards?course=${courseId}`);
              }}
            >
              <SelectTrigger id="flashcard-course" className="w-full">
                <SelectValue placeholder="Chọn khóa học để quản trị flashcard" />
              </SelectTrigger>
              <SelectContent>
                {courses.map((course) => (
                  <SelectItem key={course.id} value={course.id}>
                    {course.code} · {course.title}
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
        </CardContent>
      </Card>

      {!selectedCourse ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={BookOpen}
              title="Chọn một khóa học"
              description="Mỗi khóa có một bộ flashcard riêng, chia mục lục theo từng buổi."
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
        <CreateDeckCard course={selectedCourse} />
      ) : (
        <>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{deck.title}</h2>
              <p className="text-muted-foreground text-sm">
                {deck.description || "Chưa có mô tả."}
              </p>
            </div>
            {/*
              MỘT hành động chính mỗi vùng: "Thêm buổi" là nút mặc định, "Tạo
              nhiều buổi" đứng cạnh ở dạng viền. Hành động PHÁ HUỶ không nằm ở
              đây — chúng ở "Vùng nguy hiểm" cuối trang.
            */}
            {nextSession ? (
              <div className="flex flex-wrap gap-2">
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
              </div>
            ) : (
              <StatusBadge label="Đã đủ số buổi" tone="success" />
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
            <>
              <nav
                aria-label="Mục lục buổi flashcard"
                className="flex gap-2 overflow-x-auto pb-2"
              >
                {deck.sections.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant={item.id === section?.id ? "default" : "outline"}
                    className="h-11 shrink-0 rounded-t-lg rounded-b-sm"
                    onClick={() => setSelectedSectionId(item.id)}
                  >
                    Buổi {item.session_number}
                  </Button>
                ))}
              </nav>
              {section && (
                <>
                  <SectionWorkspace
                    deck={deck}
                    section={section}
                    maxSessions={selectedCourse.defaultSessionCount}
                  />
                  <FlashcardDangerZone deck={deck} section={section} />
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function CreateDeckCard({ course }: { course: FlashcardCourseOption }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({});

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tạo bộ flashcard</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            startTransition(async () => {
              const result = await saveFlashcardDeckAction(data);
              setState(result);
              if (result.success) {
                toast.success(result.success);
                router.refresh();
              }
            });
          }}
        >
          <input type="hidden" name="course_id" value={course.id} />
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor="deck-title">Tên bộ *</Label>
            <Input
              id="deck-title"
              name="title"
              defaultValue={`Flashcard — ${course.title}`}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deck-description">Mô tả</Label>
            <Textarea
              id="deck-description"
              name="description"
              placeholder="Mô tả ngắn cho học viên"
            />
          </div>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Tạo bộ flashcard
          </Button>
        </form>
      </CardContent>
    </Card>
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
                sectionId={section.id}
                existingKeys={existingVocabKeys}
              />
            </>
          )}
          <Button
            type="button"
            variant={section.status === "published" ? "outline" : "default"}
            disabled={pending}
            onClick={() =>
              run(
                section.status === "published"
                  ? unpublishFlashcardSectionAction
                  : publishFlashcardSectionAction,
              )
            }
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
  const name =
    page.kind === "session_cover"
      ? "trang mở đầu"
      : `thẻ ${page.hanzi ?? "từ vựng"}`;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="flex shrink-0 flex-wrap gap-2">
        {(["front", "back"] as const).map((face) => (
          <DialogTrigger asChild key={face}>
            <button
              type="button"
              className="focus-visible:ring-ring cursor-pointer rounded-md focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <FlashcardFaceThumbnail page={page} face={face} />
              <span className="sr-only">
                Phóng to mặt {face === "front" ? "trước" : "sau"} của {name}
              </span>
            </button>
          </DialogTrigger>
        ))}
      </div>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Xem trước {name}</DialogTitle>
          <DialogDescription>
            Đúng bằng thứ học viên nhìn thấy khi buổi đã công bố.
          </DialogDescription>
        </DialogHeader>
        {/*
          Hiện CẢ HAI mặt cùng lúc thay vì bắt lật: admin đang soát nội dung, cần
          so hai mặt với nhau, không cần diễn lại thao tác học.
        */}
        <div className="space-y-4">
          {(["front", "back"] as const).map((face) => (
            <section key={face} className="space-y-2">
              <h3 className="text-sm font-semibold">
                {face === "front" ? "Mặt trước" : "Mặt sau"}
              </h3>
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

type FixedMediaFiles = Partial<Record<"front" | "back" | "audio", File>>;

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
  const [clearedFaces, setClearedFaces] = useState({
    front: false,
    back: false,
  });

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
    setClearedFaces({ front: false, back: false });
    setExamples(toDrafts(stored.examples));
    setPhrases(toDrafts(stored.phrases));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // Trang mở đầu bắt buộc đủ hai ảnh; thẻ từ vựng bắt buộc audio, còn ảnh là
    // tuỳ chọn (§7ter). Chặn ở đây để không tải file lên rồi mới báo lỗi.
    if (!isEdit) {
      if (kind === "session_cover" && !(files.front && files.back)) {
        setState({
          error: "Trang mở đầu cần đủ ảnh mặt trước và ảnh mặt sau.",
        });
        return;
      }
    }

    const uploads: Array<{ slot: FlashcardMediaSlot; file: File }> = [];
    if (files.front) uploads.push({ slot: "front", file: files.front });
    if (files.back) uploads.push({ slot: "back", file: files.back });
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
        const result = await createFlashcardUploadTicketsAction({
          sectionId: section.id,
          pageId,
          files: uploads.map(({ slot, file }) => ({
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
          uploads.map(({ slot, file }) => [slot as string, file]),
        );
        for (const ticket of result.tickets) {
          const file = fileBySlot.get(ticket.slot);
          if (!file) continue;
          const { error } = await supabase.storage
            .from(FLASHCARD_MEDIA_BUCKET)
            .uploadToSignedUrl(ticket.path, ticket.token, file, {
              contentType: ticket.contentType,
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

      const keptFace = (face: "front" | "back") => {
        const uploaded = uploadedBySlot.get(face);
        if (uploaded) return uploaded;
        if (kind === "vocabulary" && clearedFaces[face]) return "";
        return (
          (face === "front" ? page?.front_image_path : page?.back_image_path) ??
          ""
        );
      };
      formData.set("front_image_path", keptFace("front"));
      formData.set("back_image_path", keptFace("back"));

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
              : "Trang mở đầu chỉ gồm hai ảnh, không nhập chữ và không có audio."}
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
            <MediaFileField
              id={fieldId("front")}
              label="Ảnh mặt trước"
              accept={IMAGE_ACCEPT}
              required={!isEdit && kind === "session_cover"}
              optionalHint={
                kind === "vocabulary"
                  ? "tuỳ chọn"
                  : isEdit
                    ? "để trống nếu giữ ảnh cũ"
                    : undefined
              }
              onFile={(file) =>
                setFiles((current) => ({ ...current, front: file }))
              }
            />
            <MediaFileField
              id={fieldId("back")}
              label="Ảnh mặt sau"
              accept={IMAGE_ACCEPT}
              required={!isEdit && kind === "session_cover"}
              optionalHint={
                kind === "vocabulary"
                  ? "tuỳ chọn, phải khác ảnh mặt trước"
                  : isEdit
                    ? "để trống nếu giữ ảnh cũ"
                    : undefined
              }
              onFile={(file) =>
                setFiles((current) => ({ ...current, back: file }))
              }
            />
          </div>

          {kind === "vocabulary" && isEdit && (
            <div className="flex flex-wrap gap-4">
              {(["front", "back"] as const).map((face) => {
                const existing =
                  face === "front"
                    ? page?.front_image_path
                    : page?.back_image_path;
                if (!existing) return null;
                const faceLabel =
                  face === "front" ? "ảnh mặt trước" : "ảnh mặt sau";
                return (
                  <label
                    key={face}
                    className="flex items-center gap-2 text-sm"
                    htmlFor={fieldId(`clear-${face}`)}
                  >
                    <input
                      id={fieldId(`clear-${face}`)}
                      type="checkbox"
                      className="size-4"
                      checked={clearedFaces[face]}
                      onChange={(event) =>
                        setClearedFaces((current) => ({
                          ...current,
                          [face]: event.target.checked,
                        }))
                      }
                    />
                    Bỏ {faceLabel} khỏi thẻ
                  </label>
                );
              })}
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
  onFile,
}: {
  id: string;
  label: string;
  accept: string;
  required: boolean;
  optionalHint?: string;
  onFile: (file: File | undefined) => void;
}) {
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
        onChange={(event) => onFile(event.target.files?.[0])}
      />
    </div>
  );
}
