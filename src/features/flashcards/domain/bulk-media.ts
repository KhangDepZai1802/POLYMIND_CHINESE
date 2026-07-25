import {
  flashcardMediaFormat,
  flashcardMediaSizeLimit,
  MAX_FLASHCARD_AUDIO_BYTES,
  MAX_FLASHCARD_IMAGE_BYTES,
} from "@/features/flashcards/domain/media";

/**
 * GẮN MEDIA HÀNG LOẠT CHO CẢ BUỔI (`P16-T11`).
 *
 * File này **thuần** — không React, không Supabase — nên mọi ca ghép nhầm đều
 * kiểm được bằng unit test, đúng mẫu `domain/bulk-import.ts` của `P16-T4`.
 *
 * Phạm vi khe: **chỉ `front` và `audio`** (user chốt 2026-07-24: không làm ảnh
 * mặt sau). Đây không phải chuyện cắt bớt cho nhanh — quy tắc "đuôi file quyết
 * định khe" bên dưới CHỈ chạy sạch khi có đúng một khe ảnh. Có thêm mặt sau thì
 * `.jpg` mang hai nghĩa và người soạn buộc phải gắn hậu tố cho mọi ảnh.
 */
export const BULK_MEDIA_SLOTS = ["front", "audio"] as const;
export type BulkMediaSlot = (typeof BULK_MEDIA_SLOTS)[number];

/**
 * Trần một lượt: 60 thẻ × 2 khe. Chặn ở đây để giao diện nói trước con số, chứ
 * không để người dùng phát hiện giới hạn qua một thông báo lỗi sau khi đã chọn.
 */
export const MAX_FLASHCARD_BULK_UPLOAD_FILES = 120;

export type BulkMediaFile = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type BulkMediaTarget = {
  pageId: string;
  /**
   * Số **đang hiện trên màn hình** (ô xám bên trái mỗi hàng, `index + 1`), tính
   * cả trang mở đầu. Cố ý KHÔNG đánh lại số riêng cho thẻ từ vựng — xem
   * `matchByNumber` bên dưới.
   */
  displayNumber: number;
  kind: "session_cover" | "vocabulary";
  hanzi: string | null;
  pinyinSyllables: string | null;
  hasFront: boolean;
  hasAudio: boolean;
};

/** Kế hoạch cho MỘT khe của MỘT thẻ. Mỗi trạng thái là một nhãn khác nhau. */
export type SlotPlan =
  /** Không file nào khớp, thẻ cũng chưa có gì. */
  | { state: "empty" }
  /** Không file nào khớp, thẻ đã có sẵn media — giữ nguyên. */
  | { state: "keep" }
  /** Có file khớp, thẻ đang trống → sẽ thêm. */
  | { state: "attach"; fileName: string }
  /** Có file khớp, thẻ đã có, ô Ghi đè BẬT → sẽ thay (xoá hẳn file cũ). */
  | { state: "replace"; fileName: string }
  /** Có file khớp, thẻ đã có, ô Ghi đè TẮT → bỏ qua, không ai mất gì. */
  | { state: "skip"; fileName: string };

export type BulkMediaRow = {
  target: BulkMediaTarget;
  front: SlotPlan;
  audio: SlotPlan;
};

export type UnmatchedReason =
  | "bad-format"
  | "too-large"
  | "no-match"
  | "collision"
  | "slot-taken"
  | "cover-page";

export type UnmatchedFile = {
  fileName: string;
  reason: UnmatchedReason;
  /** Câu tiếng Việt hiện thẳng cạnh tên file. */
  message: string;
};

export type BulkMediaPlan = {
  rows: BulkMediaRow[];
  unmatched: UnmatchedFile[];
};

/** Một dòng thật sự gửi lên server. */
export type BulkMediaUpload = {
  pageId: string;
  slot: BulkMediaSlot;
  fileName: string;
};

// =====================================================================
// Chuẩn hoá khoá
// =====================================================================

