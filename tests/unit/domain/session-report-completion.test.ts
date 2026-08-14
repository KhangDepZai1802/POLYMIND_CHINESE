import { describe, expect, it } from "vitest";

import {
  emptySessionReportForm,
  getReportCompletion,
  getSectionStatuses,
  type CompletionInput,
  type SessionReportForm,
} from "@/features/session-reports/domain/completion";

/**
 * Đầu vào của một buổi CHƯA ai đụng tới.
 *
 * ⛔ KHÔNG còn khoá `attendance` (`TEACHER-REPORT-3`). Chuyên cần đọc thẳng từ
 * điểm danh và không còn điều kiện nào để "xong", nên hàm tính cũng không nhận
 * nó nữa — thêm lại khoá đó vào đây là typecheck đỏ ngay.
 */
function blank(overrides: Partial<CompletionInput> = {}): CompletionInput {
  return {
    form: emptySessionReportForm(),
    lesson: { lessonLog: "" },
    students: [],
    evidenceCount: 0,
    ...overrides,
  };
}

/** Biểu mẫu đã điền đủ 9 mục — mốc để từng bài đục một lỗ vào. */
function completeForm(): SessionReportForm {
  return {
    ...emptySessionReportForm(),
    mode: "offline",
    topic: "Bài 11 — Đàm phán lãi suất",
    // `TEACHER-REPORT-2`: mục 3 đọc chữ giáo viên GÕ, không còn tra `lesson_id`.
    lesson_title: "Bài 11 — Đàm phán lãi suất vay doanh nghiệp",
    plan_completion: "70_89",
    comprehension_level: 4,
    interaction_level: 5,
    focus_level: 3,
    homework_completion: "gt_90",
    no_students_of_note: true,
    has_issue: false,
    next_content: "Bài 12 — Hợp đồng tín dụng",
    evidence_kinds: ["materials"],
    overall_rating: "good",
  };
}

function complete(overrides: Partial<CompletionInput> = {}): CompletionInput {
  return blank({
    form: completeForm(),
    lesson: { lessonLog: "Đã dạy xong" },
    ...overrides,
  });
}

function stateOf(input: CompletionInput, sectionNumber: number) {
  return getSectionStatuses(input).find((s) => s.number === sectionNumber)?.state;
}

describe("mục lục báo cáo — trạng thái tính từ NỘI DUNG, không từ việc ghé qua", () => {
  it("biểu mẫu trắng: 8 mục giáo viên phải điền đều 'chưa điền', không mục nào tự xanh", () => {
    const { sections, doneCount, isComplete } = getReportCompletion(blank());

    expect(sections).toHaveLength(9);
    // Chỉ mục 2 xanh sẵn — nó KHÔNG có ô nào để giáo viên điền, số liệu đọc
    // thẳng từ điểm danh (`TEACHER-REPORT-3`). Tám mục còn lại phải trắng.
    expect(doneCount).toBe(1);
    expect(isComplete).toBe(false);
    expect(sections.filter((s) => s.state === "empty")).toHaveLength(8);
    expect(sections.find((s) => s.number === 2)?.state).toBe("done");
  });

  it("🔴 hàm tính KHÔNG nhận tham số nào về 'đã mở mục' — mở ra rồi vuốt đi vẫn là chưa điền", () => {
    // Không có cách nào để nói với hàm này rằng giáo viên đã ghé mục 7.
    // Bài kiểm dựng lại đúng kịch bản user mô tả: mở mục, không gõ gì, đi tiếp.
    const before = stateOf(blank(), 7);
    const after = stateOf(blank(), 7);

    expect(before).toBe("empty");
    expect(after).toBe("empty");
  });

  it("mục đã điền đủ thì xanh kể cả khi giáo viên chưa cuộn tới (mở lại bản nháp cũ)", () => {
    expect(getReportCompletion(complete()).isComplete).toBe(true);
    expect(getReportCompletion(complete()).doneCount).toBe(9);
  });
});

describe("bỏ trống KHÔNG được tính là đã trả lời (D-43 điểm 5)", () => {
  it("mục 5 để trống ⇒ chưa điền, không phải xong", () => {
    const input = complete({
      form: { ...completeForm(), no_students_of_note: false },
    });

    expect(stateOf(input, 5)).toBe("empty");
    expect(getReportCompletion(input).isComplete).toBe(false);
  });

  it("mục 5 chỉ xong khi tick 'Không có học viên cần lưu ý'", () => {
    const input = complete({
      form: { ...completeForm(), no_students_of_note: true },
    });

    expect(stateOf(input, 5)).toBe("done");
  });

  it("mục 6 chưa trả lời Không/Có ⇒ chưa điền", () => {
    const input = complete({ form: { ...completeForm(), has_issue: null } });

    expect(stateOf(input, 6)).toBe("empty");
    expect(getReportCompletion(input).isComplete).toBe(false);
  });

  it("mục 6 chọn 'Không' là một câu trả lời hợp lệ ⇒ xong", () => {
    expect(stateOf(complete(), 6)).toBe("done");
  });
});

