import { describe, expect, it } from "vitest";

import {
  clampQuestionPage,
  questionPageHref,
} from "@/features/question-bank/domain/pagination";

describe("question bank pagination", () => {
  it("chặn trang vượt quá trang cuối thay vì gửi range lỗi lên server", () => {
    expect(clampQuestionPage("3", 21)).toEqual({ page: 2, totalPages: 2 });
    expect(clampQuestionPage("abc", 21)).toEqual({ page: 1, totalPages: 2 });
  });

  it("giữ nguyên bộ lọc khi chuyển trang", () => {
    expect(
      questionPageHref(
        "/teacher/exercises/question-bank",
        { q: "nghe HSK", skill: "listening", visibility: "private" },
        2,
      ),
    ).toBe(
      "/teacher/exercises/question-bank?q=nghe+HSK&skill=listening&visibility=private&page=2",
    );
  });
});
