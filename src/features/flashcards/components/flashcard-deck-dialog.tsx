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
  flashcardDeckCodeDraft,
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
 *   2. **Chuẩn hoá ngay trên ô nhập** (`VCB Ngu Phap` → `vcb-ngu-phap`) thay vì
 *      để họ bấm lưu rồi mới báo lỗi hình dạng — nhưng theo **hai nhịp**: đang
 *      gõ dùng `…Draft` (giữ dấu gạch cuối), rời ô mới chốt bằng `…Slug`. Chạy
 *      thẳng `…Slug` sau từng phím là lỗi `MULTIDECK-1g`: nó cắt dấu gạch cuối
 *      nên mã tự đặt không bao giờ có gạch nối.
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
  /**
   * Địa chỉ xem trước dựng từ mã ĐÃ CHUẨN HOÁ, không từ chữ đang gõ.
   *
   * Trong lúc gõ, `code` được phép mang dấu gạch ở cuối (`vcb-`) — nối thẳng
   * vào sẽ hiện `/t/vcb--01`, một địa chỉ sẽ không bao giờ tồn tại. Mà mục đích
   * của dòng này là để người dùng **đối chiếu với bản in**, nên nó phải nói
   * đúng thứ sẽ được lưu.
   */
  const canonicalCode = flashcardDeckCodeSlug(code);
  const previewToken = canonicalCode ? `${canonicalCode}-01` : null;

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
            // Bấm Enter thì ô mã chưa kịp `blur`, nên chốt bản chuẩn hoá ngay
            // tại đây. Zod cũng chạy lại `…Slug` — làm ở đây để thứ được gửi
            // đi ĐÚNG BẰNG thứ dòng xem trước vừa hứa, không phải để thay chỗ
            // cho chốt chặn ở máy chủ.
            data.set("code", canonicalCode);
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
            {/*
              🔴 `readOnly` chứ KHÔNG `disabled` khi mã bị khoá.
              Ô `disabled` không được gửi kèm `FormData`, nên Zod nhận `code =
              undefined` và ném "expected string, received undefined" — hậu quả
              là bộ nào còn liên kết sống thì không đổi nổi cả TÊN, dù tên chẳng
              liên quan gì tới mã QR. `readOnly` vẫn gửi giá trị cũ, vẫn không
              gõ được, và còn đọc/chép được bằng bàn phím.

              Việc khoá ở đây vẫn chỉ là lớp giải thích. Chốt chặn thật là
              `trg_flashcard_decks_guard_code` ở DB, và nó bỏ qua khi mã không
              đổi (`is not distinct from`) nên gửi lại đúng mã cũ là hợp lệ.
            */}
            <Input
              id="deck-code"
              name="code"
              value={code}
              readOnly={codeLocked}
              maxLength={FLASHCARD_DECK_CODE_MAX_LENGTH}
              /*
               * Chuẩn hoá NGAY trên ô nhập, nhưng theo HAI NHỊP:
               *   • đang gõ  → `…Draft` (giữ dấu gạch cuối, vì đó là ký tự vừa
               *                bấm — cắt nó là không gõ nổi mã có gạch nối);
               *   • rời ô    → `…Slug`, tức đúng thứ Zod và DB sẽ áp.
               * Người dùng vẫn thấy trước cái sẽ được lưu — dòng địa chỉ xem
               * trước luôn dựng từ bản `…Slug`, không từ chữ đang gõ dở.
               */
              onChange={(event) =>
                setCode(flashcardDeckCodeDraft(event.target.value))
              }
              onBlur={() => setCode(flashcardDeckCodeSlug(code))}
              className="read-only:bg-surface-sunken read-only:text-text-secondary font-mono"
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