describe("phân biệt 'đang dở' với 'chưa điền'", () => {
  it("chọn học viên nhưng chưa nhận xét ⇒ đang dở, kèm câu nói rõ thiếu gì", () => {
    const input = complete({
      form: { ...completeForm(), no_students_of_note: false },
      students: [
        { category: "needs_support", enrollment_id: "e1", note: "Cần ôn thêm" },
        { category: "needs_support", enrollment_id: "e2", note: "" },
        { category: "outstanding", enrollment_id: "e3", note: "Tiến bộ rõ" },
      ],
    });

    const section = getSectionStatuses(input).find((s) => s.number === 5);
    expect(section?.state).toBe("partial");
    expect(section?.hint).toContain("1 người chưa có nhận xét");
  });

  it("học viên của mục 7 KHÔNG tính vào mục 5", () => {
    const input = complete({
      form: { ...completeForm(), no_students_of_note: false },
      students: [{ category: "follow_up_next", enrollment_id: "e1", note: "" }],
    });

    // Mục 5 vẫn rỗng vì hàng duy nhất thuộc mục 7.
    expect(stateOf(input, 5)).toBe("empty");
  });

  it("mục 6 chọn 'Có' mà thiếu mô tả ⇒ đang dở", () => {
    const input = complete({
      form: {
        ...completeForm(),
        has_issue: true,
        issue_categories: ["facility"],
        issue_impact: "completed_anyway",
        issue_severity: "medium",
      },
    });

    const section = getSectionStatuses(input).find((s) => s.number === 6);
    expect(section?.state).toBe("partial");
    expect(section?.hint).toContain("mô tả");
  });
});

/**
 * 🔴 `TEACHER-REPORT-3` — ghim lại cổng thứ HAI đã khoá nút Gửi trên production.
 *
 * User báo 2026-08-14: *"phần 2 chuyên cần học viên, vắng không cần phải có lí
 * do, đừng ràng buộc cái này dẫn đến không thể gửi báo cáo"*.
 *
 * Bản trước tính mục 2 xong hay chưa bằng số dòng lý do đã ghi. Giáo viên thường
 * KHÔNG biết vì sao học viên vắng, nên cổng đó hoặc chặn báo cáo vô thời hạn,
 * hoặc ép bịa một lý do vào hồ sơ học viên — cùng hình dạng sai với
 * `TEACHER-REPORT-2` (chặn người dùng vì thứ họ không kiểm soát được).
 *
 * Bài này đỏ ngay nếu ai đó nối lại mục 2 với lý do vắng.
 */
describe("mục 2 — chuyên cần: LÝ DO VẮNG LÀ TUỲ CHỌN", () => {
  it("🔴 mục 2 luôn xong — không có đầu vào nào làm nó đỏ được", () => {
    // Không có cách nào nói với hàm này rằng "còn 3 người vắng chưa ghi lý do":
    // `CompletionInput` không còn khoá `attendance`. Đó chính là điều cần ghim.
    expect(stateOf(blank(), 2)).toBe("done");
    expect(stateOf(complete(), 2)).toBe("done");
  });

  it("🔴 biểu mẫu đủ 9 mục vẫn gửi được khi KHÔNG một lý do vắng nào được ghi", () => {
    const result = getReportCompletion(complete());

    expect(result.isComplete).toBe(true);
    expect(result.missing.map((s) => s.number)).not.toContain(2);
  });
});