/**
 * `"hú luó bo"` → `"huluobo"`; `"nǚ"` → `"nu"`.
 *
 * NFD tách chữ khỏi dấu thanh rồi bỏ toàn bộ dấu (`U+0300…U+036F`), nên `ü` và
 * `ǖ` cùng về `u`. Hệ quả phải biết: `nǚ` và `nǔ` va nhau — chỗ đó
 * `matchByPinyin` trả về va chạm chứ không đoán bừa.
 */
export function normalizePinyinKey(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** `"bai-12.mp3"` → `"bai-12"`; `"胡萝卜.mp3"` → `"胡萝卜"`. */
function fileStem(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return (dot <= 0 ? fileName : fileName.slice(0, dot)).trim();
}

/**
 * Bỏ tiền tố đánh số: `"01-胡萝卜"` → `"胡萝卜"`, `"3. huluobo"` → `"huluobo"`.
 *
 * Chỉ bỏ khi CÒN LẠI thứ gì đó — `"03"` phải giữ nguyên để đi đường khớp theo
 * số thứ tự, chứ không biến thành chuỗi rỗng khớp với mọi thẻ.
 */
function stripIndexPrefix(stem: string): string {
  const stripped = stem.replace(/^\d+\s*[-_.)\s]\s*/, "").trim();
  return stripped === "" ? stem : stripped;
}

// =====================================================================
// Suy khe từ ĐUÔI FILE
// =====================================================================

/**
 * Đuôi file quyết định khe, người soạn không phải khai gì thêm.
 *
 * Cố ý hỏi ngược `flashcardMediaFormat` thay vì tự liệt kê lại danh sách đuôi:
 * hàm đó đã ép **khe và đuôi phải cùng loại** (`media.ts`), viết bản thứ hai ở
 * đây là tạo hai nguồn sự thật cho cùng một luật (`BUG_M10_01`).
 */
export function bulkMediaSlotOf(file: BulkMediaFile): BulkMediaSlot | null {
  if (flashcardMediaFormat("audio", file.fileName, file.mimeType)) {
    return "audio";
  }
  if (flashcardMediaFormat("front", file.fileName, file.mimeType)) {
    return "front";
  }
  return null;
}

// =====================================================================
// Ghép
// =====================================================================

type Matched =
  | { kind: "hit"; target: BulkMediaTarget }
  | { kind: "miss" }
  | { kind: "collision"; among: BulkMediaTarget[] };

function pick(candidates: BulkMediaTarget[]): Matched {
  if (candidates.length === 0) return { kind: "miss" };
  if (candidates.length === 1) return { kind: "hit", target: candidates[0]! };
  return { kind: "collision", among: candidates };
}

/**
 * Khớp theo **số đang hiện trên màn hình**, không đánh số lại cho thẻ từ vựng.
 *
 * 🔴 Cám dỗ là dồn lại cho đẹp (thẻ từ vựng đầu tiên = 1). Không làm: danh sách
 * Admin đánh số gồm cả trang mở đầu, nên dồn lại thì `01.mp3` của người soạn và
 * số 1 của hệ thống lệch nhau đúng một bậc → **mọi thẻ nhận audio của thẻ liền
 * kề**. Lệch một bậc trên toàn buổi là lỗi không ai nhìn ra bằng mắt.
 *
 * Giữ đúng số đang hiện thì `1.mp3` rơi vào trang mở đầu và bị từ chối bằng
 * chữ — lệch THẤY ĐƯỢC luôn tốt hơn lệch IM LẶNG.
 */
function matchByNumber(
  stem: string,
  targets: BulkMediaTarget[],
): Matched | null {
  if (!/^\d+$/.test(stem)) return null;
  const wanted = Number(stem);
  return pick(targets.filter((item) => item.displayNumber === wanted));
}

function matchByHanzi(stem: string, targets: BulkMediaTarget[]): Matched {
  return pick(targets.filter((item) => (item.hanzi ?? "").trim() === stem));
}

