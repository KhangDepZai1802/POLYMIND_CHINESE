"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { DataTable } from "@/components/shared/data-table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { FlashcardBulkMediaTab } from "@/features/flashcards/components/flashcard-bulk-media-tab";
import {
  importableRows,
  MAX_FLASHCARD_IMPORT_ROWS,
  parseFlashcardImportText,
} from "@/features/flashcards/domain/bulk-import";
import { importFlashcardVocabularyAction } from "@/features/flashcards/server/actions";
import type { FlashcardSectionView } from "@/features/flashcards/server/queries";

const PLACEHOLDER = [
  "胡萝卜 | hú luó bo | Củ cà rốt",
  "苹果 | píng guǒ | Quả táo | 我吃苹果。~wǒ chī píngguǒ~Tôi ăn táo. | 吃苹果~chī píngguǒ~ăn táo",
  "你好 | nǐ hǎo | Xin chào | 你好吗？~nǐ hǎo ma~Bạn khỏe không?;;你好，老师~nǐ hǎo lǎo shī~Chào thầy | 你好啊~nǐ hǎo a~Chào cậu",
].join("\n");

/**
 * Hai đường nhập hàng loạt của một buổi, gom vào MỘT dialog hai tab.
 *
 * Vì sao không tách thành nút thứ năm ở cụm nút của buổi (user chốt 2026-07-24):
 * cụm đó đã có bốn nút và CTA chính là "Công bố buổi" — thêm nút nữa vi phạm
 * `primary-action` và ở 375px thì xuống ba dòng. Quan trọng hơn: hai tab này là
 * **hai bước liên tiếp của cùng một việc** (dán chữ tạo thẻ → gắn ảnh/audio cho
 * chính những thẻ đó), nên đặt cạnh nhau đúng thứ tự thì bản thân giao diện đã
 * dạy quy trình.
 *
 * ⚠️ Đánh đổi: một tab **tạo** thẻ, một tab **sửa** thẻ. Chặn nhầm lẫn bằng câu
 * mô tả ngay đầu mỗi tab, không để người dùng phải suy ra từ nhãn.
 */
export function FlashcardImportDialog({
  deckId,
  section,
  existingKeys,
}: {
  deckId: string;
  section: FlashcardSectionView;
  /** Khoá `hanzi pinyin` của thẻ ĐÃ CÓ trong buổi — để xem trước báo "bỏ qua". */
  existingKeys: ReadonlySet<string>;
}) {
  const router = useRouter();
  const sectionId = section.id;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("text");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(
    () => parseFlashcardImportText(text, existingKeys),
    [text, existingKeys],
  );
  const ready = useMemo(() => importableRows(parsed), [parsed]);
  const brokenCount = parsed.length - ready.length;

  function reset() {
    setText("");
    setError(null);
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
        <Button type="button" variant="outline">
          <Upload className="size-4" aria-hidden />
          Nhập hàng loạt
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Nhập hàng loạt — Buổi {section.session_number}</DialogTitle>
          <DialogDescription>
            Dán danh sách chữ để tạo thẻ, rồi thả ảnh và audio để gắn cho chính
            những thẻ đó.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="text">Danh sách chữ</TabsTrigger>
            <TabsTrigger value="media">Ảnh &amp; Audio</TabsTrigger>
          </TabsList>

          <TabsContent value="media">
            <FlashcardBulkMediaTab
              deckId={deckId}
              section={section}
              onDone={() => setOpen(false)}
            />
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Mỗi dòng một thẻ, các cột ngăn nhau bằng Tab hoặc dấu <code>|</code>.
          Tối đa {MAX_FLASHCARD_IMPORT_ROWS} dòng mỗi lượt.
        </p>

        <Alert>
          <AlertDescription className="space-y-2">
            <span className="block">
              <strong>Ba cột đầu bắt buộc:</strong> Hán tự{" "}
              <code>|</code> pinyin tách âm tiết <code>|</code> nghĩa tiếng Việt.
              <br />
              <strong>Hai cột sau tuỳ chọn:</strong> câu ví dụ <code>|</code>{" "}
              cụm từ. Trong một cột, các mục ngăn nhau bằng{" "}
              <code>;;</code> và ba phần của mỗi mục ngăn nhau bằng{" "}
              <code>~</code> theo thứ tự Hán tự <code>~</code> pinyin{" "}
              <code>~</code> nghĩa.
            </span>
            <span className="block">
              Đường này <strong>chỉ nhập chữ</strong> — không nhập ảnh và audio.
              Thẻ tạo xong nằm ở bản nháp; bạn gắn audio cho từng thẻ ở màn soạn
              thẻ, và buổi chỉ công bố được khi mọi thẻ đã có audio.
            </span>
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label htmlFor="flashcard-import-text">Danh sách thẻ</Label>
          <Textarea
            id="flashcard-import-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={PLACEHOLDER}
            rows={8}
            className="font-mono"
            aria-describedby="flashcard-import-summary"
          />
          <p id="flashcard-import-summary" className="text-sm">
            {parsed.length === 0
              ? "Chưa dán dòng nào."
              : `${ready.length} dòng sẵn sàng · ${brokenCount} dòng bị bỏ qua.`}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {parsed.length > 0 && (
          <DataTable
            caption="Xem trước từng dòng trước khi tạo thẻ"
            minWidthClass="min-w-[52rem]"
          >
            <thead>
              <tr>
                <th scope="col">Dòng</th>
                <th scope="col">Hán tự</th>
                <th scope="col">Pinyin</th>
                <th scope="col">Nghĩa</th>
                <th scope="col">Câu ví dụ</th>
                <th scope="col">Cụm từ</th>
                <th scope="col">Tình trạng</th>
              </tr>
            </thead>
            <tbody>
              {parsed.map((item) => (
                <tr key={item.lineNumber}>
                  <td className="tabular-nums">{item.lineNumber}</td>
                  <td>{item.row?.hanzi ?? "—"}</td>
                  <td>{item.row?.pinyin_syllables ?? "—"}</td>
                  <td>{item.row?.meaning_vi ?? "—"}</td>
                  <td className="tabular-nums">
                    {item.row ? item.row.example_sentences.length : "—"}
                  </td>
                  <td className="tabular-nums">
                    {item.row ? item.row.common_phrases.length : "—"}
                  </td>
                  <td>
                    {/*
                      Trùng thẻ đã có KHÔNG phải lỗi người soạn phải đi sửa — nó
                      là kết quả bình thường của việc dán lại. Tô đỏ như lỗi thật
                      sẽ khiến người ta đi tìm chỗ hỏng không tồn tại.
                    */}
                    {item.duplicateOfExisting ? (
                      <span className="text-muted-foreground">
                        {item.error}
                      </span>
                    ) : item.error ? (
                      <span className="text-destructive">{item.error}</span>
                    ) : (
                      "Sẵn sàng"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}

        <DialogFooter>
          <Button
            type="button"
            disabled={pending || ready.length === 0}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await importFlashcardVocabularyAction({
                  sectionId,
                  rows: ready,
                });
                if (result.error) {
                  setError(result.error);
                  return;
                }
                toast.success(result.success);
                setOpen(false);
                reset();
                router.refresh();
              });
            }}
          >
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Tạo {ready.length} thẻ
          </Button>
        </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
