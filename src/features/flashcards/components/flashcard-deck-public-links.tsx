"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { useConfirmation } from "@/components/shared/confirmation-provider";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  flashcardFixedPublicToken,
  flashcardPublicUrl,
} from "@/features/flashcards/domain/public-link";
import { createFlashcardPublicLinksForDeckAction } from "@/features/flashcards/server/public-link-actions";
import type { FlashcardDeckView } from "@/features/flashcards/server/queries";
import { getPublicEnv } from "@/lib/env";

/**
 * Bảng "35 địa chỉ QR của cả bộ thẻ" (`D-39`).
 *
 * Vì sao có màn này thay vì bấm từng buổi ở panel bên dưới: người dùng thật của
 * nó không phải người soạn bài mà là **bên dàn trang sách** — họ cần đủ cả danh
 * sách trong một lần, dán được vào bảng tính, và cần nó TRƯỚC khi nội dung soạn
 * xong. Bấm 35 lần rồi chép tay 35 dòng là chỗ sinh ra sai sót không ai kiểm
 * lại được sau khi sách đã in.
 */
export function FlashcardDeckPublicLinks({
  deck,
  courseCode,
}: {
  deck: FlashcardDeckView;
  courseCode: string;
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

  /**
   * Địa chỉ lấy từ `NEXT_PUBLIC_APP_URL`, KHÔNG phải `window.location.origin` —
   * cùng lý do đã ghi ở `flashcard-public-link-panel.tsx`: admin có thể đang
   * mở `localhost`, mà mã QR in vào sách thì phải là domain thật.
   */
  const origin = getPublicEnv().NEXT_PUBLIC_APP_URL;

  const rows = useMemo(
    () =>
      deck.sections.map((section) => {
        const expected = flashcardFixedPublicToken(
          courseCode,
          section.session_number,
        );
        const current = section.publicLink?.token ?? null;
        return {
          id: section.id,
          sessionNumber: section.session_number,
          published: section.status === "published",
          expected,
          current,
          // Mã ngẫu nhiên phát hành trước `D-39`. Nó có thể đã nằm trên giấy
          // rồi nên KHÔNG bị thay lặng lẽ — phải hỏi.
          legacy: current !== null && expected !== null && current !== expected,
        };
      }),
    [deck.sections, courseCode],
  );

  const missing = rows.filter((row) => row.current === null).length;
  const legacy = rows.filter((row) => row.legacy).length;
  const unresolvable = rows.some((row) => row.expected === null);

  /** Dán thẳng vào bảng tính: một dòng một buổi, ngăn bằng Tab. */
  const clipboardText = rows
    .map((row) => {
      const token = row.current ?? row.expected;
      return token
        ? `Buổi ${row.sessionNumber}\t${flashcardPublicUrl(origin, token)}`
        : `Buổi ${row.sessionNumber}\t(chưa có mã)`;
    })
    .join("\n");

  async function createAll() {
    if (legacy > 0) {
      const ok = await confirm({
        title: `Thay ${legacy} mã cũ bằng mã cố định?`,
        description:
          `${legacy} buổi đang dùng mã ngẫu nhiên phát hành trước đây. Chuyển ` +
          "sang mã cố định sẽ THU HỒI những mã cũ đó — nếu chúng đã được in ở " +
          "đâu rồi thì bản in đó chết. Các buổi còn lại không bị ảnh hưởng.",
        confirmLabel: "Thay mã cũ",
        variant: "destructive",
      });
      if (!ok) return;
    }

    const data = new FormData();
    data.set("deckId", deck.id);
    if (legacy > 0) data.set("replaceLegacy", "true");
    startTransition(async () => {
      const result = await createFlashcardPublicLinksForDeckAction(data);
      if (result.error) toast.error(result.error);
      if (result.success) toast.success(result.success);
      router.refresh();
    });
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(clipboardText);
      setCopied(true);
    } catch {
      toast.error("Trình duyệt không cho sao chép. Bạn hãy chọn và chép tay.");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Link2 className="size-4" aria-hidden />
              Địa chỉ QR của cả bộ thẻ
            </h3>
            <p className="text-text-secondary mt-1 text-sm">
              Mã cố định theo mã khoá và số buổi, biết trước được nên đưa cho bên
              in ngay cả khi buổi còn nháp. Buổi chưa công bố thì người quét thấy
              trang “sắp mở”, công bố xong là nội dung tự hiện — không phải đổi
              mã.
            </p>
          </div>
          <StatusBadge
            label={
              missing === 0
                ? `Đủ ${rows.length}/${rows.length} buổi`
                : `Còn ${missing} buổi chưa có mã`
            }
            tone={missing === 0 ? "success" : "warning"}
          />
        </div>

        {unresolvable ? (
          <p className="text-danger-ink text-sm">
            Mã khoá “{courseCode}” không có chữ hoặc số nào nên không tạo được mã
            liên kết. Hãy sửa mã khoá trước.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={pending || unresolvable || (missing === 0 && legacy === 0)}
            onClick={createAll}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Link2 className="size-4" aria-hidden />
            )}
            {missing === 0 && legacy === 0
              ? "Đã đủ liên kết"
              : `Tạo liên kết cố định cho ${missing + legacy} buổi`}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={copyAll}
            disabled={rows.length === 0}
          >
            {copied ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <Copy className="size-4" aria-hidden />
            )}
            {copied ? "Đã chép" : "Chép cả danh sách"}
          </Button>
        </div>

        {/*
          Bảng cuộn ngang TRONG khung của nó (`overflow-x-auto`), không để địa
          chỉ dài đẩy cả trang admin tràn ngang trên điện thoại.
        */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-sm">
            <caption className="sr-only">
              Danh sách địa chỉ công khai theo từng buổi
            </caption>
            <thead>
              <tr className="text-text-secondary text-left">
                <th scope="col" className="py-1 pr-3 font-medium">
                  Buổi
                </th>
                <th scope="col" className="py-1 pr-3 font-medium">
                  Địa chỉ
                </th>
                <th scope="col" className="py-1 font-medium">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const token = row.current ?? row.expected;
                return (
                  <tr key={row.id} className="border-t">
                    <th scope="row" className="py-1.5 pr-3 text-left font-normal">
                      {row.sessionNumber}
                    </th>
                    <td className="py-1.5 pr-3">
                      <code className="font-mono text-xs whitespace-nowrap">
                        {token
                          ? flashcardPublicUrl(origin, token)
                          : "(chưa có mã)"}
                      </code>
                    </td>
                    <td className="py-1.5">
                      {row.current === null ? (
                        <span className="text-text-secondary">Chưa tạo</span>
                      ) : row.legacy ? (
                        <span className="text-danger-ink">Mã cũ</span>
                      ) : row.published ? (
                        <span>Đang chạy</span>
                      ) : (
                        <span className="text-text-secondary">
                          Sắp mở (chưa công bố)
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