function matchByPinyin(stem: string, targets: BulkMediaTarget[]): Matched {
  const key = normalizePinyinKey(stem);
  if (key === "") return { kind: "miss" };
  return pick(
    targets.filter(
      (item) => normalizePinyinKey(item.pinyinSyllables ?? "") === key,
    ),
  );
}

function describeCollision(among: BulkMediaTarget[]): string {
  const names = among
    .map((item) => item.hanzi ?? `trang ${item.displayNumber}`)
    .join(" / ");
  return `Khớp cùng lúc ${among.length} thẻ (${names}) — gán tay để khỏi nhầm.`;
}

const SIZE_LABEL: Record<BulkMediaSlot, string> = {
  front: `Ảnh tối đa ${MAX_FLASHCARD_IMAGE_BYTES / (1024 * 1024)} MB.`,
  audio: `Audio tối đa ${MAX_FLASHCARD_AUDIO_BYTES / (1024 * 1024)} MB.`,
};

/**
 * Dựng bảng đối chiếu: mỗi thẻ một hàng, mỗi file rơi vào đúng một chỗ.
 *
 * `overrides` là các cặp người soạn tự gán tay (`fileName` → `pageId`); chúng
 * **thắng** phép ghép tự động, vì người soạn nhìn thấy dữ liệu thật còn thuật
 * toán chỉ nhìn thấy tên file.
 */
export function matchFlashcardMediaFiles(
  files: BulkMediaFile[],
  targets: BulkMediaTarget[],
  options: {
    allowOverwrite: boolean;
    overrides?: ReadonlyMap<string, string>;
  },
): BulkMediaPlan {
  const overrides = options.overrides ?? new Map<string, string>();
  const unmatched: UnmatchedFile[] = [];

  /** `pageId` → khe → tên file đã chiếm chỗ. */
  const claimed = new Map<string, Partial<Record<BulkMediaSlot, string>>>();
  const vocabulary = targets.filter((item) => item.kind === "vocabulary");

  const claim = (
    target: BulkMediaTarget,
    slot: BulkMediaSlot,
    fileName: string,
  ) => {
    const slots = claimed.get(target.pageId) ?? {};
    const taken = slots[slot];
    if (taken) {
      // Hai file tranh cùng một ô. KHÔNG lấy file đến trước: thứ tự file do hệ
      // điều hành quyết định, tức kết quả sẽ đổi giữa hai lần thả cùng bộ file.
      // Bỏ cả hai ra và nói rõ thì người soạn quyết định, và quyết định đó lặp lại được.
      unmatched.push({
        fileName,
        reason: "slot-taken",
        message: `Tranh chỗ với "${taken}" ở cùng một thẻ — giữ lại một file thôi.`,
      });
      return;
    }
    slots[slot] = fileName;
    claimed.set(target.pageId, slots);
  };

  // File được gán TAY đi trước file ghép tự động. Xử theo thứ tự người dùng thả
  // thì một file tự động có thể chiếm mất ô mà người soạn đã chỉ định tay, và
  // lựa chọn tay — thứ duy nhất ở đây có người thật đứng sau — lại thua.
  const ordered = [
    ...files.filter((file) => overrides.has(file.fileName)),
    ...files.filter((file) => !overrides.has(file.fileName)),
  ];

  for (const file of ordered) {
    const slot = bulkMediaSlotOf(file);
    if (!slot) {
      unmatched.push({
        fileName: file.fileName,
        reason: "bad-format",
        message: "Chỉ nhận ảnh JPG/PNG/WEBP hoặc audio MP3/M4A.",
      });
      continue;
    }
    if (file.sizeBytes > flashcardMediaSizeLimit(slot)) {
      unmatched.push({
        fileName: file.fileName,
        reason: "too-large",
        message: SIZE_LABEL[slot],
      });
      continue;
    }

    const forced = overrides.get(file.fileName);
    if (forced) {
      const target = targets.find((item) => item.pageId === forced);
      if (target && target.kind === "vocabulary") {
        claim(target, slot, file.fileName);
        continue;
      }
      // Gán tay vào trang mở đầu (hoặc trang vừa bị xoá ở tab khác): rơi xuống
      // đường tự động thay vì im lặng bỏ, để người soạn thấy file vẫn còn đó.
    }

    const stem = fileFullStem(file.fileName);
    const byNumber = matchByNumber(stem.raw, targets);
    const matched =
      byNumber ??
      (() => {
        const byHanzi = matchByHanzi(stem.stripped, vocabulary);
        if (byHanzi.kind !== "miss") return byHanzi;
        return matchByPinyin(stem.stripped, vocabulary);
      })();

    if (matched.kind === "collision") {
      unmatched.push({
        fileName: file.fileName,
        reason: "collision",
        message: describeCollision(matched.among),
      });
      continue;
    }
    if (matched.kind === "miss") {
      unmatched.push({
        fileName: file.fileName,
        reason: "no-match",
        message:
          "Không khớp thẻ nào — đổi tên theo Hán tự / pinyin không dấu / số thứ tự, hoặc gán tay.",
      });
      continue;
    }
    if (matched.target.kind === "session_cover") {
      unmatched.push({
        fileName: file.fileName,
        reason: "cover-page",
        message: `Số ${matched.target.displayNumber} là trang mở đầu — trang mở đầu không nhận media hàng loạt.`,
      });
      continue;
    }

    claim(matched.target, slot, file.fileName);
  }

  const rows: BulkMediaRow[] = targets
    .filter((target) => target.kind === "vocabulary")
    .map((target) => {
      const slots = claimed.get(target.pageId) ?? {};
      return {
        target,
        front: planFor(slots.front, target.hasFront, options.allowOverwrite),
        audio: planFor(slots.audio, target.hasAudio, options.allowOverwrite),
      };
    });

  return { rows, unmatched };
}

