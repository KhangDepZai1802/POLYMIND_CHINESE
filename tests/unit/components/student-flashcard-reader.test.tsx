import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// Cùng cách `flashcard-admin-manager.test.tsx` làm: server action kéo theo
// `server-only`, không nạp được trong môi trường jsdom của component test.
vi.mock("@/features/flashcards/server/actions", () => ({
  setFlashcardStarAction: vi.fn(async () => ({ success: "ok" })),
}));

import { StudentFlashcardReader } from "@/features/flashcards/components/student-flashcard-reader";

const commonPage = {
  section_id: "44444444-4444-4444-8444-444444444444",
  archived_at: null,
  created_by: "33333333-3333-4333-8333-333333333333",
  created_at: "2026-07-21T00:00:00Z",
  updated_at: "2026-07-21T00:00:00Z",
};

const deck = {
  id: "22222222-2222-4222-8222-222222222222",
  course_id: "11111111-1111-4111-8111-111111111111",
  title: "Flashcard HSK 1",
  description: null,
  status: "published",
  published_at: "2026-07-21T00:00:00Z",
  created_by: "33333333-3333-4333-8333-333333333333",
  created_at: "2026-07-21T00:00:00Z",
  updated_at: "2026-07-21T00:00:00Z",
  sections: [
    {
      id: commonPage.section_id,
      deck_id: "22222222-2222-4222-8222-222222222222",
      session_number: 1,
      title: "Chào hỏi",
      status: "published",
      published_at: "2026-07-21T00:00:00Z",
      created_by: commonPage.created_by,
      created_at: commonPage.created_at,
      updated_at: commonPage.updated_at,
      pages: [
        {
          ...commonPage,
          id: "55555555-5555-4555-8555-555555555555",
          kind: "session_cover",
          order_index: 0,
          hanzi: null,
          pinyin_syllables: null,
          meaning_vi: null,
          example_sentences: [],
          common_phrases: [],
          front_image_path: "front-cover.jpg",
          back_image_path: "back-cover.jpg",
          audio_path: null,
          media_paths: ["front-cover.jpg", "back-cover.jpg"],
          front_alt: "Ảnh mở đầu mặt trước",
          back_alt: "Ảnh mở đầu mặt sau",
          frontUrl: "https://signed.test/front-cover.jpg",
          backUrl: "https://signed.test/back-cover.jpg",
          audioUrl: null,
          mediaUrls: {
            "front-cover.jpg": "https://signed.test/front-cover.jpg",
            "back-cover.jpg": "https://signed.test/back-cover.jpg",
          },
        },
        {
          ...commonPage,
          id: "66666666-6666-4666-8666-666666666666",
          kind: "vocabulary",
          order_index: 1,
          hanzi: "你好",
          pinyin_syllables: "nǐ hǎo",
          meaning_vi: "Xin chào",
          example_sentences: [
            {
              hanzi: "你好吗？",
              pinyin: "nǐ hǎo ma",
              meaning_vi: "Bạn khỏe không?",
              image_path: "example-0-word.jpg",
            },
          ],
          common_phrases: [
            { hanzi: "你好啊", pinyin: "nǐ hǎo a", meaning_vi: "chào cậu" },
          ],
          // Thẻ từ vựng chỉ còn ảnh mặt TRƯỚC (`…078`): mặt sau là chữ.
          front_image_path: "front-word.jpg",
          back_image_path: null,
          audio_path: "word.mp3",
          media_paths: ["front-word.jpg", "word.mp3", "example-0-word.jpg"],
          front_alt: "Ảnh từ vựng mặt trước",
          back_alt: null,
          frontUrl: "https://signed.test/front-word.jpg",
          backUrl: null,
          audioUrl: "https://signed.test/word.mp3",
          mediaUrls: {
            "front-word.jpg": "https://signed.test/front-word.jpg",
            "word.mp3": "https://signed.test/word.mp3",
            "example-0-word.jpg": "https://signed.test/example-0-word.jpg",
          },
        },
      ],
    },
  ],
} as const;

