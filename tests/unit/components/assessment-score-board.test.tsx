import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/features/assessments/server/actions", () => ({
  saveAssessmentResultAction: vi.fn(),
  publishAssessmentResultsAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import {
  AssessmentScoreBoard,
  type ScoreRow,
} from "@/features/assessments/components/assessment-score-board";

const ENROLLMENT_ID = "33333333-3333-4333-8333-333333333331";

const ROWS: ScoreRow[] = [
  {
    id: ENROLLMENT_ID,
    status: "active",
    student: {
      id: "44444444-4444-4444-8444-444444444441",
      student_code: "HV001",
      full_name: "Nguyễn Văn A",
    },
    result: null,
  },
];

function renderBoard() {
  const { container } = render(
    <AssessmentScoreBoard
      assessmentId="55555555-5555-4555-8555-555555555551"
      classId="66666666-6666-4666-8666-666666666661"
      maxScore={100}
      publishedAt={null}
      rows={ROWS}
    />,
  );
  // Form nhập điểm là form duy nhất có textarea (form Công bố chỉ có nút bấm).
  const form = container.querySelector<HTMLFormElement>("form:has(textarea)");
  if (!form) throw new Error("Không tìm thấy form nhập điểm");

  return {
    payload: () => Object.fromEntries(new FormData(form).entries()),
  };
}

describe("AssessmentScoreBoard — ô điểm để trống ≠ 0 điểm", () => {
  it("'Tính TB 6 kỹ năng' chỉ lấy trung bình các kỹ năng ĐÃ nhập", async () => {
    const user = userEvent.setup();
    renderBoard();

    // Chỉ chấm 3/6 kỹ năng: 90, 80, 70.
    await user.type(screen.getByLabelText("Nghe"), "90");
    await user.type(screen.getByLabelText("Nói"), "80");
    await user.type(screen.getByLabelText("Đọc"), "70");

    await user.click(screen.getByRole("button", { name: /Tính TB 6 kỹ năng/ }));

    // Đúng: (90+80+70)/3 = 80.
    // Sai (coi ô trống là 0): (90+80+70)/6 = 40 → học viên bị thiệt 40 điểm.
    expect(screen.getByLabelText(/^Tổng/)).toHaveValue(80);
  });

  it("không nhập gì thì không có điểm nào bị bịa ra", async () => {
    const { payload } = renderBoard();
    const sent = payload();

    // Chuỗi rỗng — schema map về null (chưa chấm), KHÔNG phải số 0.
    expect(sent["overall_score"]).toBe("");
    expect(sent["listening_score"]).toBe("");
    expect(sent["enrollment_id"]).toBe(ENROLLMENT_ID);
  });

  it("bấm Tính TB khi chưa nhập kỹ năng nào thì không ghi đè ô điểm tổng", async () => {
    const user = userEvent.setup();
    renderBoard();

    await user.type(screen.getByLabelText(/^Tổng/), "75");
    await user.click(screen.getByRole("button", { name: /Tính TB 6 kỹ năng/ }));

    // Không có kỹ năng nào để tính TB → giữ nguyên điểm giáo viên đã gõ,
    // không biến thành NaN hay 0.
    expect(screen.getByLabelText(/^Tổng/)).toHaveValue(75);
  });
});
