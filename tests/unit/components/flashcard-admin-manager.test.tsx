import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FlashcardAdminManager } from "@/features/flashcards/components/flashcard-admin-manager";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/features/flashcards/server/actions", () => ({
  archiveFlashcardPageAction: vi.fn(),
  createFlashcardUploadTicketsAction: vi.fn(),
  discardFlashcardUploadsAction: vi.fn(),
  moveFlashcardPageAction: vi.fn(),
  publishFlashcardSectionAction: vi.fn(),
  saveFlashcardDeckAction: vi.fn(),
  saveFlashcardPageAction: vi.fn(),
  saveFlashcardSectionAction: vi.fn(),
  unpublishFlashcardSectionAction: vi.fn(),
}));

const course = {
  id: "11111111-1111-4111-8111-111111111111",
  code: "HSK1",
  title: "HSK 1",
  defaultSessionCount: 1,
  deck: { id: "22222222-2222-4222-8222-222222222222", status: "draft" },
} as const;

const deck = {
  id: course.deck.id,
  course_id: course.id,
  title: "Flashcard HSK 1",
  description: "Ôn từ vựng",
  status: "draft",
  created_by: "33333333-3333-4333-8333-333333333333",
  created_at: "2026-07-21T00:00:00Z",
  updated_at: "2026-07-21T00:00:00Z",
  sections: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      deck_id: course.deck.id,
      session_number: 1,
      title: "Chào hỏi",
      status: "draft",
      published_at: null,
      created_by: "33333333-3333-4333-8333-333333333333",
      created_at: "2026-07-21T00:00:00Z",
      updated_at: "2026-07-21T00:00:00Z",
      pages: [],
    },
  ],
} as const;

const basePage = {
  section_id: deck.sections[0].id,
  front_image_path: "front.png",
  back_image_path: "back.png",
  front_alt: "mặt trước",
  back_alt: "mặt sau",
  created_by: "33333333-3333-4333-8333-333333333333",
  archived_at: null,
  created_at: "2026-07-21T00:00:00Z",
  updated_at: "2026-07-21T00:00:00Z",
  frontUrl: null,
  backUrl: null,
  audioUrl: null,
} as const;

const deckWithPages = {
  ...deck,
  sections: [
    {
      ...deck.sections[0],
      pages: [
        {
          ...basePage,
          id: "55555555-5555-4555-8555-555555555551",
          kind: "session_cover",
          order_index: 0,
          term: null,
          audio_path: null,
        },
        {
          ...basePage,
          id: "55555555-5555-4555-8555-555555555552",
          kind: "vocabulary",
          order_index: 1,
          term: "你好",
          audio_path: "audio.mp3",
        },
      ],
    },
  ],
} as const;

describe("FlashcardAdminManager", () => {
  it("hiển thị mục lục buổi, trạng thái và khóa nút thêm khi đã đủ số buổi", () => {
    render(
      <FlashcardAdminManager
        courses={[course] as never}
        selectedCourseId={course.id}
        deck={deck as never}
      />,
    );

    expect(screen.getByText("Flashcard HSK 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buổi 1" })).toBeInTheDocument();
    expect(screen.getByText("Buổi 1 · Chào hỏi")).toBeInTheDocument();
    expect(screen.getByText("Đã đủ số buổi")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Thêm buổi" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Công bố buổi" }),
    ).toBeInTheDocument();
  });

  it("cho phép lưu trữ cả trang mở đầu lẫn trang từ vựng ở buổi nháp", () => {
    render(
      <FlashcardAdminManager
        courses={[course] as never}
        selectedCourseId={course.id}
        deck={deckWithPages as never}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Lưu trữ trang mở đầu" }),
    ).toBeEnabled();
    expect(screen.getByRole("button", { name: "Lưu trữ 你好" })).toBeEnabled();
    // Còn trang mở đầu thì trang từ vựng đầu tiên không được đẩy lên vị trí 0.
    expect(screen.getByRole("button", { name: "Đưa 你好 lên" })).toBeDisabled();
  });
});
