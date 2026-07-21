"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  Undo2,
  Volume2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
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
import { FLASHCARD_MEDIA_BUCKET } from "@/features/flashcards/domain/media";
import {
  archiveFlashcardPageAction,
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

type MediaFiles = Partial<Record<"front" | "back" | "audio", File>>;

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
            {nextSession ? (
              <SectionDialog
                deckId={deck.id}
                maxSessions={selectedCourse.defaultSessionCount}
                nextSession={nextSession}
              />
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
                <SectionWorkspace
                  deck={deck}
                  section={section}
                  maxSessions={selectedCourse.defaultSessionCount}
                />
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
            <PageDialog deckId={deck.id} section={section} />
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
      <div className="grid min-w-0 gap-3 sm:grid-cols-[120px_120px_minmax(0,1fr)] sm:items-center">
        <MediaPreview url={page.frontUrl} alt={page.front_alt} />
        <MediaPreview url={page.backUrl} alt={page.back_alt} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">
              {page.kind === "session_cover" ? "Trang mở đầu" : page.term}
            </p>
            <StatusBadge
              label={page.kind === "session_cover" ? "Mục lục" : "Từ vựng"}
              tone={page.kind === "session_cover" ? "info" : "neutral"}
            />
          </div>
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
          {page.kind === "vocabulary" && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-11"
                disabled={pending || index <= 1}
                aria-label={`Đưa ${page.term} lên`}
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
                aria-label={`Đưa ${page.term} xuống`}
                onClick={() =>
                  mutate(moveFlashcardPageAction, { direction: "down" })
                }
              >
                <ArrowDown className="size-4" aria-hidden />
              </Button>
            </>
          )}
          <PageDialog deckId={deckId} section={section} page={page} />
          {page.kind === "vocabulary" && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-destructive size-11"
              disabled={pending}
              aria-label={`Lưu trữ ${page.term}`}
              onClick={() => {
                if (window.confirm(`Lưu trữ trang “${page.term}”?`)) {
                  mutate(archiveFlashcardPageAction);
                }
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      )}
    </article>
  );
}

function MediaPreview({ url, alt }: { url: string | null; alt: string }) {
  return url ? (
    <Image
      src={url}
      alt={alt}
      width={120}
      height={84}
      unoptimized
      className="h-20 w-full rounded-md border object-cover"
    />
  ) : (
    <div className="bg-muted text-muted-foreground flex h-20 items-center justify-center rounded-md text-xs">
      Thiếu ảnh
    </div>
  );
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
  const [files, setFiles] = useState<MediaFiles>({});
  const isEdit = Boolean(page);
  const hasCover = section.pages.some((item) => item.kind === "session_cover");
  const defaultKind = page?.kind ?? (hasCover ? "vocabulary" : "session_cover");
  const [kind, setKind] = useState(defaultKind);
  const accepted = useMemo(
    () => ({
      front: "image/jpeg,image/png,image/webp",
      back: "image/jpeg,image/png,image/webp",
      audio: "audio/mpeg,audio/mp4,.mp3,.m4a",
    }),
    [],
  );

  function reset() {
    setFiles({});
    setState({});
    setKind(defaultKind);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    // Trang mở đầu chỉ nhận hai ảnh; audio là phần riêng của trang từ vựng.
    const selected = Object.entries(files).filter(
      (entry): entry is ["front" | "back" | "audio", File] =>
        Boolean(entry[1]) && (kind === "vocabulary" || entry[0] !== "audio"),
    );
    const requiredSlots = kind === "vocabulary" ? 3 : 2;
    if (!isEdit && selected.length !== requiredSlots) {
      setState({
        error:
          kind === "vocabulary"
            ? "Trang từ vựng cần đủ ảnh mặt trước, ảnh mặt sau và audio."
            : "Trang mở đầu cần đủ ảnh mặt trước và ảnh mặt sau.",
      });
      return;
    }

    setSaving(true);
    setState({});
    let pageId = page?.id;
    const uploadedPaths: string[] = [];
    try {
      if (selected.length > 0) {
        const result = await createFlashcardUploadTicketsAction({
          sectionId: section.id,
          pageId,
          files: selected.map(([slot, file]) => ({
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
        for (const ticket of result.tickets) {
          const file = files[ticket.slot]!;
          const { error } = await supabase.storage
            .from(FLASHCARD_MEDIA_BUCKET)
            .uploadToSignedUrl(ticket.path, ticket.token, file, {
              contentType: ticket.contentType,
            });
          if (error) {
            await discardFlashcardUploadsAction({
              deckId,
              sectionId: section.id,
              pageId,
              paths: uploadedPaths,
            });
            setState({
              error: "Tải media thất bại. Kiểm tra kết nối rồi thử lại.",
            });
            return;
          }
          uploadedPaths.push(ticket.path);
          formData.set(`${ticket.slot}_image_path`, ticket.path);
          if (ticket.slot === "audio") {
            formData.delete("audio_image_path");
            formData.set("audio_path", ticket.path);
          }
        }
      }

      if (!pageId) {
        setState({ error: "Không tạo được mã trang flashcard." });
        return;
      }
      formData.set("id", pageId);
      formData.set("section_id", section.id);
      if (!formData.get("front_image_path") && page) {
        formData.set("front_image_path", page.front_image_path);
      }
      if (!formData.get("back_image_path") && page) {
        formData.set("back_image_path", page.back_image_path);
      }
      if (!formData.get("audio_path") && page?.audio_path) {
        formData.set("audio_path", page.audio_path);
      }

      const result = await saveFlashcardPageAction(formData);
      if (result.error) {
        await discardFlashcardUploadsAction({
          deckId,
          sectionId: section.id,
          pageId,
          paths: uploadedPaths,
        });
        setState(result);
        return;
      }
      toast.success(result.success);
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      if (pageId && uploadedPaths.length > 0) {
        await discardFlashcardUploadsAction({
          deckId,
          sectionId: section.id,
          pageId,
          paths: uploadedPaths,
        });
      }
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
      <DialogTrigger asChild>
        {isEdit ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label={`Sửa ${page?.term ?? "trang mở đầu"}`}
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Chỉnh sửa trang" : "Thêm trang flashcard"}
          </DialogTitle>
          <DialogDescription>
            {kind === "vocabulary"
              ? "Ảnh tối đa 8 MB; audio MP3/M4A tối đa 20 MB. File tải thẳng vào kho riêng tư."
              : "Trang mở đầu chỉ cần ảnh mặt trước và mặt sau, tối đa 8 MB mỗi ảnh. File tải thẳng vào kho riêng tư."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {state.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-2">
            <Label htmlFor={`page-kind-${page?.id ?? "new"}`}>Loại trang</Label>
            <Select
              name="kind"
              value={kind}
              onValueChange={(value) => {
                setKind(value as "session_cover" | "vocabulary");
                if (value === "session_cover") {
                  setFiles((current) => ({ ...current, audio: undefined }));
                }
              }}
              disabled={isEdit}
            >
              <SelectTrigger id={`page-kind-${page?.id ?? "new"}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {!hasCover || page?.kind === "session_cover" ? (
                  <SelectItem value="session_cover">
                    Trang mở đầu buổi
                  </SelectItem>
                ) : null}
                <SelectItem value="vocabulary">Trang từ vựng</SelectItem>
              </SelectContent>
            </Select>
            {isEdit && <input type="hidden" name="kind" value={page!.kind} />}
          </div>
          {kind === "vocabulary" && (
            <div className="space-y-2">
              <Label htmlFor={`term-${page?.id ?? "new"}`}>Từ/cụm từ *</Label>
              <Input
                id={`term-${page?.id ?? "new"}`}
                name="term"
                defaultValue={page?.term ?? ""}
                placeholder="Ví dụ: 你好"
                required
              />
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <MediaFileField
              id={`front-${page?.id ?? "new"}`}
              label="Ảnh mặt trước"
              accept={accepted.front}
              required={!isEdit}
              onFile={(file) =>
                setFiles((current) => ({ ...current, front: file }))
              }
            />
            <MediaFileField
              id={`back-${page?.id ?? "new"}`}
              label="Ảnh mặt sau"
              accept={accepted.back}
              required={!isEdit}
              onFile={(file) =>
                setFiles((current) => ({ ...current, back: file }))
              }
            />
          </div>
          {kind === "vocabulary" && (
            <MediaFileField
              id={`audio-${page?.id ?? "new"}`}
              label="Audio phát âm"
              accept={accepted.audio}
              required={!isEdit}
              onFile={(file) =>
                setFiles((current) => ({ ...current, audio: file }))
              }
            />
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
  onFile,
}: {
  id: string;
  label: string;
  accept: string;
  required: boolean;
  onFile: (file: File | undefined) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {required ? "*" : "(để trống nếu giữ file cũ)"}
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
