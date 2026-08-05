/**
 * Bóc mã video YouTube và đọc danh sách dán hàng loạt (`VIDEO-1b`).
 *
 * ⚠️ File này THUẦN: không import React, không import Supabase, không chạm
 * `window`. Nhờ vậy mọi ca trùng số và lệch tên đều test được bằng unit test,
 * không cần dựng DOM hay DB — đúng điều `CLAUDE.md` đòi (business rule ở
 * `domain/`, có unit test).
 */

/** Trần một lượt dán. Khoá dài nhất thực tế là 35 buổi; để dư cho khoá dài hơn. */
export const MAX_VIDEO_IMPORT_ROWS = 60;

/**
 * ID của YouTube luôn là **11 ký tự** trong tập `[A-Za-z0-9_-]`.
 *
 * Đây là cửa chặn cuối: mọi đường bóc tách bên dưới đều phải đi qua đây, nên dán
 * nhầm link Facebook hay thiếu ký tự đều bị bắt **ngay lúc nhập** chứ không phải
 * lúc học viên bấm vào và thấy trang lỗi.
 */
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/** Các host YouTube hợp lệ. `youtube-nocookie` là bản nhúng không theo dõi. */
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/** Các tiền tố đường dẫn mang ID ở segment kế tiếp. */
const PATH_PREFIXES = ["embed", "shorts", "live", "v"];

/**
 * Bóc ID từ mọi dạng người ta hay dán.
 *
 * Nhận được: `youtu.be/ID` · `watch?v=ID` · `m.youtube.com/watch?v=ID&t=90`
 * · `/embed/ID` · `/shorts/ID` · `/live/ID` · `youtu.be/ID?si=…` (nút Chia sẻ)
 * · ID trần. Link không phải YouTube → `null`.
 *
 * 🔴 Không đoán: không khớp thì trả `null` để caller báo lỗi rõ ràng, chứ không
 * cố vớt vát một chuỗi 11 ký tự bất kỳ nằm giữa câu.
 */
export function parseYoutubeId(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Dán mỗi ID trần — đường ngắn nhất, kiểm trước cho rẻ.
  if (YOUTUBE_ID_PATTERN.test(trimmed)) return trimmed;

  // `new URL` cần có scheme. Người dùng hay dán `youtu.be/xxx` không có `https://`.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  // `youtu.be/<ID>` — ID nằm ngay ở segment đầu.
  const segments = url.pathname.split("/").filter(Boolean);

  if (host === "youtu.be" || host === "www.youtu.be") {
    const candidate = segments[0];
    return candidate && YOUTUBE_ID_PATTERN.test(candidate) ? candidate : null;
  }

  // `watch?v=<ID>` — dạng phổ biến nhất khi copy từ thanh địa chỉ.
  const fromQuery = url.searchParams.get("v");
  if (fromQuery && YOUTUBE_ID_PATTERN.test(fromQuery)) return fromQuery;

  // `/embed/<ID>`, `/shorts/<ID>`, `/live/<ID>`, `/v/<ID>`
  const [first, second] = segments;
  if (first && PATH_PREFIXES.includes(first.toLowerCase()) && second) {
    return YOUTUBE_ID_PATTERN.test(second) ? second : null;
  }

  return null;
}

/** Dựng lại link xem từ ID. Một chỗ duy nhất, tránh mỗi nơi ghép một kiểu. */
export function youtubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Tiền tố "Buổi N" ở đầu tiêu đề, kèm dấu ngăn tuỳ chọn.
 *
 * Nhận cả `Buổi 1.` · `Buoi 01 -` · `BUỔI 7:` · `Bài 3)`. Chuẩn hoá NFC trước
 * khi so để chuỗi gõ ở dạng tổ hợp (`o` + dấu hỏi rời) cũng khớp — dán từ nguồn
 * khác nhau thì gặp cả hai dạng.
 */
const SESSION_TITLE_PREFIX =
  /^\s*(?:bu[ổo]i|b[àa]i)\s*0*(\d+)\s*(?:[.:)\]\-–—·]+\s*)?/iu;