describe("mục 3 — gộp nhật ký buổi học", () => {
  it("thiếu bài học hoặc nội dung đã giảng ⇒ chưa xong", () => {
    const input = complete({ form: { ...completeForm(), lesson_title: "" } });
    const section = getSectionStatuses(input).find((s) => s.number === 3);

    expect(section?.state).toBe("partial");
    expect(section?.hint).toContain("bài học đã dạy");
  });

  /**
   * 🔴 `TEACHER-REPORT-2` — ghim lại chỗ đã khoá cứng nút Gửi trên production.
   *
   * Bản đầu tính mục 3 xong hay chưa bằng `lesson.lessonId` tra từ bảng
   * `lessons`. Khoá học chưa nhập giáo trình thì `lesson_id` KHÔNG BAO GIỜ set
   * được ⇒ mục 3 mãi "chưa xong" ⇒ nút Gửi bị chặn vĩnh viễn, và giáo viên
   * không có cách nào tự gỡ. Nay mục 3 chỉ nhìn chữ giáo viên gõ.
   *
   * Bài này đỏ ngay nếu ai đó nối lại mục 3 với giáo trình: `CompletionInput`
   * không còn nhận `lessonId`, nên gõ tay là điều kiện DUY NHẤT.
   */
  it("🔴 mục 3 xong CHỈ nhờ chữ giáo viên gõ — không cần khoá có giáo trình", () => {
    const typed = complete({
      form: { ...completeForm(), lesson_title: "Bài tự gõ, khoá chưa có giáo trình" },
    });
    expect(stateOf(typed, 3)).toBe("done");
    expect(getReportCompletion(typed).isComplete).toBe(true);

    // Và bỏ trống ô đó thì mục 3 đứt ngay — không có đường vòng nào khác.
    const blankTitle = complete({ form: { ...completeForm(), lesson_title: "   " } });
    expect(stateOf(blankTitle, 3)).toBe("partial");
    expect(getReportCompletion(blankTitle).isComplete).toBe(false);
  });

  it("chọn 'Có' phần chưa hoàn thành thì phải kèm mô tả VÀ lý do", () => {
    const input = complete({
      form: { ...completeForm(), has_unfinished: true, unfinished_content: "Nghe hiểu 11.3" },
    });

    expect(stateOf(input, 3)).toBe("partial");

    const filledIn = complete({
      form: {
        ...completeForm(),
        has_unfinished: true,
        unfinished_content: "Nghe hiểu 11.3",
        unfinished_reason: "Lớp đóng vai lâu hơn dự kiến",
      },
    });
    expect(stateOf(filledIn, 3)).toBe("done");
  });
});

describe("mục 4 — bốn thang", () => {
  it("thiếu một thang là chưa xong, và nói rõ đã chọn mấy trên bốn", () => {
    const input = complete({ form: { ...completeForm(), focus_level: null } });
    const section = getSectionStatuses(input).find((s) => s.number === 4);

    expect(section?.state).toBe("partial");
    expect(section?.hint).toContain("3/4");
  });

  it("4.4 'Chưa có bài tập cần kiểm tra' vẫn là một câu trả lời hợp lệ", () => {
    const input = complete({
      form: { ...completeForm(), homework_completion: "no_homework" },
    });
    expect(stateOf(input, 4)).toBe("done");
  });
});

describe("mục 8 — tick loại ảnh thì phải có ảnh thật", () => {
  it("tick 'Hình ảnh lớp học' mà chưa tải ảnh ⇒ chưa xong", () => {
    const input = complete({
      form: { ...completeForm(), evidence_kinds: ["classroom_photo"] },
      evidenceCount: 0,
    });

    const section = getSectionStatuses(input).find((s) => s.number === 8);
    expect(section?.state).toBe("partial");
    expect(section?.hint).toContain("chưa tải ảnh");
  });

  it("tick loại ảnh và đã tải ảnh ⇒ xong", () => {
    const input = complete({
      form: { ...completeForm(), evidence_kinds: ["classroom_photo"] },
      evidenceCount: 2,
    });
    expect(stateOf(input, 8)).toBe("done");
  });

  it("loại KHÔNG cần file (tài liệu) thì không đòi ảnh", () => {
    expect(stateOf(complete(), 8)).toBe("done");
  });

  it("tải ảnh nhưng chưa tick loại nào ⇒ đang dở, báo đúng số ảnh", () => {
    const input = complete({
      form: { ...completeForm(), evidence_kinds: [] },
      evidenceCount: 2,
    });

    const section = getSectionStatuses(input).find((s) => s.number === 8);
    expect(section?.state).toBe("partial");
    expect(section?.hint).toContain("2 ảnh");
  });
});

describe("mục lục và nút Gửi dùng CHUNG một luật", () => {
  it("isComplete đúng bằng 'không còn mục nào ngoài done'", () => {
    const cases: CompletionInput[] = [
      blank(),
      complete(),
      complete({ form: { ...completeForm(), overall_rating: null } }),
      complete({ form: { ...completeForm(), has_issue: null } }),
      complete({ form: { ...completeForm(), lesson_title: "" } }),
      complete({ lesson: { lessonLog: "" } }),
    ];

    for (const input of cases) {
      const result = getReportCompletion(input);
      const allDone = result.sections.every((s) => s.state === "done");

      expect(result.isComplete).toBe(allDone);
      expect(result.doneCount).toBe(
        result.sections.filter((s) => s.state === "done").length,
      );
      expect(result.missing).toHaveLength(9 - result.doneCount);
    }
  });

  it("mọi mục chưa xong đều có câu nói rõ thiếu gì — dấu vàng trơ trọi là vô dụng", () => {
    const result = getReportCompletion(blank());

    for (const section of result.missing) {
      expect(section.hint, `mục ${section.number} thiếu câu giải thích`).toBeTruthy();
    }
  });
});
