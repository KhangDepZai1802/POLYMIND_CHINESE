import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StudentReviewPage from "@/app/(dashboard)/student/review/page";
import {
  getStudentFlashcardDeck,
  getStudentFlashcardDeckOptions,
} from "@/features/flashcards/server/queries";
import { getMyEnrollment } from "@/features/student/server/queries";
import { getMyWrongAnswerReviews } from "@/features/wrong-answer-review/server/queries";
import { requireRole } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/features/student/server/queries", () => ({
  getMyEnrollment: vi.fn(),
}));
vi.mock("@/features/flashcards/server/queries", () => ({
  getStudentFlashcardDeck: vi.fn(),
  getStudentFlashcardDeckOptions: vi.fn(),
  getStudentStarredPageIds: vi.fn(async () => []),
}));
vi.mock("@/features/flashcards/components/student-flashcard-reader", () => ({
  StudentFlashcardReader: ({ courseName }: { courseName: string }) => (
    <div>Flashcard của {courseName}</div>
  ),
}));
vi.mock(
  "@/features/flashcards/components/student-flashcard-deck-picker",
  () => ({
    StudentFlashcardDeckPicker: ({
      decks,
    }: {
      decks: { id: string; title: string }[];
    }) => <div>Chọn bộ: {decks.map((deck) => deck.title).join(", ")}</div>,
  }),
);
vi.mock("@/features/wrong-answer-review/server/queries", () => ({
  getMyWrongAnswerReviews: vi.fn(),
}));
vi.mock(
  "@/features/wrong-answer-review/components/wrong-answer-review",
  () => ({
    WrongAnswerReview: () => <div>Danh sách câu sai</div>,
  }),
);

/** `searchParams` là Promise ở App Router — bọc lại cho gọn. */
function params(value: { deck?: string } = {}) {
  return { searchParams: Promise.resolve(value) };
}

describe("StudentReviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    vi.mocked(getMyEnrollment).mockResolvedValue({
      class: { course: { id: "course-1", title: "HSK 1" } },
    } as never);
    vi.mocked(getStudentFlashcardDeckOptions).mockResolvedValue([
      { id: "deck-1", title: "Từ vựng", description: null, sectionCount: 3 },
    ]);
    vi.mocked(getStudentFlashcardDeck).mockResolvedValue({} as never);
    vi.mocked(getMyWrongAnswerReviews).mockResolvedValue([]);
  });

  it("khóa role học viên, lấy đúng khóa đang học và hiển thị hai tab ôn tập", async () => {
    render(await StudentReviewPage(params()));

    expect(requireRole).toHaveBeenCalledWith("student");
    expect(getStudentFlashcardDeckOptions).toHaveBeenCalledWith("course-1");
    expect(getMyWrongAnswerReviews).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("tab", { name: "Flashcard Từ Vựng" }),
    ).toBeInTheDocument();
    // Nhãn tab nay mang thêm số câu cần ôn, nên khớp theo mẫu chứ không so
    // bằng chuỗi tuyệt đối.
    expect(
      screen.getByRole("tab", { name: /Ôn Tập Câu Sai/ }),
    ).toHaveTextContent("Ôn Tập Câu Sai0");
    expect(screen.getByText("Flashcard của HSK 1")).toBeInTheDocument();
  });

  /**
   * `MULTIDECK-1f` — khoá MỘT bộ phải vào thẳng, không thêm một cú bấm nào.
   * Đây là ca phổ biến nhất; bắt nó bấm qua màn chọn một-lựa-chọn là lấy thời
   * gian của số đông để phục vụ trường hợp hiếm.
   */
  it("khoá chỉ có MỘT bộ thì vào thẳng trình đọc, không hiện màn chọn bộ", async () => {
    render(await StudentReviewPage(params()));

    expect(getStudentFlashcardDeck).toHaveBeenCalledWith("deck-1");
    expect(screen.queryByText(/^Chọn bộ:/)).not.toBeInTheDocument();
  });

  it("khoá NHIỀU bộ mà chưa chọn thì hiện màn chọn bộ và chưa tải bộ nào", async () => {
    vi.mocked(getStudentFlashcardDeckOptions).mockResolvedValue([
      { id: "deck-1", title: "Từ vựng", description: null, sectionCount: 3 },
      { id: "deck-2", title: "Ngữ pháp", description: null, sectionCount: 2 },
    ]);

    render(await StudentReviewPage(params()));

    expect(screen.getByText("Chọn bộ: Từ vựng, Ngữ pháp")).toBeInTheDocument();
    // Chưa chọn thì KHÔNG tải bộ nào: tải sẵn là ký URL cho ảnh của một bộ mà
    // học viên có thể không mở.
    expect(getStudentFlashcardDeck).not.toHaveBeenCalled();
  });

  it("chọn bộ nào thì tải đúng bộ đó", async () => {
    vi.mocked(getStudentFlashcardDeckOptions).mockResolvedValue([
      { id: "deck-1", title: "Từ vựng", description: null, sectionCount: 3 },
      { id: "deck-2", title: "Ngữ pháp", description: null, sectionCount: 2 },
    ]);

    render(await StudentReviewPage(params({ deck: "deck-2" })));

    expect(getStudentFlashcardDeck).toHaveBeenCalledWith("deck-2");
    expect(screen.getByText("Flashcard của HSK 1")).toBeInTheDocument();
  });

  /**
   * Mã bộ trong địa chỉ không thuộc khoá của học viên (link người khác gửi,
   * hoặc sửa tay) ⇒ KHÔNG tải bộ đó. Đây là vế fail-closed: `getStudent…Deck`
   * có RLS chặn thật, nhưng không được gọi nó với id lạ ngay từ đầu.
   */
  it("mã bộ lạ trong địa chỉ không kéo được bộ của khoá khác", async () => {
    vi.mocked(getStudentFlashcardDeckOptions).mockResolvedValue([
      { id: "deck-1", title: "Từ vựng", description: null, sectionCount: 3 },
      { id: "deck-2", title: "Ngữ pháp", description: null, sectionCount: 2 },
    ]);

    render(await StudentReviewPage(params({ deck: "deck-cua-khoa-khac" })));

    expect(getStudentFlashcardDeck).not.toHaveBeenCalled();
    expect(screen.getByText("Chọn bộ: Từ vựng, Ngữ pháp")).toBeInTheDocument();
  });

  it("đếm đúng số câu cần ôn trên nhãn tab", async () => {
    vi.mocked(getMyWrongAnswerReviews).mockResolvedValue([
      {},
      {},
      {},
    ] as never);

    render(await StudentReviewPage(params()));

    expect(
      screen.getByRole("tab", { name: /Ôn Tập Câu Sai/ }),
    ).toHaveTextContent("Ôn Tập Câu Sai3");
  });
});
