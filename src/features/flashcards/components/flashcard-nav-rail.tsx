"use client";

import { useMemo, useState } from "react";
import { Layers, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  FlashcardDeckSummary,
  FlashcardSectionView,
} from "@/features/flashcards/server/queries";

/**
 * Cột trái điều hướng của màn Admin flashcard (`MULTIDECK-1e`).
 *
 * Vì sao dựng cột riêng thay vì giữ dải nút ngang cũ: trước đợt này mục lục là
 * 35 nút xếp NGANG trong một khung `overflow-x-auto`. Tìm "Buổi 27" nghĩa là
 * kéo ngang qua 26 nút, và khi một khoá có nhiều bộ thì trên cùng một dải ấy
 * còn phải nhét thêm một tầng nữa. Xếp DỌC thì 35 buổi vừa trong một màn 1024px
 * mà không cần kéo, và ô lọc cho phép nhảy thẳng bằng bàn phím — thứ mà màn
 * quản trị cần hơn là hoạt cảnh (`D-31` điểm 1).
 *
 * Cột này KHÔNG tự điều hướng: nó nhận `onSelect*` từ trình quản lý ở trên, nơi
 * giữ nguồn sự thật duy nhất về "đang chọn gì" — chính là URL.
 */
export function FlashcardNavRail({
  decks,
  selectedDeckId,
  sections,
  selectedSectionId,
  onSelectDeck,
  onSelectSection,
  onCreateDeck,
}: {
  decks: FlashcardDeckSummary[];
  selectedDeckId: string | null;
  sections: FlashcardSectionView[];
  selectedSectionId: string | null;
  onSelectDeck: (deckId: string) => void;
  onSelectSection: (sectionId: string) => void;
  onCreateDeck: () => void;
}) {
  const [query, setQuery] = useState("");

  /**
   * Lọc theo số buổi HOẶC tên buổi. Gõ `27` ra đúng buổi 27; gõ `ngân hàng` ra
   * mọi buổi có chữ đó. Bỏ dấu không xử lý ở đây — tên buổi do chính admin đặt
   * và họ gõ lại được y nguyên.
   */
  const visibleSections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sections;
    return sections.filter(
      (section) =>
        String(section.session_number).includes(needle) ||
        section.title.toLowerCase().includes(needle),
    );
  }, [sections, query]);

  return (
    /*
     * 🔴 `min-h-0` ở gốc là thứ giữ cho mục lục KHÔNG tràn xuống đáy trang.
     *
     * Cột trái (`<aside>`) chỉ đặt `max-h`, không đặt chiều cao xác định — nên
     * `h-full` ở đây rơi về `auto`, và một flex item không có `min-height` thì
     * chiều cao tối thiểu tự động của nó BẰNG chiều cao nội dung. Tức khối này
     * từ chối co lại, `overflow-y-auto` bên dưới không bao giờ có gì để cuộn,
     * và 35 buổi đổ tràn ra ngoài khung thẻ. `min-h-0` cho phép co về đúng
     * chiều cao cột, đẩy phần dư vào vùng cuộn của danh sách buổi.
     *
     * `h-full` vẫn giữ vì đường ngăn kéo (dưới 1024px) CÓ chiều cao xác định
     * (`inset-y-0` của `SheetContent`) — ở đó nó là thứ neo vùng cuộn.
     */
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/*
        Danh sách bộ thẻ không co (`shrink-0`): khi chỗ hẹp thì phần nhường lại
        phải là mục lục buổi — nó có vùng cuộn riêng, còn danh sách bộ thì không.
      */}
      <section
        aria-label="Bộ thẻ của khoá học"
        className="shrink-0 space-y-2"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-text-secondary text-xs font-semibold tracking-wide uppercase">
            Bộ thẻ ({decks.length})
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2"
            onClick={onCreateDeck}
          >
            <Plus className="size-4" aria-hidden />
            Thêm bộ
          </Button>
        </div>

        {decks.length === 0 ? (
          <p className="text-text-secondary text-sm">
            Khoá này chưa có bộ thẻ nào.
          </p>
        ) : (
          <ul className="space-y-1">
            {decks.map((deck) => {
              const active = deck.id === selectedDeckId;
              return (
                <li key={deck.id}>
                  <button
                    type="button"
                    aria-current={active ? "true" : undefined}
                    aria-label={`Bộ ${deck.title} — mã ${deck.code} — ${deck.publishedSectionCount}/${deck.sectionCount} buổi đã công bố`}
                    onClick={() => onSelectDeck(deck.id)}
                    className={cn(
                      "focus-visible:ring-ring flex w-full flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      active
                        ? "border-primary-300 bg-primary-50"
                        : "hover:bg-row-hover border-transparent",
                    )}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Layers
                        className={cn(
                          "size-4 shrink-0",
                          active ? "text-primary" : "text-text-secondary",
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 truncate">{deck.title}</span>
                    </span>
                    {/*
                      Mã bộ hiện ngay dưới tên: nó là TIỀN TỐ CỦA ĐỊA CHỈ QR, tức
                      thứ người dùng phải đối chiếu với bản in. Giấu nó vào hộp
                      thoại sửa là bắt họ mở ra mới biết mình đang ở bộ nào.
                    */}
                    <span className="text-text-secondary flex flex-wrap items-center gap-x-2 pl-6 font-mono text-xs">
                      <span>{deck.code}</span>
                      <span aria-hidden>·</span>
                      <span className="font-sans">
                        {deck.publishedSectionCount}/{deck.sectionCount} buổi đã
                        công bố
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedDeckId && sections.length > 0 && (
        <section
          aria-label="Mục lục buổi flashcard"
          /*
           * `min-h-64` chứ không `min-h-0`: đây là khối DUY NHẤT được co, nên
           * một khoá có nhiều bộ thẻ sẽ ép nó về gần 0 và mục lục biến mất.
           * Sàn 16rem chừa lại ~3 dòng buổi sau khi trừ tiêu đề, ô lọc và chú
           * giải; vượt sàn thì `<aside>` tự cuộn (van an toàn ở cấp trên).
           */
          className="flex min-h-64 flex-1 flex-col gap-2"
        >
          <h2 className="text-text-secondary text-xs font-semibold tracking-wide uppercase">
            Buổi ({sections.length})
          </h2>

          <div className="relative">
            <Search
              className="text-text-secondary pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-9 pl-8"
              placeholder="Nhảy tới buổi…"
              aria-label="Lọc mục lục buổi theo số hoặc tên"
            />
          </div>

          {visibleSections.length === 0 ? (
            <p className="text-text-secondary text-sm">
              Không có buổi nào khớp “{query.trim()}”.
            </p>
          ) : (
            /*
              Cuộn nằm TRONG cột này (`overflow-y-auto`), không đẩy cả trang —
              cùng lý do với bảng địa chỉ QR: khu soạn thẻ bên phải phải đứng yên
              trong lúc tìm buổi.

              `overscroll-contain`: cuộn hết danh sách thì DỪNG, không nối tiếp
              sang cuộn trang. Đây là vùng cuộn lồng, mà nối tiếp đúng lúc người
              dùng đang dò buổi thì cả trang nhảy đi mất chỗ đang nhìn.
            */
            <ul className="-mr-1 min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain pr-1">
              {visibleSections.map((section) => {
                const active = section.id === selectedSectionId;
                const published = section.status === "published";
                const empty = section.pages.length === 0;
                const statusLabel = published
                  ? "Đã công bố"
                  : empty
                    ? "Chưa có trang"
                    : "Bản nháp";
                return (
                  <li key={section.id}>
                    <button
                      type="button"
                      aria-current={active ? "true" : undefined}
                      /*
                        `aria-label` tường minh thay vì để trình duyệt ghép các
                        `<span>` lại: chúng nằm sát nhau nên tên tự tính ra
                        "1Chào hỏiChưa có trang" — đọc lên nghe dính chữ, và
                        trạng thái thì lẫn vào tên buổi.
                      */
                      aria-label={`Buổi ${section.session_number} — ${section.title} — ${statusLabel}`}
                      onClick={() => onSelectSection(section.id)}
                      className={cn(
                        "focus-visible:ring-ring flex min-h-11 w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-row-hover",
                      )}
                    >
                      {/*
                        Chấm trạng thái KHÔNG đứng một mình: mỗi chấm đi kèm chữ
                        trong `title`/`sr-only` vì màu không được là kênh thông
                        tin duy nhất (`color-not-only`).
                      */}
                      <span
                        aria-hidden
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          published
                            ? "bg-success"
                            : empty
                              ? "border-border-strong border bg-transparent"
                              : "bg-brand-orange",
                        )}
                      />
                      <span className="w-8 shrink-0 text-right font-mono tabular-nums">
                        {section.session_number}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {section.title}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="text-text-secondary flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="bg-success size-2 rounded-full" aria-hidden />
              Đã công bố
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="bg-brand-orange size-2 rounded-full"
                aria-hidden
              />
              Bản nháp
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className="border-border-strong size-2 rounded-full border"
                aria-hidden
              />
              Chưa có trang
            </span>
          </p>
        </section>
      )}
    </div>
  );
}
