import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * MỘT NGUỒN SỰ THẬT CHO MẶT THẺ — bài kiểm TĨNH.
 *
 * Màn học viên và màn Quản trị phải dựng mặt thẻ bằng CÙNG một khối code
 * (`components/flashcard-face.tsx`). Chép ra bản thứ hai cho Quản trị chính là
 * hình dạng `BUG_M10_01`: hai đường code cùng dựng một thứ rồi trôi khác nhau ở
 * đúng chỗ người dùng nhìn thấy — và không bài kiểm hành vi nào báo đỏ, vì mỗi
 * bản đều "đúng" theo tiêu chí của chính nó (cùng mẫu `UX-UIUX-M25-010`).
 *
 * Chọn bài kiểm TĨNH chứ không phải E2E: thứ cần khoá là *cấu trúc code*, không
 * phải một hành vi chạy được. Một bài E2E so ảnh chụp hai màn sẽ vừa chậm vừa
 * chập chờn, mà chập chờn còn tệ hơn không có (`DS-038`).
 */
const ROOT = join(process.cwd(), "src", "features", "flashcards", "components");

const SHARED_FACE = "flashcard-face.tsx";

/**
 * Cơ chế LẬT thẻ tách ra đây khi làm trang công khai `/t/<mã>` — cùng lý do:
 * `FlashcardSizer` là khối quyết định chiều cao thẻ, tốn cả một đợt QA mới
 * đúng, và chép bản thứ hai là mời gọi hai bản trôi khác nhau.
 */
const SHARED_SURFACE = "flashcard-surface.tsx";

const CONSUMERS = [
  "student-flashcard-reader.tsx",
  "flashcard-admin-manager.tsx",
  "public-flashcard-reader.tsx",
] as const;

/** Các khối chỉ được phép định nghĩa trong `flashcard-face.tsx`. */
const FACE_BUILDERS = [
  "VocabularyFront",
  "VocabularyBack",
  "FlashcardFaceContent",
  "BackBlock",
] as const;

/** Các khối chỉ được phép định nghĩa trong `flashcard-surface.tsx`. */
const SURFACE_BUILDERS = [
  "FlashcardSizer",
  "FlashcardFaces",
  "FlashcardFaceShell",
  "FlashcardSurface",
] as const;

function source(file: string): string {
  return readFileSync(join(ROOT, file), "utf8");
}

describe("mặt thẻ flashcard chỉ có MỘT nguồn sự thật", () => {
  it("file dùng chung định nghĩa đủ các khối dựng mặt thẻ", () => {
    const shared = source(SHARED_FACE);
    for (const builder of FACE_BUILDERS) {
      expect(shared).toContain(`function ${builder}(`);
    }
  });

  it("file dùng chung định nghĩa đủ các khối lật thẻ", () => {
    const shared = source(SHARED_SURFACE);
    for (const builder of SURFACE_BUILDERS) {
      expect(shared).toContain(`function ${builder}(`);
    }
  });

  it.each(CONSUMERS)("%s KHÔNG tự định nghĩa lại mặt thẻ", (file) => {
    const text = source(file);
    for (const builder of [...FACE_BUILDERS, ...SURFACE_BUILDERS]) {
      expect(text).not.toContain(`function ${builder}(`);
    }
  });

  it.each(CONSUMERS)("%s lấy mặt/khung thẻ từ file dùng chung", (file) => {
    const text = source(file);
    expect(
      text.includes("@/features/flashcards/components/flashcard-face") ||
        text.includes("@/features/flashcards/components/flashcard-surface"),
    ).toBe(true);
  });
});
