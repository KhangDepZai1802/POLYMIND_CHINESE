import Image from "next/image";

import {
  alignPinyinToHanzi,
  joinPinyin,
} from "@/features/flashcards/domain/pinyin";
import { readFlashcardSublists } from "@/features/flashcards/domain/sublists";
import type { FlashcardPageView } from "@/features/flashcards/server/queries";

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

export function FlashcardFaceContent({
  page,
  face,
  priority = false,
}: {
  page: FlashcardPageView;
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
  page: FlashcardPageView;
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
    <div className="relative h-full min-h-[360px] w-full sm:min-h-[560px]">
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
 * Mặt trước §7ter: pinyin căn thẳng TRÊN TỪNG chữ Hán, Hán tự cỡ lớn nhất,
 * nghĩa tiếng Việt màu cam, ảnh minh hoạ tuỳ chọn.
 */
function VocabularyFront({ page }: { page: FlashcardPageView }) {
  const hanzi = page.hanzi ?? "";
  const pinyin = page.pinyin_syllables ?? "";
  const alignment = alignPinyinToHanzi(hanzi, pinyin);
  const imageUrl = page.frontUrl;

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-5 p-6 text-center sm:min-h-[560px] sm:p-8">
      {alignment ? (
        <p className="flex flex-wrap items-end justify-center gap-x-3 gap-y-4">
          {alignment.map((cell, index) => (
            <span
              key={`${cell.hanzi}-${index}`}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-muted-foreground text-lg leading-none sm:text-xl">
                {cell.pinyin}
              </span>
              <span className="text-5xl leading-none font-bold sm:text-7xl">
                {cell.hanzi}
              </span>
            </span>
          ))}
        </p>
      ) : (
        // Số âm tiết không khớp số chữ Hán: hiện pinyin nguyên dòng thay vì căn
        // lệch. Sai lệch nhìn thấy được tốt hơn sai lệch im lặng.
        <>
          <p className="text-muted-foreground text-lg break-words sm:text-xl">
            {pinyin}
          </p>
          <p className="text-5xl leading-tight font-bold break-words sm:text-7xl">
            {hanzi}
          </p>
        </>
      )}

      <p className="text-student-amber-ink text-2xl font-semibold break-words sm:text-3xl">
        {page.meaning_vi}
      </p>

      {imageUrl && (
        <Image
          src={imageUrl}
          alt={page.front_alt ?? ""}
          width={320}
          height={220}
          unoptimized
          className="h-auto max-h-56 w-auto max-w-full rounded-xl object-contain"
        />
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
    <section className={`rounded-xl border-2 p-3 ${BACK_BLOCK_TONE[tone]}`}>
      <h3 className="mb-2 text-sm font-semibold tracking-wide uppercase">
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
      <p className="text-lg font-semibold break-words">{hanzi}</p>
      <p className="text-muted-foreground text-sm break-words">{pinyin}</p>
      <p className="text-sm break-words">{meaningVi}</p>
    </>
  );
}

/**
 * Mặt sau §7ter: 4 khối, mỗi khối một màu viền.
 *
 * Khối "Tách nghĩa" (vốn là khối 3) đã BỎ theo yêu cầu user 2026-07-24.
 */
function VocabularyBack({ page }: { page: FlashcardPageView }) {
  const { examples, phrases } = readFlashcardSublists(page);
  const hanzi = page.hanzi ?? "";
  // Mặt sau dùng pinyin VIẾT LIỀN — dẫn xuất từ dạng tách, không phải cột riêng.
  const joined = joinPinyin(page.pinyin_syllables ?? "");
  const backImageUrl = page.backUrl;

  return (
    <div className="flex min-h-[360px] flex-col gap-3 p-4 sm:min-h-[560px] sm:p-6">
      {/* Khối 1 — đầu thẻ */}
      <BackBlock title="Thẻ" tone="neutral">
        <p className="text-2xl font-bold break-words sm:text-3xl">
          {hanzi}
          {joined ? (
            <span className="text-muted-foreground font-normal">
              {" — "}
              {joined}
            </span>
          ) : null}
        </p>
      </BackBlock>

      {/* Khối 2 — nghĩa */}
      <BackBlock title="Nghĩa" tone="cyan">
        <div className="flex flex-wrap items-center gap-3">
          <p className="min-w-0 flex-1 text-lg font-semibold break-words">
            {page.meaning_vi}
          </p>
          {backImageUrl && (
            <Image
              src={backImageUrl}
              alt={page.back_alt ?? ""}
              width={120}
              height={90}
              unoptimized
              className="h-auto max-h-24 w-auto rounded-lg object-contain"
            />
          )}
        </div>
      </BackBlock>

      {/* Khối 3 — câu ví dụ */}
      {examples.length > 0 && (
        <BackBlock title="Câu ví dụ" tone="coral">
          <ul className="space-y-3">
            {examples.map((item, index) => {
              const url = item.image_path
                ? page.mediaUrls[item.image_path]
                : null;
              return (
                <li
                  key={`${item.hanzi}-${index}`}
                  className="flex flex-wrap items-start gap-3"
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
                      className="h-auto max-h-20 w-auto rounded-lg object-contain"
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
          <ul className="space-y-2">
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
    </div>
  );
}
