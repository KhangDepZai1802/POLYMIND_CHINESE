import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

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
          term: null,
          front_image_path: "front-cover.jpg",
          back_image_path: "back-cover.jpg",
          audio_path: null,
          front_alt: "Ảnh mở đầu mặt trước",
          back_alt: "Ảnh mở đầu mặt sau",
          frontUrl: "https://signed.test/front-cover.jpg",
          backUrl: "https://signed.test/back-cover.jpg",
          audioUrl: null,
        },
        {
          ...commonPage,
          id: "66666666-6666-4666-8666-666666666666",
          kind: "vocabulary",
          order_index: 1,
          term: "你好",
          front_image_path: "front-word.jpg",
          back_image_path: "back-word.jpg",
          audio_path: "word.mp3",
          front_alt: "Ảnh từ vựng mặt trước",
          back_alt: "Ảnh từ vựng mặt sau",
          frontUrl: "https://signed.test/front-word.jpg",
          backUrl: "https://signed.test/back-word.jpg",
          audioUrl: "https://signed.test/word.mp3",
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
  });
});