/**
 * Cắt tiền tố "Buổi N" thừa khỏi tiêu đề lấy từ YouTube.
 *
 * 🔴 **Vì sao cần:** user đặt tiêu đề trên YouTube là *"Buổi 1. Chào hỏi và mở
 * đầu đàm phán"*, mà màn học viên đã có badge số riêng lấy từ `session_number`.
 * Ghép thẳng sẽ ra *"Buổi 1 · Buổi 1. Chào hỏi…"* — lặp chữ, và ở 375px thì phần
 * lặp đó ăn mất quỹ chữ của phần thật sự có nội dung.
 *
 * Giữ badge từ DB chứ không giữ chữ trong tiêu đề vì badge **luôn đúng và luôn
 * đều**: admin quên gõ "Buổi" cho một video thì hàng đó vẫn có số như mọi hàng
 * khác.
 *
 * Hai lối thoát an toàn:
 * 1. **Số không khớp thì KHÔNG cắt.** YouTube ghi "Buổi 10" mà DB là buổi 1 là
 *    dấu hiệu đặt nhầm link — để hiện cả hai cho lộ ra, đừng lặng lẽ giấu.
 * 2. **Cắt xong mà rỗng thì trả lại bản gốc.** Tiêu đề đúng bằng "Buổi 5" vẫn
 *    phải còn chữ để đọc.
 */
export function stripSessionPrefix(
  title: string,
  sessionNumber: number,
): string {
  const normalized = title.normalize("NFC").trim();
  const match = SESSION_TITLE_PREFIX.exec(normalized);
  if (!match) return normalized;

  if (Number.parseInt(match[1]!, 10) !== sessionNumber) return normalized;

  const rest = normalized.slice(match[0].length).trim();
  return rest === "" ? normalized : rest;
}

// =============================================================================
// Đọc khối text dán hàng loạt
// =============================================================================

export type VideoImportIssue =
  | "no-link"
  | "bad-session"
  | "out-of-range"
  | "duplicate-session"
  | "too-many-rows";

export type VideoImportRow = {
  /** Số dòng NGƯỜI DÙNG thấy (bắt đầu từ 1), để thông báo lỗi chỉ đúng chỗ. */
  lineNumber: number;
  raw: string;
  sessionNumber: number | null;
  youtubeVideoId: string | null;
  /** `null` = admin bỏ trống; caller sẽ lấy tiêu đề từ YouTube hoặc rơi về "Buổi N". */
  title: string | null;
  issue: VideoImportIssue | null;
};

export type VideoImportParseResult = {
  rows: VideoImportRow[];
  /** Chỉ những dòng dùng được — caller không phải lọc lại. */
  valid: VideoImportRow[];
  /** Cùng một video gán cho nhiều buổi. CẢNH BÁO, không chặn: có thể cố ý. */
  duplicateVideoIds: string[];
};

