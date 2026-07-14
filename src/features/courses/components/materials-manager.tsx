"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Download,
  FileArchive,
  FileAudio,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Loader2,
  Paperclip,
  Pencil,
  Presentation,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import {
  createMaterialUploadUrlAction,
  deleteMaterialAction,
  getMaterialDownloadUrlAction,
  registerMaterialAction,
  updateMaterialAction,
} from "@/features/courses/server/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/shared/status-badge";
import { SubmitButton } from "@/components/shared/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/dates";
import {
  ALLOWED_FILE_EXTENSIONS,
  MATERIALS_BUCKET,
  MAX_MATERIAL_SIZE_BYTES,
  fileExtension,
  fileKind,
  formatFileSize,
  type FileKind,
} from "@/lib/domain/files";
import { MATERIAL_VISIBILITY_LABELS } from "@/lib/domain/labels";
import { createClient } from "@/lib/supabase/client";
import { useFormAction } from "@/lib/use-form-action";

type Visibility = "staff_only" | "enrolled_students";

type Material = {
  id: string;
  title: string;
  object_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  visibility: Visibility;
  created_at: string;
  module: { id: string; title: string } | null;
  lesson: { id: string; title: string } | null;
};

type Lesson = { id: string; title: string; order_index: number };
type Module = {
  id: string;
  title: string;
  order_index: number;
  lessons: Lesson[];
};

const KIND_ICONS: Record<FileKind, typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  slide: Presentation,
  sheet: FileSpreadsheet,
  image: FileImage,
  audio: FileAudio,
  video: FileVideo,
  archive: FileArchive,
  text: FileText,
};

const ACCEPT = ALLOWED_FILE_EXTENSIONS.map((e) => `.${e}`).join(",");

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-destructive text-xs">{message}</p>;
}