/**
 * Vào tab Flashcard là TRANG MỞ ĐẦU của module (hai tab còn thấy được), bấm
 * "Bắt đầu ôn thẻ" mới vào khung toàn màn hình — user chốt 2026-07-25.
 */
function startReading() {
  fireEvent.click(screen.getByRole("button", { name: "Bắt đầu ôn thẻ" }));
}

describe("StudentFlashcardReader", () => {
  it("vào tab là TRANG MỞ ĐẦU của module, không nhảy thẳng vào toàn màn hình", () => {
    const { container } = render(
      <StudentFlashcardReader deck={deck as never} courseName="HSK 1" />,
    );

    // Chưa có khung, chưa khoá chrome: hai tab của trang Ôn tập phải còn thấy.
    expect(container.querySelector("[data-flashcard-frame]")).toBeNull();
    expect(document.documentElement.dataset.flashcardFocus).toBeUndefined();
    // Mũi tên hướng dẫn + CTA duy nhất.
    expect(screen.getByRole("status")).toHaveTextContent(/Bắt đầu ôn thẻ/);
    expect(
      screen.getByRole("button", { name: "Bắt đầu ôn thẻ" }),
    ).toBeInTheDocument();

    startReading();
    expect(container.querySelector("[data-flashcard-frame]")).toHaveAttribute(
      "data-flashcard-frame",
      "fullscreen",
    );
    expect(document.documentElement.dataset.flashcardFocus).toBe("true");

    // ✕ đưa về trang mở đầu và trả chrome lại — không có trạng thái chết.
    fireEvent.click(screen.getByRole("button", { name: "Thoát ôn thẻ" }));
    expect(container.querySelector("[data-flashcard-frame]")).toBeNull();
    expect(document.documentElement.dataset.flashcardFocus).toBeUndefined();
    expect(
      screen.getByRole("button", { name: "Bắt đầu ôn thẻ" }),
    ).toBeInTheDocument();
  });

  /**
   * Assert NGƯỢC — user chốt 2026-07-25 **bỏ hẳn** ba chức năng này để chừa chỗ
   * cho thẻ. Ghim chiều phủ định để không ai dựng lại chúng.
   */
  it("KHÔNG còn xáo trộn / thứ tự gốc / phát tự động", () => {
    render(<StudentFlashcardReader deck={deck as never} courseName="HSK 1" />);
    startReading();

    expect(screen.queryByRole("button", { name: /Xáo trộn/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Thứ tự gốc" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Phát tự động/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Dừng phát/ })).toBeNull();
  });
  it("reset trang vừa rời về mặt trước và hỗ trợ phím mũi tên", () => {
    const { container } = render(
      <StudentFlashcardReader deck={deck as never} courseName="HSK 1" />,
    );
    startReading();

    const coverFront = screen.getByRole("button", {
      name: /Mặt trước của trang mở đầu/i,
    });
    fireEvent.click(coverFront);
    expect(
      screen.getByRole("button", { name: /Mặt sau của trang mở đầu/i }),
    ).toBeInTheDocument();

    fireEvent.keyDown(
      screen.getByRole("button", { name: /Mặt sau của trang mở đầu/i }),
      { key: "ArrowRight" },
    );

    const outgoingNext = container.querySelector(
      '[data-transition-layer="outgoing"][data-page-transition="next"]',
    );
    const incomingNext = container.querySelector(
      '[data-transition-layer="incoming"][data-page-transition="next"]',
    );
    expect(outgoingNext).toHaveClass("flashcard-page-out-next");
    expect(outgoingNext).toHaveClass("motion-reduce:hidden");
    expect(outgoingNext?.querySelector('[data-face="back"]')).toHaveStyle({
      transform: "rotateX(180deg)",
    });
    expect(incomingNext).toHaveClass("flashcard-page-in-next");
    expect(incomingNext).toHaveClass("motion-reduce:animate-none");
    expect(
      screen.getByRole("button", { name: /Mặt trước của 你好/i }),
    ).toBeInTheDocument();
    fireEvent.animationEnd(incomingNext!);

    fireEvent.click(
      screen.getByRole("button", { name: /Mặt trước của 你好/i }),
    );
    expect(
      screen.getByRole("button", { name: /Mặt sau của 你好/i }),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: "Trang flashcard trước" }),
    );
    const incomingPrevious = container.querySelector(
      '[data-transition-layer="incoming"][data-page-transition="previous"]',
    );
    expect(
      container.querySelector(
        '[data-transition-layer="outgoing"][data-page-transition="previous"]',
      ),
    ).toHaveClass("flashcard-page-out-previous");
    expect(
      container.querySelector(
        '[data-transition-layer="outgoing"] [data-face="back"]',
      ),
    ).toHaveStyle({ transform: "rotateX(180deg)" });
    expect(incomingPrevious).toHaveClass("flashcard-page-in-previous");
    fireEvent.animationEnd(incomingPrevious!);
    // Trang mở đầu từng bị lật sang mặt sau, nhưng đã reset khi rời trang.
    expect(
      screen.getByRole("button", { name: /Mặt trước của trang mở đầu/i }),
    ).toBeInTheDocument();
    expect(
      screen
        .getByRole("button", { name: /Mặt trước của trang mở đầu/i })
        .querySelector('[data-face="front"]'),
    ).toHaveStyle({ transform: "rotateX(0deg)" });
  });

  it("phát âm bằng một nút mang tiêu đề trang, trang mở đầu không có audio", () => {
    render(<StudentFlashcardReader deck={deck as never} courseName="HSK 1" />);
    startReading();

    expect(
      screen.queryByRole("button", { name: /Phát audio/i }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(
      screen.getByRole("button", { name: /Mặt trước của trang mở đầu/i }),
      { key: "ArrowRight" },
    );

    // Chữ HIỆN RA trên nút cố ý không còn là chữ Hán của thẻ: `label` dài ngắn
    // tuỳ trang nên nút đổi bề rộng theo từng thẻ, đó là một trong các nguyên
    // nhân hàng nút trông so le. Chữ Hán vẫn nằm trong TÊN GỌI cho trình đọc
    // màn hình (`getByRole` bên dưới đã ghim), và chữ hiện ra là phần đầu của
    // tên gọi đó nên không phạm WCAG 2.5.3.
    const playButton = screen.getByRole("button", { name: "Phát audio 你好" });
    expect(playButton).toHaveTextContent("Phát audio");
    const speedGroup = screen.getByRole("group", {
      name: "Tốc độ phát 你好",
    });
    expect(within(speedGroup).getAllByRole("button")).toHaveLength(3);
    expect(
      within(speedGroup).getByRole("button", { name: "Tốc độ 1×" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("dựng thẻ từ vựng BẰNG CHỮ theo §7ter, không phải bằng ảnh", () => {
    const { container } = render(
      <StudentFlashcardReader deck={deck as never} courseName="HSK 1" />,
    );
    startReading();
    fireEvent.keyDown(
      screen.getByRole("button", { name: /Mặt trước của trang mở đầu/i }),
      { key: "ArrowRight" },
    );

    // Soi từng mặt riêng, và chỉ trong lớp đang hiện — không đụng khối đo
    // chiều cao (sizer), cũng không lẫn mặt trước với mặt sau.
    const layer = container.querySelector(
      '[data-transition-layer="incoming"] [data-face]',
    ) as HTMLElement;
    const front = within(
      layer.querySelector('[data-face-side="front"]') as HTMLElement,
    );
    const back = within(
      layer.querySelector('[data-face-side="back"]') as HTMLElement,
    );

    /*
     * Mặt trước — bố cục user chốt 2026-07-25: BA DÒNG xếp dọc, thứ tự Hán tự →
     * pinyin → nghĩa.
     *
     * `exact: true` cho Hán tự là phần ghim quan trọng nhất: nó đòi `你好` phải là
     * MỘT chuỗi liền. Bố cục cũ chẻ theo từng chữ (`你` và `好` là hai node riêng,
     * mỗi node một cột với âm tiết của nó) — chính cái làm hai chữ Hán bị đẩy xa
     * nhau khi pinyin dài. Bài này đỏ nếu ai dựng lại cách chẻ đó.
     */
    expect(front.getByText("你好", { exact: true })).toBeInTheDocument();
    expect(front.getByText("nǐ hǎo", { exact: true })).toBeInTheDocument();
    expect(front.getByText("Xin chào")).toBeInTheDocument();

    // Mặt sau khối 1: pinyin VIẾT LIỀN, dẫn xuất chứ không phải cột riêng.
    expect(back.getByText(/nǐhǎo/)).toBeInTheDocument();
    // Khối "Câu ví dụ" và "Cụm từ".
    expect(back.getByText("你好吗？")).toBeInTheDocument();
    expect(back.getByText(/chào cậu/)).toBeInTheDocument();
    // ⛔ Khối "Tách nghĩa" đã BỎ khỏi sản phẩm (user chốt 2026-07-24). Ghim
    // chiều phủ định để không ai vô tình dựng lại nó.
    expect(back.queryByText("Tách nghĩa")).not.toBeInTheDocument();
    // Mặt trước KHÔNG được mang nội dung của mặt sau.
    expect(front.queryByText("你好吗？")).not.toBeInTheDocument();
  });

  /**
   * Danh sách user liệt kê, sau khi đã bỏ ba chức năng: *"trong 1 khung hình
   * phải có flashcard, mũi tên trái và phải, nút lật thẻ, nút phát video, 0.5x,
   * 0.75x, 1x"*.
   *
   * Ở đây chỉ đo được phần DỰNG RA. Phần HÌNH HỌC — tất cả nằm trong màn 360×800
   * và không mặt nào phải cuộn — đo ở `tests/e2e/flashcard-responsive.spec.ts`.
   */
  it("mọi nút user chốt đều nằm TRONG một khung", () => {
    const { container } = render(
      <StudentFlashcardReader deck={deck as never} courseName="HSK 1" />,
    );
    startReading();
    // Sang thẻ từ vựng: audio và ★ chỉ có ở thẻ từ vựng.
    fireEvent.keyDown(
      screen.getByRole("button", { name: /Mặt trước của trang mở đầu/i }),
      { key: "ArrowRight" },
    );

    const frame = within(
      container.querySelector("[data-flashcard-frame]") as HTMLElement,
    );
    for (const name of [
      "Thoát ôn thẻ",
      "Trang flashcard trước",
      "Trang flashcard tiếp theo",
      "Lật thẻ",
      "Phát audio 你好",
      "Tốc độ 0.5×",
      "Tốc độ 0.75×",
      "Tốc độ 1×",
      "Đánh dấu khó",
    ]) {
      expect(
        frame.getByRole("button", { name }),
        `thiếu nút "${name}" trong khung`,
      ).toBeInTheDocument();
    }
    // Và chính mặt thẻ — "flashcard" trong danh sách của user.
    expect(
      frame.getByRole("button", { name: /^Mặt trước của 你好/ }),
    ).toBeInTheDocument();
  });

  it("ký được ảnh của câu ví dụ nằm trong jsonb", () => {
    // Đây là lỗ hổng `DS-049` điểm 1: ảnh câu ví dụ không nằm ở 3 cột cũ nên
    // trước Phase 16 học viên nhận 403. Nay nó đi qua `mediaUrls`.
    render(<StudentFlashcardReader deck={deck as never} courseName="HSK 1" />);
    startReading();
    fireEvent.keyDown(
      screen.getByRole("button", { name: /Mặt trước của trang mở đầu/i }),
      { key: "ArrowRight" },
    );

    const exampleImages = screen.getAllByAltText(
      "Ảnh minh hoạ câu ví dụ 1 của 你好",
    );
    expect(exampleImages.length).toBeGreaterThan(0);
    expect(exampleImages[0]).toHaveAttribute(
      "src",
      "https://signed.test/example-0-word.jpg",
    );
  });
});
