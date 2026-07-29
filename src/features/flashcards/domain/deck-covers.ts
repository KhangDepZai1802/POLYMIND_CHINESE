import {
  flashcardMediaFormat,
  flashcardMediaSizeLimit,
  MAX_FLASHCARD_IMAGE_BYTES,
} from "@/features/flashcards/domain/media";

/**
 * NHẬP HÀNG LOẠT ẢNH TRANG MỞ ĐẦU CHO CẢ BỘ THẺ (`COVER-1`/`D-41`).
 *
 * File này **thuần** — không React, không Supabase — nên mọi ca ghép nhầm đều
 * kiểm được bằng unit test, đúng mẫu `domain/bulk-media.ts` (`P16-T11`) và
 * `domain/bulk-import.ts` (`P16-T4`).
 *
 * 🔴 KHÁC `bulk-media.ts` ở ĐƠN VỊ, không phải ở quy mô: ở đó một lượt nhắm vào
 * MỘT buổi và ghép file với từng THẺ; ở đây một lượt nhắm vào cả BỘ và ghép file
 * với từng BUỔI. Vì vậy không dùng lại được `matchFlashcardMediaFiles` — khoá
 * ghép khác hẳn (số buổi vs Hán tự/pinyin/số thứ tự thẻ) và trạng thái hàng có
 * thêm một giá trị mà bên kia không có: **buổi đã công bố**.
 *
 * Mỗi buổi nhận ĐÚNG MỘT ảnh (`D-41` điểm 3): trang mở đầu nay dùng một file cho
 * cả hai mặt, nên không còn khe `back` để mà tranh chấp — và cũng nhờ vậy tên
 * file không cần hậu tố phân biệt mặt.
 */

/** Trần một lượt = số buổi tối đa của một khoá, chừa dư. */
export const MAX_FLASHCARD_COVER_UPLOAD_FILES = 60;

