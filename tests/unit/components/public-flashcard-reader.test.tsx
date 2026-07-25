import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicFlashcardReader } from "@/features/flashcards/components/public-flashcard-reader";
import type { PublicFlashcardSectionView } from "@/features/flashcards/server/public-queries";

/**
 * Trình đọc thẻ của trang CÔNG KHAI `/t/<mã>`.
 *
 * Bài kiểm này KHÔNG mock server action nào — và đó chính là điểm: nếu về sau ai
 * kéo một action vào component này, file test sẽ đỏ ngay lúc nạp module vì
 * `server-only` không chạy được trong jsdom. Bài kiểm tĩnh
 * `tests/unit/security/public-surface-imports.test.ts` canh cùng một điều từ
 * hướng khác.
 */

const section: PublicFlashcardSectionView = {
  section: {
    session_number: 3,
    title: "Ở ngân hàng",
    deck_title: "Flashcard — Tiếng Trung ngân hàng",
    course_title: "Tiếng Trung ngân hàng",
  },
  pages: [
    {
      order_index: 1,
      kind: "vocabulary",
      hanzi: "银行",
      pinyin_syllables: "yín háng",
      meaning_vi: "Ngân hàng",
      front_image_path: null,
      back_image_path: null,
      audio_path: null,
      front_alt: null,
      back_alt: null,
      example_sentences: [],
      common_phrases: [],
      media_paths: [],
      frontUrl: null,
      backUrl: null,
      audioUrl: null,
      mediaUrls: {},
    },
    {
      order_index: 2,
      kind: "vocabulary",
      hanzi: "客户",
      pinyin_syllables: "kè hù",
      meaning_vi: "Khách hàng",
      front_image_path: null,
      back_image_path: null,
      audio_path: null,
      front_alt: null,
      back_alt: null,
      example_sentences: [],
      common_phrases: [],
      media_paths: [],
      frontUrl: null,
      backUrl: null,
      audioUrl: null,
      mediaUrls: {},
    },
  ],
};

function faceSide(side: "front" | "back") {
  return document.querySelector(`[data-face-side="${side}"]`);
}

describe("PublicFlashcardReader", () => {
  it("hiện buổi học và số thẻ", () => {
    render(<PublicFlashcardReader data={section} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Buổi 3 · Ở ngân hàng",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
  });

  it("lật được thẻ bằng nút", () => {
    render(<PublicFlashcardReader data={section} />);

    expect(document.querySelector('[data-face="front"]')).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
    expect(document.querySelector('[data-face="back"]')).not.toBeNull();
    expect(faceSide("back")).toHaveTextContent("Ngân hàng");
  });

  it("sang thẻ kế thì quay về mặt trước — không lộ đáp án trước khi học sinh kịp nghĩ", () => {
    render(<PublicFlashcardReader data={section} />);

    fireEvent.click(screen.getByRole("button", { name: "Lật thẻ" }));
    expect(document.querySelector('[data-face="back"]')).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Thẻ tiếp theo" }));
    expect(document.querySelector('[data-face="front"]')).not.toBeNull();
    expect(faceSide("front")).toHaveTextContent("Khách hàng");
  });

  it("chặn đúng biên: nút lùi khoá ở thẻ đầu, nút tiến khoá ở thẻ cuối", () => {
    render(<PublicFlashcardReader data={section} />);

    expect(screen.getByRole("button", { name: "Thẻ trước" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Thẻ tiếp theo" }));
    expect(
      screen.getByRole("button", { name: "Thẻ tiếp theo" }),
    ).toBeDisabled();
  });

  /**
   * Assert NGƯỢC — user chốt bỏ hẳn tính năng cá nhân khỏi trang công khai.
   * Không có tài khoản thì ★ và tiến độ vừa vô nghĩa vừa là đường ghi thừa.
   */
  it("KHÔNG có ★ và không có đường ghi nào", () => {
    render(<PublicFlashcardReader data={section} />);

    expect(screen.queryByText(/Đánh dấu khó/)).toBeNull();
    expect(screen.queryByRole("button", { name: /khó/i })).toBeNull();
    expect(document.querySelectorAll("form")).toHaveLength(0);
  });

  it("chữ Hán khai lang=zh-Hans để Android không dựng glyph tiếng Nhật", () => {
    render(<PublicFlashcardReader data={section} />);

    const hanzi = document.querySelectorAll('[lang="zh-Hans"]');
    expect(hanzi.length).toBeGreaterThan(0);
    for (const node of hanzi) {
      expect(node.className).toContain("font-hanzi");
    }
  });

  it("buổi rỗng không làm vỡ trang", () => {
    render(<PublicFlashcardReader data={{ ...section, pages: [] }} />);
    expect(screen.getByText(/chưa có thẻ nào/)).toBeInTheDocument();
  });
});
