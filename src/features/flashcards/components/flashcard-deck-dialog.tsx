"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  flashcardDeckCodeSlug,
  flashcardPublicUrl,
  FLASHCARD_DECK_CODE_MAX_LENGTH,
} from "@/features/flashcards/domain/public-link";
import { saveFlashcardDeckAction } from "@/features/flashcards/server/actions";
import type {
  FlashcardCourseOption,
  FlashcardDeckSummary,
} from "@/features/flashcards/server/queries";
import type { ActionState } from "@/lib/action-state";
import { getPublicEnv } from "@/lib/env";

/**
 * Tạo / sửa một bộ thẻ (`MULTIDECK-1`).
 *
 * Điểm khó của màn này không phải form mà là **mã bộ**: nó là tiền tố của mọi
 * địa chỉ QR sẽ in ra giấy. Nên ở đây làm ba việc mà một form thường không làm:
 *
 *   1. **Hiện trước địa chỉ sẽ sinh ra** ngay khi gõ — người dùng đối chiếu
 *      được với bản in TRƯỚC khi bấm lưu, không phải sau.
 *   2. **Chuẩn hoá ngay trên ô nhập** (`VCB Ngữ Pháp` → `vcb-ngu-phap`) thay vì
 *      để họ bấm lưu rồi mới báo lỗi hình dạng.
 *   3. **Khoá ô mã** khi bộ còn liên kết sống. DB cũng chặn
 *      (`trg_flashcard_decks_guard_code`) — ở đây khoá thêm để người dùng biết
 *      LÝ DO trước khi gõ, chứ không phải để thay chỗ cho chốt chặn ở DB.
 */
export function FlashcardDeckDialog({
  open,
  onOpenChange,
  course,
  deck,
  suggestedCode,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: FlashcardCourseOption;
  /** `undefined` = tạo mới. */
  deck?: FlashcardDeckSummary;
  /** Mã gợi ý cho bộ mới, tính từ mã khoá + số bộ đang có. */
  suggestedCode: string;
  onSaved?: (deckId: string | null) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<ActionState>({});
  /**
   * Khởi tạo một lần cho mỗi lượt mở — component này chỉ được dựng khi hộp
   * thoại thật sự mở, và phía gọi đặt `key` theo bộ. Không đồng bộ lại bằng
   * `useEffect`: chuyển state trong thân effect là chuỗi render nối đuôi, và ở
   * đây nó còn có thể ghi đè chữ người dùng đang gõ.
   */
  const [code, setCode] = useState(deck?.code ?? suggestedCode);

  const codeLocked = (deck?.liveLinkCount ?? 0) > 0;
  const origin = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const previewToken = code ? `${code}-01` : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {deck ? "Sửa bộ flashcard" : "Thêm bộ flashcard"}
          </DialogTitle>
          <DialogDescription>
            Mỗi bộ có dải địa chỉ QR riêng, nên một khoá học có bao nhiêu bộ cũng
            được mà không bộ nào giành mã của bộ nào.
          </DialogDescription>
        </DialogHeader>

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
                onOpenChange(false);
                onSaved?.(deck?.id ?? null);
                router.refresh();
              }
            });
          }}
        >
          <input type="hidden" name="course_id" value={course.id} />
          {deck && <input type="hidden" name="id" value={deck.id} />}

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
              defaultValue={deck?.title ?? `Flashcard — ${course.title}`}
              required
            />
            {state.fieldErrors?.title && (
              <p className="text-danger-ink text-sm">{state.fieldErrors.title}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deck-code">Mã bộ *</Label>
            <Input
              id="deck-code"
              name="code"
              value={code}
              disabled={codeLocked}
              maxLength={FLASHCARD_DECK_CODE_MAX_LENGTH}
              // Chuẩn hoá NGAY trên ô nhập: cùng phép biến đổi mà Zod và DB
              // dùng, nên cái người dùng nhìn thấy chính là cái sẽ được lưu.
              onChange={(event) =>
                setCode(flashcardDeckCodeSlug(event.target.value))
              }
              className="font-mono"
              aria-describedby="deck-code-help"
              required
            />
            <p id="deck-code-help" className="text-text-secondary text-sm">
              {codeLocked ? (
                <>
                  Bộ này đang có {deck?.liveLinkCount} liên kết công khai còn
                  hiệu lực nên <strong>không đổi được mã</strong> — đổi sẽ làm
                  mọi địa chỉ sinh về sau lệch khỏi mã QR đã in. Thu hồi hết liên
                  kết trước nếu thật sự cần đổi.
                </>
              ) : previewToken ? (
                <>
                  Địa chỉ buổi 1 sẽ là{" "}
                  <code className="font-mono">
                    {flashcardPublicUrl(origin, previewToken)}
                  </code>
                </>
              ) : (
                "Chỉ chữ thường, số và dấu gạch nối."
              )}
            </p>
            {state.fieldErrors?.code && (
              <p className="text-danger-ink text-sm">{state.fieldErrors.code}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deck-description">Mô tả</Label>
            <Textarea
              id="deck-description"
              name="description"
              defaultValue={deck?.description ?? ""}
              placeholder="Mô tả ngắn cho học viên"
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              )}
              {deck ? "Lưu bộ flashcard" : "Tạo bộ flashcard"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
