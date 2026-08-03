import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EnrollmentPanel } from "@/features/enrollments/components/enrollment-panel";

vi.mock("@/features/enrollments/server/actions", () => ({
  changeEnrollmentStatusAction: vi.fn(),
  enrollStudentAction: vi.fn(),
  transferEnrollmentAction: vi.fn(),
}));

type PanelEnrollment = React.ComponentProps<
  typeof EnrollmentPanel
>["enrollments"][number];

function makeEnrollment(
  index: number,
  overrides: Partial<PanelEnrollment> = {},
): PanelEnrollment {
  return {
    id: `enrollment-${index}`,
    status: "active",
    enrolled_on: "2026-08-02",
    started_on: null,
    ended_on: null,
    reason: null,
    student: {
      id: `student-${index}`,
      student_code: `HV${String(index).padStart(6, "0")}`,
      full_name: `Học viên ${index}`,
      phone: null,
    },
    enrollment_status_history: [],
    ...overrides,
  };
}

function renderPanel(enrollments: PanelEnrollment[], capacity = 40) {
  return render(
    <EnrollmentPanel
      classId="12f6221e-738d-45b1-8cbc-b5dba177a596"
      capacity={capacity}
      enrollments={enrollments}
      enrollableStudents={[]}
      transferTargets={[]}
    />,
  );
}

/**
 * User báo 2026-08-03: trang `/admin/classes/[id]` phải cuộn rất nhiều mới hết
 * danh sách học viên. Nguyên nhân đo được: mỗi hàng dựng sẵn 4–5 nút thao tác
 * trải ngang trong cột rộng ~21rem nên luôn xuống 2–3 dòng (~130px/hàng), và
 * cả 40 hàng đều dựng cùng lúc.
 *
 * Ba bài dưới ghim đúng ba thứ giữ cho thẻ không dài lại: chặn số hàng hiện
 * sẵn, gom thao tác vào menu, và lọc/tìm để không phải cuộn tay.
 */
describe("thẻ học viên ở trang chi tiết lớp không được dài vô hạn", () => {
  it("lớp 31 học viên chỉ dựng 8 hàng, phần còn lại nằm sau nút Xem thêm", async () => {
    const user = userEvent.setup();
    renderPanel(Array.from({ length: 31 }, (_, i) => makeEnrollment(i + 1)));

    expect(screen.getAllByRole("listitem")).toHaveLength(8);

    await user.click(
      screen.getByRole("button", { name: "Xem thêm 23 học viên" }),
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(31);

    // Mở rồi phải thu lại được — nếu không thì bấm nhầm một cái là trang dài
    // lại y như cũ mà không có đường lùi.
    await user.click(screen.getByRole("button", { name: "Thu gọn danh sách" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(8);
  });

  it("thao tác nằm trong menu của từng hàng, không trải ngang ra hàng", async () => {
    const user = userEvent.setup();
    renderPanel([makeEnrollment(1)]);

    // Trước khi mở menu: hàng chỉ có tên + trạng thái + một nút "…".
    expect(screen.queryByText("Rút học")).not.toBeInTheDocument();
    expect(screen.queryByText("Chuyển lớp")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Thao tác cho Học viên 1" }),
    );
    expect(screen.getByText("Rút học")).toBeInTheDocument();
    expect(screen.getByText("Tạm dừng")).toBeInTheDocument();
    expect(screen.getByText("Lịch sử ghi danh")).toBeInTheDocument();
  });

  it("tìm không dấu ra được tên có dấu, và ghi danh đã đóng nằm sau bộ lọc riêng", async () => {
    const user = userEvent.setup();
    renderPanel([
      ...Array.from({ length: 9 }, (_, i) => makeEnrollment(i + 1)),
      makeEnrollment(10, {
        student: {
          id: "student-10",
          student_code: "HV000010",
          full_name: "Phạm Thị Ngọc Dũng",
          phone: null,
        },
      }),
      makeEnrollment(11, {
        status: "withdrawn",
        ended_on: "2026-08-03",
        student: {
          id: "student-11",
          student_code: "HV000011",
          full_name: "Trần Văn Đã Rút",
          phone: null,
        },
      }),
    ]);

    // Ghi danh đã đóng KHÔNG chen vào danh sách đang học nữa.
    expect(screen.queryByText("Trần Văn Đã Rút")).not.toBeInTheDocument();

    await user.type(
      screen.getByLabelText("Tìm học viên trong lớp"),
      "ngoc dung",
    );
    expect(screen.getByText("Phạm Thị Ngọc Dũng")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    await user.clear(screen.getByLabelText("Tìm học viên trong lớp"));
    await user.click(screen.getByRole("button", { name: /Đã đóng/ }));
    expect(screen.getByText("Trần Văn Đã Rút")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });
});
