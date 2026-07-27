"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Link2Off, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useConfirmation } from "@/components/shared/confirmation-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { flashcardPublicUrl } from "@/features/flashcards/domain/public-link";
import { getPublicEnv } from "@/lib/env";
import {
  createFlashcardPublicLinkAction,
  revokeFlashcardPublicLinkAction,
} from "@/features/flashcards/server/public-link-actions";
import type { FlashcardSectionView } from "@/features/flashcards/server/queries";

/**
 * Khối "Chia sẻ công khai" của MỘT buổi flashcard (`D-36`, sửa bởi `D-39`).
 *
 * Admin lấy địa chỉ ở đây để đưa cho bên dàn trang in mã QR vào sách. Chủ ý
 * KHÔNG sinh ảnh QR trong sản phẩm: user tự lo phần in, và thêm một thư viện
 * chỉ để vẽ ô vuông đen trắng là gánh nặng không cần thiết.
 *
 * Từ `D-39`: buổi CÒN NHÁP cũng tạo được mã (mã cố định, biết trước được), và
 * người quét sớm thấy trang "sắp mở" thay vì 404. Cần cả danh sách của bộ thẻ
 * một lúc thì dùng `FlashcardDeckPublicLinks` ở đầu trang.
 */
export function FlashcardPublicLinkPanel({
  section,
}: {
  section: FlashcardSectionView;
}) {
  const router = useRouter();
  const confirm = useConfirmation();
  const [pending, startTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const link = section.publicLink;
  /**
   * Lấy từ `NEXT_PUBLIC_APP_URL`, KHÔNG phải `window.location.origin`.
   *
   * Hai lý do: (1) admin có thể đang mở bản preview hoặc `localhost`, mà mã QR
   * in vào sách thì phải là domain thật; (2) đọc `window` khi render sẽ lệch
   * giữa HTML máy chủ và HTML sau hydrate.
   */
  const url = link
    ? flashcardPublicUrl(getPublicEnv().NEXT_PUBLIC_APP_URL, link.token)
    : "";
  const isPublished = section.status === "published";

  function create() {
    const data = new FormData();
    data.set("sectionId", section.id);
    startTransition(async () => {
      const result = await createFlashcardPublicLinkAction(data);
      if (result.error) toast.error(result.error);
      if (result.success) toast.success(result.success);
      router.refresh();
    });
  }

  async function revoke() {
    if (!link) return;
    // Hậu quả ở đây là VẬT LÝ: sách đã in rồi thì mọi cuốn đang nằm trên kệ
    // đều quét ra trang báo hết hiệu lực. Phải nói thẳng trước khi bấm.
    //
    // ⚠️ Câu cuối đã đổi theo `D-39`: mã nay là CỐ ĐỊNH nên bấm tạo lại sẽ ra
    // đúng mã cũ (bật lại chính hàng đó). Bản cũ hứa ngược lại — giữ nguyên là
    // nói dối người dùng ở đúng lúc họ cần tin.
    const ok = await confirm({
      title: "Thu hồi liên kết công khai?",
      description:
        "Mã QR đã in trong sách sẽ NGỪNG hoạt động ngay lập tức, kể cả ảnh và " +
        "audio. Học sinh quét mã cũ sẽ thấy trang báo liên kết hết hiệu lực. " +
        "Bấm tạo lại sau này sẽ bật lại đúng mã này.",
      confirmLabel: "Thu hồi",
      variant: "destructive",
    });
    if (!ok) return;

    const data = new FormData();
    data.set("linkId", link.id);
    data.set("token", link.token);
    startTransition(async () => {
      const result = await revokeFlashcardPublicLinkAction(data);
      if (result.error) toast.error(result.error);
      if (result.success) toast.success(result.success);
      router.refresh();
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      toast.error("Trình duyệt không cho sao chép. Bạn hãy chọn và chép tay.");
    }
  }

  return (
    /*
     * Chữ phụ ở đây dùng `text-secondary`, KHÔNG phải `muted-foreground`.
     * Đo thật: `--muted-foreground` (#5B6B80) trên `--surface-sunken` (#E4EAF2)
     * chỉ đạt **4.4986:1** — hụt ngưỡng AA 4.5 và axe bắt đúng. `--text-secondary`
     * (#43536B) trên cùng nền đạt 6.45:1. Cùng bẫy với `DS-030`: token phụ được
     * chọn cho nền TRẮNG, đặt lên nền chìm là tụt xuống dưới ngưỡng.
     */
    <section
      aria-label="Chia sẻ công khai"
      className="bg-surface-sunken mt-3 rounded-xl border p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-2 text-sm font-semibold">
          <Link2 className="size-4" aria-hidden />
          Chia sẻ công khai (mã QR trong sách)
        </h4>
        <StatusBadge
          label={
            link
              ? isPublished
                ? "Đang công khai"
                : "Có mã — chờ công bố"
              : "Chưa công khai"
          }
          tone={link ? (isPublished ? "success" : "info") : "neutral"}
        />
      </div>

      {link ? (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <code
              data-testid="public-link-url"
              className="bg-card min-w-0 flex-1 overflow-x-auto rounded-lg border px-2 py-1.5 font-mono text-sm whitespace-nowrap"
            >
              {url}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copy}
            >
              {copied ? (
                <Check className="size-4" aria-hidden />
              ) : (
                <Copy className="size-4" aria-hidden />
              )}
              {copied ? "Đã chép" : "Sao chép"}
            </Button>
          </div>
          <p className="text-text-secondary text-sm">
            {isPublished
              ? "Ai có địa chỉ này đều xem được, không cần đăng nhập."
              : "Địa chỉ này đã dùng được để in mã QR. Người quét bây giờ thấy trang “sắp mở”; công bố buổi là nội dung hiện ra, không phải đổi mã."}
          </p>
          {/* Hành động phá huỷ tách khỏi cụm nút thường (`D-35` điểm 4). */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-danger-ink border-destructive/40"
            disabled={pending}
            onClick={revoke}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Link2Off className="size-4" aria-hidden />
            )}
            Thu hồi liên kết
          </Button>
        </div>
      ) : (
        <div className="mt-2 space-y-2">
          {!isPublished && (
            <p className="text-text-secondary text-sm">
              Buổi còn nháp vẫn tạo được mã để đưa bên in — người quét sẽ thấy
              trang “sắp mở” cho tới khi bạn công bố.
            </p>
          )}
          <Button type="button" size="sm" disabled={pending} onClick={create}>
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Link2 className="size-4" aria-hidden />
            )}
            Tạo liên kết công khai
          </Button>
        </div>
      )}
    </section>
  );
}
