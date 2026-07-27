import Image from "next/image";

import { FitText } from "@/features/flashcards/components/fit-text";
import { joinPinyin } from "@/features/flashcards/domain/pinyin";
import { readFlashcardSublists } from "@/features/flashcards/domain/sublists";

/**
 * MẶT THẺ — nguồn sự thật DUY NHẤT cho cả màn học viên lẫn màn Quản trị.
 *
 * Trước đợt này khối vẽ mặt thẻ nằm trong `student-flashcard-reader.tsx`, còn
 * màn Quản trị chỉ hiện hai ô `MediaPreview` (ảnh thô + chữ "Không có ảnh") —
 * tức admin **không nhìn thấy thứ học viên nhìn thấy**. Vẽ thêm một bản thứ hai
 * cho Quản trị sẽ tạo đúng hình dạng `BUG_M10_01` (hai đường code cùng dựng một
 * thứ, rồi trôi khác nhau ở chỗ nhìn thấy được). Nên nó được tách ra đây và
 * **cả hai màn cùng gọi**.
 *
 * ⚠️ Ghi để lần sau không ai "sửa cho đúng luật": file này dùng palette
 * `student-*` dù màn Quản trị cũng gọi. `D-28`/`DS-027` cấm mượn palette
 * `student-*` cho **giao diện Quản trị** — còn đây là bản dựng lại chính **bề
 * mặt học viên** để admin xem trước, nên nó phải giống hệt. Đổi màu ở đây là làm
 * hỏng đúng mục đích của việc xem trước.
 */

export type Face = "front" | "back";

/**
 * Đúng những trường mặt thẻ THẬT SỰ đọc — không hơn.
 *
 * Trước đây prop là `FlashcardPageView` (= `PageRow & {…}`), tức kéo theo cả
 * `id`, `section_id`, `created_by`. Payload của **trang công khai** cố ý không
 * mang UUID nào (`…080`), nên nếu giữ kiểu rộng thì trang công khai buộc phải
 * bịa ra UUID giả chỉ để hợp kiểu — vừa vô nghĩa vừa mở đường cho UUID thật lọt
 * ra sau này. `FlashcardPageView` vẫn thoả kiểu này về mặt cấu trúc nên hai màn
 * cũ không phải sửa gì.
 */
export type FlashcardFaceData = {
  kind: "session_cover" | "vocabulary";
  hanzi: string | null;
  pinyin_syllables: string | null;
  meaning_vi: string | null;
  front_alt: string | null;
  back_alt: string | null;
  example_sentences: unknown;
  common_phrases: unknown;
  frontUrl: string | null;
  backUrl: string | null;
  mediaUrls: Record<string, string>;
};

/**
 * Chữ Hán phải tự khai `lang="zh-Hans"`.
 *
 * `<html lang="vi">` nên nếu không khai lại ở đây, trình duyệt Android (không
 * có "PingFang SC"/"Noto Sans SC" đúng tên, chỉ có Noto Sans CJK gộp chung) sẽ
 * chọn biến thể glyph theo tiếng Việt → rơi về hình dạng **tiếng Nhật** với
 * những chữ khác nhau giữa hai vùng (骨, 直, 今). Sai chữ, trên đúng cái sản phẩm
 * dạy chữ. Kèm `.font-hanzi` để ưu tiên font CJK trước Be Vietnam Pro.
 */
const HANZI_ATTRS = { lang: "zh-Hans" } as const;

export function FlashcardFaceContent({
  page,
  face,
  priority = false,
}: {
  page: FlashcardFaceData;
  face: Face;
  priority?: boolean;
}) {
  // Trang mở đầu giữ nguyên mô hình hai ảnh (chốt `Q5`) — không đổi một chút nào.
  if (page.kind === "session_cover") {
    return (
      <FlashcardImageFace
        url={face === "front" ? page.frontUrl : page.backUrl}
        alt={face === "front" ? page.front_alt : page.back_alt}
        label={face === "front" ? "Mặt trước" : "Mặt sau"}
        priority={priority && face === "front"}
      />
    );
  }
  return face === "front" ? (
    <VocabularyFront page={page} />
  ) : (
    <VocabularyBack page={page} />
  );
}

/**
 * Một mặt thẻ đứng riêng, có viền và nền như thẻ thật.
 *
 * Dùng cho màn Quản trị (ô thu nhỏ + dialog phóng to). Màn học viên **không**
 * dùng khối này vì nó cần hai mặt chồng nhau để lật 3D — nhưng cả hai đều đi qua
 * `FlashcardFaceContent` ở trên, nên nội dung không thể lệch nhau.
 */
