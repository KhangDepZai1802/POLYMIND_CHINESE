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
          sense_breakdown: [],
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
          sense_breakdown: [
            { hanzi: "你", pinyin: "nǐ", meaning_vi: "bạn" },
            { hanzi: "好", pinyin: "hǎo", meaning_vi: "tốt" },
          ],
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
          front_image_path: "front-word.jpg",
          back_image_path: "back-word.jpg",
          audio_path: "word.mp3",
          media_paths: [
            "front-word.jpg",
            "back-word.jpg",
            "word.mp3",
            "example-0-word.jpg",
          ],
          front_alt: "Ảnh từ vựng mặt trước",
          back_alt: "Ảnh từ vựng mặt sau",
          frontUrl: "https://signed.test/front-word.jpg",
          backUrl: "https://signed.test/back-word.jpg",
          audioUrl: "https://signed.test/word.mp3",
          mediaUrls: {
            "front-word.jpg": "https://signed.test/front-word.jpg",
            "back-word.jpg": "https://signed.test/back-word.jpg",
            "word.mp3": "https://signed.test/word.mp3",
            "example-0-word.jpg": "https://signed.test/example-0-word.jpg",
          },
        },
      ],
    },
  ],
} as const;

describe("StudentFlashcardReader", () => {
  it("reset trang vừa rời về mặt trước và hỗ trợ phím mũi tên", () => {
    const { container } = render(
      <StudentFlashcardReader deck={deck as never} courseName="HSK 1" />,
    );

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

    expect(
      screen.queryByRole("button", { name: /Phát audio/i }),
    ).not.toBeInTheDocument();

    fireEvent.keyDown(
      screen.getByRole("button", { name: /Mặt trước của trang mở đầu/i }),
      { key: "ArrowRight" },
    );

    const playButton = screen.getByRole("button", { name: "Phát audio 你好" });
    expect(playButton).toHaveTextContent("你好");
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

    // Mặt trước: mỗi âm tiết pinyin nằm trên đúng chữ Hán của nó.
    expect(front.getByText("nǐ")).toBeInTheDocument();
    expect(front.getByText("hǎo")).toBeInTheDocument();
    expect(front.getByText("你")).toBeInTheDocument();
    expect(front.getByText("好")).toBeInTheDocument();
    expect(front.getByText("Xin chào")).toBeInTheDocument();

    // Mặt sau khối 1: pinyin VIẾT LIỀN, dẫn xuất chứ không phải cột riêng.
    expect(back.getByText(/nǐhǎo/)).toBeInTheDocument();
    // Khối 3, 4, 5 của §7ter.
    expect(back.getByText(/bạn/)).toBeInTheDocument();
    expect(back.getByText("你好吗？")).toBeInTheDocument();
    expect(back.getByText(/chào cậu/)).toBeInTheDocument();
    // Mặt trước KHÔNG được mang nội dung của mặt sau.
    expect(front.queryByText("你好吗？")).not.toBeInTheDocument();
  });

  it("ký được ảnh của câu ví dụ nằm trong jsonb", () => {
    // Đây là lỗ hổng `DS-049` điểm 1: ảnh câu ví dụ không nằm ở 3 cột cũ nên
    // trước Phase 16 học viên nhận 403. Nay nó đi qua `mediaUrls`.
    render(<StudentFlashcardReader deck={deck as never} courseName="HSK 1" />);
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