export function MaterialsManager({
  courseId,
  materials,
  modules,
}: {
  courseId: string;
  materials: Material[];
  modules: Module[];
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Tài liệu</h2>
          <p className="text-muted-foreground text-sm">
            Tệp nằm trong kho riêng tư. Học viên chỉ tải được tài liệu đặt ở phạm
            vi “{MATERIAL_VISIBILITY_LABELS.enrolled_students}”, và chỉ khi đang
            học khóa này.
          </p>
        </div>
        <UploadDialog courseId={courseId} modules={modules} />
      </div>

      {materials.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={Paperclip}
              title="Chưa có tài liệu nào"
              description="Tải lên giáo trình, file nghe, đề luyện tập… Gắn được vào cả khóa, một chương hoặc một bài học cụ thể."
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y">
              {materials.map((m) => (
                <MaterialRow key={m.id} courseId={courseId} material={m} />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MaterialRow({
  courseId,
  material,
}: {
  courseId: string;
  material: Material;
}) {
  const [downloading, setDownloading] = useState(false);

  const ext = fileExtension(material.object_path);
  const Icon = ext ? KIND_ICONS[fileKind(ext)] : FileText;

  const attachedTo =
    material.lesson?.title ?? material.module?.title ?? "Cả khóa học";

  async function handleDownload() {
    setDownloading(true);
    const result = await getMaterialDownloadUrlAction(material.id);
    setDownloading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    // URL đã ký kèm `Content-Disposition: attachment` → trình duyệt tải tệp về,
    // không điều hướng rời trang.
    window.location.href = result.url;
  }

  return (
    <li className="flex items-center gap-3 p-4">
      <span className="bg-muted flex size-9 shrink-0 items-center justify-center rounded">
        <Icon className="text-muted-foreground size-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-medium">{material.title}</p>
          <StatusBadge
            label={MATERIAL_VISIBILITY_LABELS[material.visibility]}
            tone={material.visibility === "staff_only" ? "warning" : "success"}
          />
        </div>
        <p className="text-muted-foreground text-xs">
          {attachedTo} · {formatFileSize(material.size_bytes)} ·{" "}
          {formatDate(material.created_at)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          disabled={downloading}
          aria-label={`Tải xuống ${material.title}`}
        >
          {downloading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Download className="size-4" aria-hidden />
          )}
        </Button>

        <EditDialog courseId={courseId} material={material} />
        <DeleteButton courseId={courseId} material={material} />
      </div>
    </li>
  );
}

/**
 * Tải tệp lên — ba bước, xem `server/actions.ts`.
 *
 * Tệp đi THẲNG từ trình duyệt lên Supabase Storage. Server action chỉ nhận
 * metadata, không bao giờ nhận `File` — nên `fd.delete("file")` bên dưới là bắt
 * buộc, không phải cho gọn.
 */
function UploadDialog({
  courseId,
  modules,
}: {
  courseId: string;
  modules: Module[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [state, setState] = useState<ActionState>(EMPTY_ACTION_STATE);

  const fe = state.fieldErrors ?? {};

  function reset() {
    setFile(null);
    setState(EMPTY_ACTION_STATE);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Giữ lại form NGAY: sau `await` đầu tiên, `event.currentTarget` là null.
    const formEl = event.currentTarget;

    if (!file) {
      setState({ error: "Chọn tệp cần tải lên." });
      return;
    }

    // Kiểm ở client chỉ để báo lỗi sớm cho người dùng. Server kiểm lại y hệt —
    // đây là UX, không phải bảo mật.
    const ext = fileExtension(file.name);
    if (!ext) {
      setState({
        error: `Định dạng không được hỗ trợ. Cho phép: ${ALLOWED_FILE_EXTENSIONS.join(", ")}.`,
      });
      return;
    }
    if (file.size > MAX_MATERIAL_SIZE_BYTES) {
      setState({ error: "Tệp vượt quá 50 MB." });
      return;
    }

    setUploading(true);
    setState(EMPTY_ACTION_STATE);

    try {
      // 1. Server kiểm quyền, tự sinh đường dẫn, ký vé tải lên.
      const ticket = await createMaterialUploadUrlAction({
        courseId,
        fileName: file.name,
        sizeBytes: file.size,
      });

      if ("error" in ticket) {
        setState({ error: ticket.error });
        return;
      }

      // 2. Trình duyệt đẩy tệp thẳng lên storage bằng vé đó.
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(MATERIALS_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) {
        setState({
          error: "Tải tệp lên thất bại. Kiểm tra kết nối rồi thử lại.",
        });
        return;
      }

      // 3. Ghi metadata. Tệp đã nằm trên storage nên server xác minh được nó có thật.
      const fd = new FormData(formEl);
      fd.delete("file"); // tệp KHÔNG đi qua Next server — xem ghi chú ở actions.ts
      fd.set("object_path", ticket.path);

      // Một ô chọn duy nhất cho "gắn vào đâu", tách lại thành 2 khóa ngoại.
      const attach = fd.get("attach");
      fd.delete("attach");
      if (typeof attach === "string" && attach.includes(":")) {
        const [kind, id] = attach.split(":");
        if (kind === "module") fd.set("module_id", id ?? "");
        if (kind === "lesson") {
          fd.set("lesson_id", id ?? "");
          // Gắn kèm chương cha để danh sách hiển thị được ngữ cảnh. Trigger DB
          // sẽ chặn nếu cặp module/lesson này không thuộc khóa học.
          const parent = modules.find((m) =>
            m.lessons.some((l) => l.id === id),
          );
          if (parent) fd.set("module_id", parent.id);
        }
      }

      const result = await registerMaterialAction(EMPTY_ACTION_STATE, fd);

      if (result.success) {
        toast.success(result.success);
        setOpen(false);
        reset();
        router.refresh();
        return;
      }

      setState(result);
    } finally {
      setUploading(false);
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
        <Button>
          <Upload className="size-4" aria-hidden />
          Tải lên tài liệu
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tải lên tài liệu</DialogTitle>
          <DialogDescription>
            Tối đa 50 MB. Tệp lưu trong kho riêng tư, chỉ tải được qua liên kết
            có hạn.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="course_id" value={courseId} />

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="file">Tệp *</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept={ACCEPT}
              required
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null;
                setFile(picked);
                setState(EMPTY_ACTION_STATE);
              }}
            />
            {file && (
              <p className="text-muted-foreground text-xs">
                {file.name} · {formatFileSize(file.size)}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Tên hiển thị *</Label>
            <Input
              id="title"
              name="title"
              required
              // Tên tệp chỉ là gợi ý ban đầu — sửa được, và đây cũng là tên khi
              // học viên tải về (xem `sanitizeDownloadName`).
              key={file?.name ?? "empty"}
              defaultValue={file?.name ?? ""}
              placeholder="Giáo trình HSK 1 — Bài 1"
            />
            <FieldError message={fe["title"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="attach">Gắn vào</Label>
            <Select name="attach" defaultValue="none">
              <SelectTrigger id="attach" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Cả khóa học</SelectItem>
                {modules.map((m) => [
                  <SelectItem key={m.id} value={`module:${m.id}`}>
                    Chương {m.order_index}: {m.title}
                  </SelectItem>,
                  ...m.lessons.map((l) => (
                    <SelectItem key={l.id} value={`lesson:${l.id}`}>
                      {"  "}— Bài {l.order_index}: {l.title}
                    </SelectItem>
                  )),
                ])}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Phạm vi hiển thị *</Label>
            <Select name="visibility" defaultValue="enrolled_students">
              <SelectTrigger id="visibility" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MATERIAL_VISIBILITY_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              “{MATERIAL_VISIBILITY_LABELS.staff_only}”: chỉ admin và giáo viên
              dạy khóa này thấy — học viên không nhìn thấy, kể cả gọi thẳng API.
            </p>
            <FieldError message={fe["visibility"]} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={uploading}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={uploading}>
              {uploading && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {uploading ? "Đang tải lên…" : "Tải lên"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  courseId,
  material,
}: {
  courseId: string;
  material: Material;
}) {
  const [open, setOpen] = useState(false);
  const { state, formAction } = useFormAction(updateMaterialAction, {
    onSuccess: () => setOpen(false),
  });

  const fe = state.fieldErrors ?? {};

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Sửa ${material.title}`}
        >
          <Pencil className="size-4" aria-hidden />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa tài liệu</DialogTitle>
          <DialogDescription>
            Đổi phạm vi hiển thị có hiệu lực ngay với học viên đang học.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={material.id} />
          <input type="hidden" name="course_id" value={courseId} />

          {state.error && (
            <Alert variant="destructive">
              <AlertCircle className="size-4" aria-hidden />
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor={`title-${material.id}`}>Tên hiển thị *</Label>
            <Input
              id={`title-${material.id}`}
              name="title"
              required
              defaultValue={material.title}
            />
            <FieldError message={fe["title"]} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`visibility-${material.id}`}>
              Phạm vi hiển thị *
            </Label>
            <Select name="visibility" defaultValue={material.visibility}>
              <SelectTrigger
                id={`visibility-${material.id}`}
                className="w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(MATERIAL_VISIBILITY_LABELS).map(
                  ([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
            <FieldError message={fe["visibility"]} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Hủy
            </Button>
            <SubmitButton>Lưu</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({
  courseId,
  material,
}: {
  courseId: string;
  material: Material;
}) {
  const { formAction } = useFormAction(deleteMaterialAction, {
    toastError: true,
  });

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !window.confirm(
            `Xóa tài liệu “${material.title}”? Tệp bị xóa khỏi kho, không khôi phục được.`,
          )
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={material.id} />
      <input type="hidden" name="course_id" value={courseId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label={`Xóa ${material.title}`}
      >
        <Trash2 className="text-destructive size-4" aria-hidden />
      </Button>
    </form>
  );
}