export function FlashcardFaceCard({
  page,
  face,
  className = "",
}: {
  page: FlashcardFaceData;
  face: Face;
  className?: string;
}) {
  return (
    <div className={`bg-card rounded-2xl border shadow-sm ${className}`}>
      <FlashcardFaceContent page={page} face={face} />
    </div>
  );
}

function FlashcardImageFace({
  url,
  alt,
  label,
  priority,
}: {
  url: string | null;
  alt: string | null;
  label: string;
  priority: boolean;
}) {
  return (
    /*
     * `data-fc-image-face` là MỎ NEO cho trang công khai `/t/<mã>`, không phải
     * thuộc tính trang trí.
     *
     * Khối này chỉ có chiều cao nhờ `--fc-face-min-h` (360/560px ở màn học viên
     * và Quản trị) vì ảnh bên trong dùng `fill` — tức `position:absolute`, KHÔNG
     * đẩy được chiều cao nào. Trang công khai cố ý đặt biến đó về `0px` (thẻ cao
     * theo nội dung, xem `public-flashcard.css`), nên trang mở đầu — thứ duy nhất
     * còn là ẢNH — sụp xuống còn 2px viền: học sinh quét mã QR thấy **thẻ 1/18
     * trắng tinh**. Đó là lỗi thật user báo 2026-07-25.
     *
     * Chiều cao được cấp lại bằng `aspect-ratio` trong `public-flashcard.css`;
     * neo bằng data-attribute chứ không bằng class Tailwind vì đây là thứ CHỈ
     * trang công khai ghi đè, và ghi đè theo cấu trúc DOM (`div > img`) thì hỏng
     * ngay lần ai đó bọc thêm một lớp.
     */
    <div
      data-fc-image-face
      className="relative h-full min-h-[var(--fc-face-min-h)] w-full"
    >
      {url ? (
        <Image
          src={url}
          alt={alt ?? ""}
          fill
          sizes="(max-width: 768px) 80vw, 680px"
          unoptimized
          // Mobile giữ nguyên khung đầy; desktop thu gọn để thấy trọn ảnh.
          className="object-cover sm:object-contain"
          priority={priority}
        />
      ) : (
        <div className="bg-muted text-muted-foreground flex h-full items-center justify-center p-6 text-center">
          Không tải được ảnh {label.toLowerCase()}.
        </div>
      )}
    </div>
  );
}

/**
 * MẶT TRƯỚC — dựng lại 2026-07-25 theo phân tích của user trên ảnh máy thật.
 *
 * Bốn điều user chốt, và lý do từng điều:
 *
 * 1. **Thứ tự: Hán tự → pinyin → nghĩa.** Bản cũ đặt pinyin LÊN TRÊN từng chữ
 *    Hán (`§7ter`, đặc tả gốc từ ảnh thẻ mẫu). Nay ba dòng nằm riêng, xếp dọc.
 *
 * 2. **Pinyin là dòng TO NHẤT**, nghĩa tiếng Việt ở giữa, Hán tự giữ cỡ cũ —
 *    thang chữ ở `globals.css`. User: pinyin là thứ học sinh đọc theo để phát âm.
 *
 * 3. 🔴 **Khoảng cách giữa các chữ Hán KHÔNG còn phụ thuộc độ dài pinyin.** Đây
 *    là hệ quả trực tiếp của (1), không phải một mẹo CSS: bản cũ dựng mỗi cặp
 *    (âm tiết, chữ Hán) thành MỘT CỘT, nên một âm tiết dài như `sheng` nới cột đó
 *    ra và **đẩy hai chữ Hán xa nhau** (thấy rõ trên ảnh: 先 và 生 cách nhau cả
 *    một khoảng trống). Nay Hán tự là một chuỗi liền `先生` — chữ CJK vốn không có
 *    khoảng cách giữa các glyph, nên chúng sát nhau bất kể pinyin dài ngắn.
 *
 * 4. **Ba dòng chữ NGAY TRÊN ảnh, phần chữ ở gần tâm thẻ.** Bản cũ cho khối ảnh
 *    `flex-1` — nó chiếm hết chỗ dư rồi căn ảnh vào giữa phần đó, nên chữ bị đẩy
 *    lên đỉnh và giữa chữ với ảnh hở ra một khoảng rất lớn. Nay `mt-auto` đặt
 *    khoảng dư ở TRÊN nhóm nội dung, còn ảnh **chỉ co, không giãn** (`shrink` +
 *    `min-h-0`). Vì vậy chữ nằm sát ngay trên ảnh và tiến gần tâm thẻ hơn
 *    (`whitespace-balance`: khoảng trắng dùng để GOM nhóm liên quan, không phải
 *    để tách chúng ra).
 *
 * ⚠️ `§7ter` (pinyin căn trên từng chữ Hán) vì thế **hết hiệu lực** — xem
 * `docs/10-yeu-cau-flashcard-quizlet.md`. Mặt SAU không đổi: vẫn pinyin viết liền.
 */