export type CoverFile = {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type CoverTarget = {
  sectionId: string;
  sessionNumber: number;
  title: string;
  /** Buổi đã công bố KHÔNG nhận ảnh — DB chặn, đây chỉ là chỗ nói trước. */
  published: boolean;
  hasCover: boolean;
};

/** Kế hoạch cho MỘT buổi. Mỗi trạng thái là một nhãn khác nhau trên bảng. */
export type CoverPlan =
  /** Không file nào khớp, buổi cũng chưa có trang mở đầu. */
  | { state: "empty" }
  /** Không file nào khớp, buổi đã có ảnh mở đầu — giữ nguyên. */
  | { state: "keep" }
  /** Có file khớp, buổi chưa có trang mở đầu → sẽ TẠO trang mở đầu. */
  | { state: "attach"; fileName: string }
  /** Có file khớp, buổi đã có ảnh, ô Ghi đè BẬT → sẽ thay (xoá hẳn file cũ). */
  | { state: "replace"; fileName: string }
  /** Có file khớp, buổi đã có ảnh, ô Ghi đè TẮT → bỏ qua, không ai mất gì. */
  | { state: "skip"; fileName: string }
  /**
   * Buổi ĐÃ CÔNG BỐ. Bỏ qua **bất kể** ô Ghi đè và bất kể có file khớp hay
   * không (`D-41` điểm 4) — mọi đường sửa trang đều đòi buổi nháp, và tự hạ về
   * nháp thì mã QR đã in trong sách trả 404 trong lúc chạy.
   */
  | { state: "published"; fileName: string | null };

export type CoverRow = {
  target: CoverTarget;
  plan: CoverPlan;
};

export type UnmatchedCoverReason =
  | "bad-format"
  | "too-large"
  | "no-number"
  | "many-numbers"
  | "no-match"
  | "slot-taken";

export type UnmatchedCoverFile = {
  fileName: string;
  reason: UnmatchedCoverReason;
  /** Câu tiếng Việt hiện thẳng cạnh tên file. */
  message: string;
};

export type CoverPlanResult = {
  rows: CoverRow[];
  unmatched: UnmatchedCoverFile[];
};

/** Một dòng thật sự gửi lên server. */
export type CoverUpload = {
  sectionId: string;
  fileName: string;
};

// =====================================================================
// Đọc số buổi từ tên file
// =====================================================================

/** `"buoi-01.webp"` → `"buoi-01"`; `"01.png"` → `"01"`. */
function fileStem(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return (dot <= 0 ? fileName : fileName.slice(0, dot)).trim();
}

export type SessionNumberRead =
  | { kind: "ok"; sessionNumber: number }
  | { kind: "none" }
  | { kind: "ambiguous"; found: number[] };

/**
 * Tên file phải chứa **đúng MỘT dãy số**, và dãy đó là số buổi.
 *
 * 🔴 Vì sao là "đúng một" chứ không phải "lấy dãy đầu tiên": lấy dãy đầu tiên
 * biến `2026-01-05-bia.png` thành **buổi 2026** — miss thì còn thấy được, nhưng
 * `05-2026-bia.png` sẽ ra **buổi 5** một cách rất thuyết phục và sai. Ghép sai
 * ảnh bìa giữa các buổi là lỗi **im lặng**: không có gì trên màn hình nói rằng
 * buổi 5 đang đeo bìa của buổi khác. Từ chối đoán, rồi để người soạn gán tay,
 * là đường duy nhất không sinh ra lỗi im lặng — cùng nguyên tắc `matchByNumber`
 * của `bulk-media.ts` đã chọn khi nó từ chối đánh số lại cho thẻ từ vựng.
 *
 * `01` và `1` cùng ra `1`: số 0 ở đầu là thói quen đặt tên để máy sắp đúng thứ
 * tự, không phải một số khác.
 */
export function readSessionNumberFromFileName(
  fileName: string,
): SessionNumberRead {
  const runs = fileStem(fileName).match(/\d+/g) ?? [];
  if (runs.length === 0) return { kind: "none" };
  const found = runs.map((run) => Number(run));
  if (runs.length > 1) return { kind: "ambiguous", found };
  return { kind: "ok", sessionNumber: found[0]! };
}

// =====================================================================
// Ghép
// =====================================================================

const SIZE_MESSAGE = `Ảnh tối đa ${MAX_FLASHCARD_IMAGE_BYTES / (1024 * 1024)} MB.`;

/**
 * Dựng bảng đối chiếu: mỗi BUỔI một hàng, mỗi file rơi vào đúng một chỗ.
 *
 * `overrides` là các cặp người soạn tự gán tay (`fileName` → `sectionId`);
 * chúng **thắng** phép ghép tự động, vì người soạn nhìn thấy nội dung ảnh còn
 * thuật toán chỉ nhìn thấy tên file.
 */
export function matchFlashcardCoverFiles(
  files: CoverFile[],
  targets: CoverTarget[],
  options: {
    allowOverwrite: boolean;
    overrides?: ReadonlyMap<string, string>;
  },
): CoverPlanResult {
  const overrides = options.overrides ?? new Map<string, string>();
  const unmatched: UnmatchedCoverFile[] = [];
  /** `sectionId` → tên file đã chiếm chỗ. */
  const claimed = new Map<string, string>();

  const claim = (sectionId: string, fileName: string) => {
    const taken = claimed.get(sectionId);
    if (taken) {
      // Hai file tranh cùng một buổi. KHÔNG lấy file đến trước: thứ tự file do
      // hệ điều hành quyết định, tức kết quả sẽ đổi giữa hai lần thả cùng bộ
      // file. Bỏ file sau ra và nói rõ thì người soạn quyết định, và quyết định
      // đó lặp lại được.
      unmatched.push({
        fileName,
        reason: "slot-taken",
        message: `Tranh chỗ với “${taken}” ở cùng một buổi — giữ lại một file thôi.`,
      });
      return;
    }
    claimed.set(sectionId, fileName);
  };

  // File được gán TAY đi trước file ghép tự động: nếu xử theo thứ tự người dùng
  // thả thì một file tự động có thể chiếm mất buổi mà người soạn đã chỉ định
  // tay, và lựa chọn tay — thứ duy nhất ở đây có người thật đứng sau — lại thua.
  const ordered = [
    ...files.filter((file) => overrides.has(file.fileName)),
    ...files.filter((file) => !overrides.has(file.fileName)),
  ];

  for (const file of ordered) {
    // Chỉ ẢNH. Hỏi ngược `flashcardMediaFormat` thay vì liệt kê lại danh sách
    // đuôi — luật "khe và đuôi phải cùng loại" đã có đúng một chỗ phát biểu.
    if (!flashcardMediaFormat("front", file.fileName, file.mimeType)) {
      unmatched.push({
        fileName: file.fileName,
        reason: "bad-format",
        message: "Trang mở đầu chỉ nhận ảnh JPG, PNG hoặc WEBP.",
      });
      continue;
    }
    if (file.sizeBytes > flashcardMediaSizeLimit("front")) {
      unmatched.push({
        fileName: file.fileName,
        reason: "too-large",
        message: SIZE_MESSAGE,
      });
      continue;
    }

    const forced = overrides.get(file.fileName);
    if (forced) {
      const target = targets.find((item) => item.sectionId === forced);
      if (target) {
        claim(target.sectionId, file.fileName);
        continue;
      }
      // Gán tay vào một buổi vừa bị xoá ở tab khác: rơi xuống đường tự động
      // thay vì im lặng bỏ, để người soạn thấy file vẫn còn đó.
    }

    const read = readSessionNumberFromFileName(file.fileName);
    if (read.kind === "none") {
      unmatched.push({
        fileName: file.fileName,
        reason: "no-number",
        message:
          "Tên file không có số buổi. Đặt tên kèm số buổi (01.png, buoi-01.png) hoặc gán tay.",
      });
      continue;
    }
    if (read.kind === "ambiguous") {
      unmatched.push({
        fileName: file.fileName,
        reason: "many-numbers",
        message: `Tên file có ${read.found.length} dãy số (${read.found.join(", ")}) nên không đoán được buổi nào — gán tay để khỏi nhầm.`,
      });
      continue;
    }

    const target = targets.find(
      (item) => item.sessionNumber === read.sessionNumber,
    );
    if (!target) {
      unmatched.push({
        fileName: file.fileName,
        reason: "no-match",
        message: `Bộ này không có buổi ${read.sessionNumber} — tạo buổi đó trước, hoặc gán tay.`,
      });
      continue;
    }

    claim(target.sectionId, file.fileName);
  }

  const rows: CoverRow[] = targets.map((target) => ({
    target,
    plan: planFor(claimed.get(target.sectionId), target, options.allowOverwrite),
  }));

  return { rows, unmatched };
}

function planFor(
  fileName: string | undefined,
  target: CoverTarget,
  allowOverwrite: boolean,
): CoverPlan {
  // Vế "đã công bố" đứng TRƯỚC mọi vế khác, kể cả trước "có file khớp hay
  // không": buổi đã công bố không nhận ảnh trong mọi tình huống.
  if (target.published) return { state: "published", fileName: fileName ?? null };
  if (!fileName) return target.hasCover ? { state: "keep" } : { state: "empty" };
  if (!target.hasCover) return { state: "attach", fileName };
  return allowOverwrite
    ? { state: "replace", fileName }
    : { state: "skip", fileName };
}

// =====================================================================
// Đọc kế hoạch
// =====================================================================

/** Buổi sẽ thật sự được ghi (tạo mới hoặc thay ảnh). */
export function plannedCoverUploads(plan: CoverPlanResult): CoverUpload[] {
  const uploads: CoverUpload[] = [];
  for (const row of plan.rows) {
    if (row.plan.state === "attach" || row.plan.state === "replace") {
      uploads.push({
        sectionId: row.target.sectionId,
        fileName: row.plan.fileName,
      });
    }
  }
  return uploads;
}

export type CoverSummary = {
  /** Số BUỔI sẽ đổi — con số in trên nút xác nhận. */
  sessionCount: number;
  attachCount: number;
  /** Số file cũ sẽ bị **xoá hẳn**. In riêng vì đây là vế không hoàn tác được. */
  replaceCount: number;
  skippedCount: number;
  publishedCount: number;
  unmatchedCount: number;
};

export function summarizeCoverPlan(plan: CoverPlanResult): CoverSummary {
  let attachCount = 0;
  let replaceCount = 0;
  let skippedCount = 0;
  let publishedCount = 0;

  for (const row of plan.rows) {
    const state = row.plan.state;
    if (state === "attach") attachCount += 1;
    else if (state === "replace") replaceCount += 1;
    else if (state === "skip") skippedCount += 1;
    // Chỉ đếm buổi đã công bố khi nó THẬT SỰ chặn một file — buổi đã công bố mà
    // người soạn không thả ảnh cho nó thì không phải thứ cần cảnh báo.
    else if (state === "published" && row.plan.fileName) publishedCount += 1;
  }

  return {
    sessionCount: attachCount + replaceCount,
    attachCount,
    replaceCount,
    skippedCount,
    publishedCount,
    unmatchedCount: plan.unmatched.length,
  };
}
