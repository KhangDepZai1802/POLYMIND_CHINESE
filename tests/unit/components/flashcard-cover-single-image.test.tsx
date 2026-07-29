import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  FlashcardFaceCard,
  type FlashcardFaceData,
} from "@/features/flashcards/components/flashcard-face";

/**
 * TRANG MỞ ĐẦU: MỘT ẢNH, HAI MẶT (`COVER-1`/`D-41`).
 *
 * Bài kiểm HÀNH VI, cố ý khác `flashcard-face-single-source.test.ts` (bài tĩnh):
 * ở đây thứ cần khoá không phải cấu trúc file mà là **pixel người dùng nhìn
 * thấy**. Đường hỏng thật là ai đó "sửa cho tử tế" thành
 * `backUrl ?? frontUrl` — nghe rất hợp lý, và trên máy dev (DB đã chạy `…084`,
 * `backUrl` luôn null) nó cho kết quả **y hệt**. Chỉ trên production, nơi vẫn
 * còn trang mở đầu cũ mang đường dẫn mặt sau cho tới khi migration chạy, hai
 * mặt mới hiện hai ảnh khác nhau. Dựng sẵn một `backUrl` KHÁC trong fixture là
 * cách duy nhất bắt được ca đó ở local.
 */

const COVER: FlashcardFaceData = {
  kind: "session_cover",
  hanzi: null,
  pinyin_syllables: null,
  meaning_vi: null,
  front_alt: "Mặt trước trang mở đầu Buổi 1",
  // Dữ liệu CŨ: bản ghi trước `…084` còn mang ảnh mặt sau riêng.
  back_alt: "Mặt sau trang mở đầu Buổi 1",
  example_sentences: [],
  common_phrases: [],
  frontUrl: "https://example.test/front.webp",
  backUrl: "https://example.test/back.webp",
  mediaUrls: {},
};

function imageSrc() {
  const image = screen.getByRole("img");
  return image.getAttribute("src");
}

describe("trang mở đầu dùng đúng một ảnh cho cả hai mặt", () => {
  it("mặt trước vẽ ảnh của trang", () => {
    render(<FlashcardFaceCard page={COVER} face="front" />);
    expect(imageSrc()).toBe(COVER.frontUrl);
  });

  it("🔴 mặt sau vẽ ĐÚNG ảnh đó, không đụng tới backUrl", () => {
    render(<FlashcardFaceCard page={COVER} face="back" />);
    expect(imageSrc()).toBe(COVER.frontUrl);
    expect(imageSrc()).not.toBe(COVER.backUrl);
  });

  it("alt của hai mặt giống nhau vì chúng LÀ một ảnh", () => {
    const { unmount } = render(<FlashcardFaceCard page={COVER} face="front" />);
    const front = screen.getByRole("img").getAttribute("alt");
    unmount();

    render(<FlashcardFaceCard page={COVER} face="back" />);
    expect(screen.getByRole("img").getAttribute("alt")).toBe(front);
  });

  it("không có ảnh thì báo bằng chữ, không để khung trắng", () => {
    render(
      <FlashcardFaceCard
        page={{ ...COVER, frontUrl: null }}
        face="back"
      />,
    );
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByText(/không tải được ảnh/i)).toBeTruthy();
  });
});