function VocabularyFront({ page }: { page: FlashcardFaceData }) {
  const imageUrl = page.frontUrl;

  return (
    <div className="flex h-full min-h-[var(--fc-face-min-h)] flex-col items-center gap-2 p-4 text-center sm:gap-3 sm:p-6">
      {/* 1 — Hán tự. `mt-auto` gom toàn bộ khoảng dư lên trên để khối chữ tiến
          gần tâm thẻ nhưng vẫn nằm sát ảnh. Inline `fontSize` là có chủ ý:
          `.font-hanzi` là CSS không thuộc cascade layer nên thắng utility
          Tailwind cùng specificity; nếu dùng class `text-[…]`, biến `--fc-hanzi`
          không có hiệu lực và cỡ thật luôn mắc ở 1.08em. */}
      <p
        {...HANZI_ATTRS}
        className="font-hanzi mt-auto leading-none font-bold break-words"
        style={{ fontSize: "var(--fc-hanzi)" }}
      >
        {page.hanzi}
      </p>

      {/* 2 — Pinyin, dòng TO NHẤT. Giữ dạng tách âm tiết vì đó là cách viết
          pinyin đúng; chỉ khác là nó không còn bị chẻ theo từng chữ Hán. */}
      <p className="text-text-secondary text-[length:var(--fc-pinyin)] leading-tight font-semibold break-words">
        {page.pinyin_syllables}
      </p>

      {/* 3 — Nghĩa tiếng Việt, cam thương hiệu (giữ nguyên từ `§7ter`). */}
      <p className="text-student-amber-ink text-[length:var(--fc-meaning)] leading-tight font-semibold break-words">
        {page.meaning_vi}
      </p>

      {imageUrl && (
        /*
         * `shrink` + `min-h-0` và KHÔNG `flex-1`: ảnh nhường chỗ khi thẻ thấp,
         * nhưng không bao giờ tự nở ra để đẩy chữ đi. `min-h-0` là bắt buộc —
         * thiếu nó thì flex item không co được dưới kích thước nội dung.
         */
        <div className="flex min-h-0 w-full shrink items-center justify-center">
          <Image
            src={imageUrl}
            alt={page.front_alt ?? ""}
            width={320}
            height={220}
            unoptimized
            className="h-auto max-h-full w-auto max-w-full rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
}

// `sky` đã bỏ cùng khối "Tách nghĩa" — không giữ tông màu không ai dùng.
type BackBlockTone = "neutral" | "cyan" | "coral" | "amber";

const BACK_BLOCK_TONE: Record<BackBlockTone, string> = {
  neutral: "bg-muted border-border",
  cyan: "bg-student-cyan-surface border-student-cyan-border",
  coral: "bg-student-coral-surface border-student-coral-border",
  amber: "bg-student-amber-surface border-student-amber-border",
};

function BackBlock({
  title,
  tone,
  children,
}: {
  title: string;
  tone: BackBlockTone;
  children: React.ReactNode;
}) {
  return (
    /*
     * `grow` chứ KHÔNG phải `flex-1` (user chốt 2026-07-25: bốn ô màu phải lấn
     * xuống khoảng trắng dư ở đáy thẻ).
     *
     * `flex-1` là `flex: 1 1 0%` — cơ sở 0 nên cả bốn ô cao BẰNG NHAU bất kể
     * nội dung, khối "Nghĩa" một dòng sẽ cao ngang khối "Câu ví dụ" bốn dòng.
     * `grow` giữ cơ sở `auto` (cao theo nội dung) rồi chia ĐỀU phần dư — đúng
     * thứ cần: không còn khoảng trắng, mà tỉ lệ giữa các khối vẫn hợp lý.
     */
    /*
     * Cỡ chữ/khoảng cách của cả mặt sau khai bằng `em`, KHÔNG `rem` — bắt buộc
     * để `FitText` thu nhỏ được (xem `fit-text.tsx`). `rem` neo vào `<html>` nên
     * sẽ phớt lờ việc thu nhỏ. Giá trị `em` chọn khớp đúng cỡ `rem` cũ nên ở tỉ
     * lệ 1 (màn Quản trị, thẻ ngắn) không đổi một pixel.
     */
    <section
      className={`grow rounded-xl border-2 p-[0.75em] ${BACK_BLOCK_TONE[tone]}`}
    >
      <h3 className="mb-[0.5em] text-[0.875em] font-semibold tracking-wide uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Một dòng của danh sách con: Hán tự · pinyin · nghĩa. */
function SublistLine({
  hanzi,
  pinyin,
  meaningVi,
}: {
  hanzi: string;
  pinyin: string;
  meaningVi: string;
}) {
  return (
    <>
      <p
        {...HANZI_ATTRS}
        className="font-hanzi text-[1.125em] font-semibold break-words"
      >
        {hanzi}
      </p>
      <p className="text-muted-foreground text-[0.875em] break-words">
        {pinyin}
      </p>
      <p className="text-[0.875em] break-words">{meaningVi}</p>
    </>
  );
}

/**
 * Mặt sau §7ter: 4 khối, mỗi khối một màu viền.
 *
 * Khối "Tách nghĩa" (vốn là khối 3) đã BỎ theo yêu cầu user 2026-07-24.
 */
function VocabularyBack({ page }: { page: FlashcardFaceData }) {
  const { examples, phrases } = readFlashcardSublists(page);
  const hanzi = page.hanzi ?? "";
  // Mặt sau dùng pinyin VIẾT LIỀN — dẫn xuất từ dạng tách, không phải cột riêng.
  const joined = joinPinyin(page.pinyin_syllables ?? "");

  return (
    /*
     * `FitText` thu cỡ chữ cho vừa chiều cao vùng thẻ (user chốt 2026-07-25).
     * Mọi cỡ chữ bên trong vì thế khai bằng `em`.
     */
    <FitText
      // `key` ⇒ sang thẻ khác là đo lại cỡ chữ từ đầu.
      key={`${page.hanzi ?? ""}-${page.meaning_vi ?? ""}`}
      className="flex flex-col gap-[0.75em] p-[1em] sm:p-[1.5em]"
    >
      {/* Khối 1 — đầu thẻ */}
      <BackBlock title="Thẻ" tone="neutral">
        <p className="text-[1.5em] font-bold break-words sm:text-[1.875em]">
          <span {...HANZI_ATTRS} className="font-hanzi">
            {hanzi}
          </span>
          {joined ? (
            <span className="text-muted-foreground font-normal">
              {" — "}
              {joined}
            </span>
          ) : null}
        </p>
      </BackBlock>

      {/* Khối 2 — nghĩa. Không còn ảnh mặt sau: user đổi cơ chế (`…078`). */}
      <BackBlock title="Nghĩa" tone="cyan">
        <p className="text-[1.125em] font-semibold break-words">
          {page.meaning_vi}
        </p>
      </BackBlock>

      {/* Khối 3 — câu ví dụ */}
      {examples.length > 0 && (
        <BackBlock title="Câu ví dụ" tone="coral">
          <ul className="space-y-[0.75em]">
            {examples.map((item, index) => {
              const url = item.image_path
                ? page.mediaUrls[item.image_path]
                : null;
              return (
                <li
                  key={`${item.hanzi}-${index}`}
                  className="flex flex-wrap items-start gap-[0.75em]"
                >
                  <div className="min-w-0 flex-1">
                    <SublistLine
                      hanzi={item.hanzi}
                      pinyin={item.pinyin}
                      meaningVi={item.meaning_vi}
                    />
                  </div>
                  {url && (
                    <Image
                      src={url}
                      alt={`Ảnh minh hoạ câu ví dụ ${index + 1} của ${hanzi}`}
                      width={110}
                      height={80}
                      unoptimized
                      className="h-auto max-h-[5em] w-auto rounded-lg object-contain"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </BackBlock>
      )}

      {/* Khối 4 — cụm từ thường dùng */}
      {phrases.length > 0 && (
        <BackBlock title="Cụm từ thường dùng" tone="amber">
          <ul className="space-y-[0.5em] text-[1em]">
            {phrases.map((item, index) => (
              <li key={`${item.hanzi}-${index}`} className="break-words">
                <span className="font-semibold">{item.hanzi}</span>
                <span className="text-muted-foreground"> — {item.pinyin}</span>
                <span> — {item.meaning_vi}</span>
              </li>
            ))}
          </ul>
        </BackBlock>
      )}
    </FitText>
  );
}
