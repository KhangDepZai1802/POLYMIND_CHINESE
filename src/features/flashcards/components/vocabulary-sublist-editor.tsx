"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Một mục của ba danh sách con §7ter. Khối "Câu ví dụ" có thêm ảnh; hai khối kia
 * dùng chung đúng component này để không sinh ra hai bản gần giống nhau rồi trôi
 * khác nhau — đúng hình dạng hỏng của `UX-UIUX-M25-010`.
 */
export type SublistDraft = {
  /** Khoá React ổn định; KHÔNG gửi lên server. */
  key: string;
  hanzi: string;
  pinyin: string;
  meaning_vi: string;
  /** Chỉ dùng cho khối "Câu ví dụ". */
  image_path: string | null;
  /** File vừa chọn, chưa tải lên. Chỉ dùng cho khối "Câu ví dụ". */
  file?: File;
};

export function emptySublistDraft(): SublistDraft {
  return {
    key: crypto.randomUUID(),
    hanzi: "",
    pinyin: "",
    meaning_vi: "",
    image_path: null,
  };
}

export function VocabularySublistEditor({
  idPrefix,
  legend,
  description,
  itemNoun,
  hanziLabel,
  meaningLabel,
  items,
  max,
  withImage = false,
  onChange,
}: {
  idPrefix: string;
  legend: string;
  description: string;
  /** Danh từ số ít dùng trong nhãn nút: "câu ví dụ", "thành tố", "cụm từ". */
  itemNoun: string;
  hanziLabel: string;
  meaningLabel: string;
  items: SublistDraft[];
  max: number;
  withImage?: boolean;
  onChange: (next: SublistDraft[]) => void;
}) {
  function update(index: number, patch: Partial<SublistDraft>) {
    onChange(
      items.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target]!, next[index]!];
    onChange(next);
  }

  return (
    <fieldset className="space-y-3 rounded-lg border p-3">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
      <p className="text-muted-foreground text-sm">{description}</p>

      {items.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Chưa có mục nào. Khối này được phép để trống.
        </p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, index) => {
            const rowId = `${idPrefix}-${item.key}`;
            const position = index + 1;
            return (
              <li key={item.key} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {itemNoun} {position}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === 0}
                      aria-label={`Đưa ${itemNoun} ${position} lên`}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={index === items.length - 1}
                      aria-label={`Đưa ${itemNoun} ${position} xuống`}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      aria-label={`Xoá ${itemNoun} ${position}`}
                      onClick={() =>
                        onChange(items.filter((_, at) => at !== index))
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor={`${rowId}-hanzi`}>{hanziLabel}</Label>
                    <Input
                      id={`${rowId}-hanzi`}
                      value={item.hanzi}
                      onChange={(event) =>
                        update(index, { hanzi: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${rowId}-pinyin`}>Pinyin</Label>
                    <Input
                      id={`${rowId}-pinyin`}
                      value={item.pinyin}
                      onChange={(event) =>
                        update(index, { pinyin: event.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${rowId}-meaning`}>{meaningLabel}</Label>
                    <Input
                      id={`${rowId}-meaning`}
                      value={item.meaning_vi}
                      onChange={(event) =>
                        update(index, { meaning_vi: event.target.value })
                      }
                    />
                  </div>

                  {withImage && (
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`${rowId}-image`}>
                        Ảnh minh hoạ (tuỳ chọn)
                      </Label>
                      <Input
                        id={`${rowId}-image`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) =>
                          update(index, {
                            file: event.target.files?.[0] ?? undefined,
                          })
                        }
                      />
                      {item.image_path && !item.file && (
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="text-muted-foreground text-sm">
                            Đang dùng ảnh đã tải. Chọn file mới để thay.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            aria-label={`Bỏ ảnh của ${itemNoun} ${position}`}
                            onClick={() =>
                              update(index, { image_path: null, file: undefined })
                            }
                          >
                            Bỏ ảnh
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Button
        type="button"
        variant="outline"
        disabled={items.length >= max}
        onClick={() => onChange([...items, emptySublistDraft()])}
      >
        <Plus className="size-4" aria-hidden />
        Thêm {itemNoun}
      </Button>
      {items.length >= max && (
        <p className="text-muted-foreground text-sm">
          Đã đạt tối đa {max} mục cho khối này.
        </p>
      )}
    </fieldset>
  );
}
