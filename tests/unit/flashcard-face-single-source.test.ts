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
const CONSUMERS = [
  "student-flashcard-reader.tsx",
  "flashcard-admin-manager.tsx",
] as const;

/** Các khối chỉ được phép định nghĩa trong file dùng chung. */
const FACE_BUILDERS = [
  "VocabularyFront",
  "VocabularyBack",
  "FlashcardFaceContent",
  "BackBlock",
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

  it.each(CONSUMERS)("%s KHÔNG tự định nghĩa lại mặt thẻ", (file) => {
    const text = source(file);
    for (const builder of FACE_BUILDERS) {
      expect(text).not.toContain(`function ${builder}(`);
    }
  });

  it.each(CONSUMERS)("%s lấy mặt thẻ từ file dùng chung", (file) => {
    expect(source(file)).toContain(
      "@/features/flashcards/components/flashcard-face",
    );
  });
});
