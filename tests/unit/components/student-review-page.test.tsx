import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StudentReviewPage from "@/app/(dashboard)/student/review/page";
import { getStudentFlashcardDeck } from "@/features/flashcards/server/queries";
import { getMyEnrollment } from "@/features/student/server/queries";
import { getMyWrongAnswerReviews } from "@/features/wrong-answer-review/server/queries";
import { requireRole } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/features/student/server/queries", () => ({
  getMyEnrollment: vi.fn(),
}));
vi.mock("@/features/flashcards/server/queries", () => ({
  getStudentFlashcardDeck: vi.fn(),
  getStudentStarredPageIds: vi.fn(async () => []),
}));
vi.mock("@/features/flashcards/components/student-flashcard-reader", () => ({
  StudentFlashcardReader: ({ courseName }: { courseName: string }) => (
    <div>Flashcard của {courseName}</div>
  ),
}));
vi.mock("@/features/wrong-answer-review/server/queries", () => ({
  getMyWrongAnswerReviews: vi.fn(),
}));
vi.mock(
  "@/features/wrong-answer-review/components/wrong-answer-review",
  () => ({
    WrongAnswerReview: () => <div>Danh sách câu sai</div>,
  }),
);

describe("StudentReviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(undefined as never);
    vi.mocked(getMyEnrollment).mockResolvedValue({
      class: { course: { id: "course-1", title: "HSK 1" } },
    } as never);
    vi.mocked(getStudentFlashcardDeck).mockResolvedValue({} as never);
    vi.mocked(getMyWrongAnswerReviews).mockResolvedValue([]);
  });

  it("khóa role học viên, lấy đúng khóa đang học và hiển thị hai tab ôn tập", async () => {
    render(await StudentReviewPage());

    expect(requireRole).toHaveBeenCalledWith("student");
    expect(getStudentFlashcardDeck).toHaveBeenCalledWith("course-1");
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

  it("đếm đúng số câu cần ôn trên nhãn tab", async () => {
    vi.mocked(getMyWrongAnswerReviews).mockResolvedValue([
      {},
      {},
      {},
    ] as never);

    render(await StudentReviewPage());

    expect(
      screen.getByRole("tab", { name: /Ôn Tập Câu Sai/ }),
    ).toHaveTextContent("Ôn Tập Câu Sai3");
  });
});
