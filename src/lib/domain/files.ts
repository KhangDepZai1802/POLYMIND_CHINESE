/**
 * Quy ước file dùng chung cho mọi bucket (tài liệu khóa học, file bài tập, bài nộp).
 *
 * Module này KHÔNG có `server-only`: client cần cùng bộ luật để chặn sớm và báo
 * lỗi tử tế, server cần nó để chặn thật. Client validate là UX; server validate
 * mới là bảo mật. Cả hai đọc chung một hằng số ở đây để không có chuyện client
 * cho phép `.zip` mà server thì không.
 */

/**
 * Đuôi file được phép — danh sách **CHO PHÉP**, không phải danh sách cấm.
 * Danh sách cấm luôn thiếu: quên một đuôi là thủng.
 *
 * Cố ý KHÔNG có `svg` và `html`: chúng chạy được script khi mở inline. Ta đã ép
 * `Content-Disposition: attachment` khi ký URL nên rủi ro đã thấp, nhưng không
 * nhận chúng ngay từ đầu thì không phải dựa vào lớp phòng thủ đó.
 */
export const ALLOWED_FILE_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "txt",
  "csv",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "mp3",
  "m4a",
  "wav",
  "mp4",
  "zip",
] as const;

export type AllowedFileExtension = (typeof ALLOWED_FILE_EXTENSIONS)[number];

/** Bucket PRIVATE chứa tài liệu khóa học (migration 14). */
export const MATERIALS_BUCKET = "course-materials";

/** Bucket PRIVATE chứa đề bài/attachment của assignment (migration 14). */
export const ASSIGNMENT_FILES_BUCKET = "assignment-files";

/** Bucket PRIVATE chứa file học viên nộp (migration 14). */
export const SUBMISSIONS_BUCKET = "submissions";

/** Bằng đúng `file_size_limit` của bucket `course-materials` (migration 14). */
export const MAX_MATERIAL_SIZE_BYTES = 52_428_800; // 50 MB

/** Bằng đúng `file_size_limit` của bucket `assignment-files` (migration 14). */
export const MAX_ASSIGNMENT_FILE_SIZE_BYTES = 20_971_520; // 20 MB

/** Hạn của signed URL. Đặc tả: URL tải xuống phải sống ngắn (≤ 5 phút). */
export const SIGNED_URL_TTL_SECONDS = 120;

export type FileKind =
  | "pdf"
  | "doc"
  | "slide"
  | "sheet"
  | "image"
  | "audio"
  | "video"
  | "archive"
  | "text";

const EXTENSION_KINDS: Record<AllowedFileExtension, FileKind> = {
  pdf: "pdf",
  doc: "doc",
  docx: "doc",
  ppt: "slide",
  pptx: "slide",
  xls: "sheet",
  xlsx: "sheet",
  csv: "sheet",
  txt: "text",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  mp4: "video",
  zip: "archive",
};

export function isAllowedExtension(ext: string): ext is AllowedFileExtension {
  return (ALLOWED_FILE_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Đuôi file (chữ thường, không dấu chấm), hoặc `null` nếu không được phép.
 *
 * Lấy đoạn sau dấu chấm CUỐI CÙNG: `báo-cáo.final.pdf` → `pdf`. Tên không có
 * dấu chấm, hoặc đuôi lạ (`.php5`, `.exe`) → `null` → bên gọi từ chối.
 */
export function fileExtension(fileName: string): AllowedFileExtension | null {
  const dot = fileName.lastIndexOf(".");
  if (dot < 1 || dot === fileName.length - 1) return null;

  const ext = fileName.slice(dot + 1).toLowerCase();
  return isAllowedExtension(ext) ? ext : null;
}

export function fileKind(ext: AllowedFileExtension): FileKind {
  return EXTENSION_KINDS[ext];
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return "—";
  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;

  return `${(kb / 1024).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Tên file khi người dùng bấm tải xuống.
 *
 * Trong storage, file mang tên `<uuid>.pdf` (server sinh, không đoán được) — tải
 * về mà giữ nguyên tên đó thì vô dụng. Ta trả lại tên theo TIÊU ĐỀ tài liệu.
 *
 * Tên trả về là **ASCII thuần** — bỏ dấu tiếng Việt, bỏ chữ Hán. Không phải vì
 * ta muốn, mà vì Supabase Storage percent-encode HAI LẦN phần non-ASCII của
 * `Content-Disposition` (đã kiểm chứng: header nhận được là
 * `filename*=UTF-8''Gi%25C3%25A1o...`, `%25` chính là dấu `%` đã bị mã hóa).
 * Trình duyệt giải mã một lần → người dùng nhận file tên `Gi%C3%A1o tr%C3%ACnh.pdf`.
 *
 * Khoảng trắng thì không sao (chỉ mã hóa một lần), nên tên vẫn đọc được tử tế:
 *   "Giáo trình HSK 1 — Bài 你好"  →  "Giao trinh HSK 1 Bai.pdf"
 *
 * TIÊU ĐỀ hiển thị trên web vẫn giữ nguyên tiếng Việt + chữ Hán; chỗ này chỉ là
 * tên file lúc tải về.
 */
export function sanitizeDownloadName(
  title: string,
  ext: AllowedFileExtension,
): string {
  const cleaned = title
    .normalize("NFD") // tách chữ khỏi dấu: "á" → "a" + U+0301 (dấu là non-ASCII)
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D") // NFD không tách được đ/Đ
    .replace(/[^\x20-\x7E]/g, "") // bỏ nốt phần non-ASCII còn lại (vd chữ Hán)
    .replace(/[/\\:*?"<>|]/g, " ") // ký tự có ý nghĩa với đường dẫn
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100)
    .trim();

  return `${cleaned || "tai-lieu"}.${ext}`;
}