/** Bỏ dấu tiếng Việt để `buổi` và `buoi` cùng ra một dạng. */
function fold(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * Đọc số buổi từ ô đầu tiên.
 *
 * Nhận `7`, `07`, `buoi7`, `buổi 7`, `Buổi 07` — vì admin gõ tay thì kiểu gì
 * cũng có người gõ thêm chữ "buổi". Cắt số 0 đứng đầu là việc của `parseInt`.
 */
function parseSessionNumber(token: string): number | null {
  const cleaned = fold(token).replace(/buoi/g, "").replace(/[^0-9]/g, "");
  if (!cleaned) return null;
  const value = Number.parseInt(cleaned, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Tách một dòng thành `[số buổi, link, tiêu đề]`.
 *
 * Ưu tiên dấu `|` vì đó là dạng ghi trong hướng dẫn. Không có `|` thì lùi về
 * tách theo khoảng trắng — người dùng dán từ Excel hay gõ nhanh rất hay quên
 * dấu ngăn, mà bắt họ gõ lại cả khối chỉ vì thiếu một ký tự là quá đắt.
 */
function splitLine(line: string): [string, string, string] {
  if (line.includes("|")) {
    const parts = line.split("|").map((part) => part.trim());
    return [parts[0] ?? "", parts[1] ?? "", parts.slice(2).join(" | ").trim()];
  }

  const tokens = line.trim().split(/\s+/);
  return [tokens[0] ?? "", tokens[1] ?? "", tokens.slice(2).join(" ")];
}

/**
 * Đọc cả khối text dán vào.
 *
 * 🔴 **Trùng số buổi thì CẢ HAI dòng cùng hỏng, không chọn bừa một dòng.**
 * Gán nhầm video buổi 8 vào buổi 9 là lỗi *im lặng* — admin không mở từng video
 * ra xem thì không đời nào biết, mà học viên học nhầm bài cả buổi. Fail-closed
 * đúng tinh thần `AGENTS.md`, cùng một luật đã áp cho ghép media flashcard.
 */
export function parseVideoImportText(
  text: string,
  options: { maxSessionNumber: number },
): VideoImportParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((line, index) => ({ raw: line, lineNumber: index + 1 }))
    .filter((entry) => entry.raw.trim() !== "");

  const rows: VideoImportRow[] = [];

  // Đếm trước để biết số nào xuất hiện nhiều lần, rồi mới gắn lỗi — làm một
  // lượt thì cả HAI dòng trùng đều bị đánh dấu, chứ quét kiểu "đã gặp chưa" chỉ
  // bắt được dòng thứ hai và lặng lẽ nhận dòng thứ nhất.
  const sessionCount = new Map<number, number>();
  const parsed = lines.map((entry) => {
    const [sessionToken, linkToken, titleToken] = splitLine(entry.raw);
    const sessionNumber = parseSessionNumber(sessionToken);
    const youtubeVideoId = parseYoutubeId(linkToken);
    if (sessionNumber !== null) {
      sessionCount.set(sessionNumber, (sessionCount.get(sessionNumber) ?? 0) + 1);
    }
    return {
      ...entry,
      sessionNumber,
      youtubeVideoId,
      title: titleToken.trim() || null,
    };
  });

  for (const [index, entry] of parsed.entries()) {
    let issue: VideoImportIssue | null = null;

    if (index >= MAX_VIDEO_IMPORT_ROWS) {
      issue = "too-many-rows";
    } else if (entry.sessionNumber === null) {
      issue = "bad-session";
    } else if (entry.sessionNumber > options.maxSessionNumber) {
      issue = "out-of-range";
    } else if ((sessionCount.get(entry.sessionNumber) ?? 0) > 1) {
      issue = "duplicate-session";
    } else if (entry.youtubeVideoId === null) {
      issue = "no-link";
    }

    rows.push({
      lineNumber: entry.lineNumber,
      raw: entry.raw,
      sessionNumber: entry.sessionNumber,
      youtubeVideoId: entry.youtubeVideoId,
      title: entry.title,
      issue,
    });
  }

  const valid = rows.filter(
    (row): row is VideoImportRow & { sessionNumber: number; youtubeVideoId: string } =>
      row.issue === null &&
      row.sessionNumber !== null &&
      row.youtubeVideoId !== null,
  );

  const seenVideoIds = new Map<string, number>();
  for (const row of valid) {
    seenVideoIds.set(
      row.youtubeVideoId!,
      (seenVideoIds.get(row.youtubeVideoId!) ?? 0) + 1,
    );
  }
  const duplicateVideoIds = [...seenVideoIds.entries()]
    .filter(([, count]) => count > 1)
    .map(([videoId]) => videoId);

  return { rows, valid, duplicateVideoIds };
}

/** Câu giải thích cho từng ca hỏng. Lỗi phải nói được cách sửa, không chỉ tô đỏ. */
export function describeVideoImportIssue(
  issue: VideoImportIssue,
  context: { maxSessionNumber: number },
): string {
  switch (issue) {
    case "no-link":
      return "Không tìm thấy link YouTube hợp lệ.";
    case "bad-session":
      return "Không đọc được số buổi ở đầu dòng.";
    case "out-of-range":
      return `Khóa này chỉ có ${context.maxSessionNumber} buổi.`;
    case "duplicate-session":
      return "Số buổi này xuất hiện ở nhiều dòng — bỏ bớt một dòng.";
    case "too-many-rows":
      return `Mỗi lượt tối đa ${MAX_VIDEO_IMPORT_ROWS} dòng.`;
  }
}