function fileFullStem(fileName: string) {
  const raw = fileStem(fileName);
  return { raw, stripped: stripIndexPrefix(raw) };
}

function planFor(
  fileName: string | undefined,
  hasExisting: boolean,
  allowOverwrite: boolean,
): SlotPlan {
  if (!fileName) return hasExisting ? { state: "keep" } : { state: "empty" };
  if (!hasExisting) return { state: "attach", fileName };
  return allowOverwrite
    ? { state: "replace", fileName }
    : { state: "skip", fileName };
}

// =====================================================================
// Đọc kế hoạch
// =====================================================================

/** Khe sẽ thật sự được ghi (thêm mới hoặc thay). */
export function plannedUploads(plan: BulkMediaPlan): BulkMediaUpload[] {
  const uploads: BulkMediaUpload[] = [];
  for (const row of plan.rows) {
    for (const slot of BULK_MEDIA_SLOTS) {
      const item = row[slot];
      if (item.state === "attach" || item.state === "replace") {
        uploads.push({
          pageId: row.target.pageId,
          slot,
          fileName: item.fileName,
        });
      }
    }
  }
  return uploads;
}

export type BulkMediaSummary = {
  /** Số THẺ sẽ đổi (không phải số file) — con số in trên nút xác nhận. */
  pageCount: number;
  attachCount: number;
  /** Số file cũ sẽ bị **xoá hẳn**. In riêng vì đây là vế không hoàn tác được. */
  replaceCount: number;
  skippedCount: number;
  unmatchedCount: number;
};

export function summarizeBulkMedia(plan: BulkMediaPlan): BulkMediaSummary {
  let attachCount = 0;
  let replaceCount = 0;
  let skippedCount = 0;
  let pageCount = 0;

  for (const row of plan.rows) {
    let touched = false;
    for (const slot of BULK_MEDIA_SLOTS) {
      const item = row[slot];
      if (item.state === "attach") {
        attachCount += 1;
        touched = true;
      } else if (item.state === "replace") {
        replaceCount += 1;
        touched = true;
      } else if (item.state === "skip") {
        skippedCount += 1;
      }
    }
    if (touched) pageCount += 1;
  }

  return {
    pageCount,
    attachCount,
    replaceCount,
    skippedCount,
    unmatchedCount: plan.unmatched.length,
  };
}
