import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationProvider } from "@/components/shared/confirmation-provider";
import { StudentsDirectory } from "@/features/students/components/students-directory";

vi.mock("@/features/students/server/actions", () => ({
  provisionStudentAccountAction: vi.fn(),
  archiveStudentAction: vi.fn(),
  updateStudentAction: vi.fn(),
  createStudentAction: vi.fn(),
}));

type Student = React.ComponentProps<
  typeof StudentsDirectory
>["students"][number];

const LOP_01 = {
  id: "class-01",
  code: "LOP-01",
  name: "Tiếng Trung giao tiếp",
};
const LOP_02 = { id: "class-02", code: "LOP-02", name: "Tiếng Trung cơ bản" };

function makeStudent(index: number, overrides: Partial<Student> = {}): Student {
  return {
    id: `student-${index}`,
    student_code: `HV${String(index).padStart(6, "0")}`,
    full_name: `Học viên ${index}`,
    dob: null,
    gender: null,
    phone: null,
    email: null,
    address: null,
    guardian_name: null,
    guardian_phone: null,
    guardian_relation: null,
    current_level_id: null,
    target_level_id: null,
    learning_goal: null,
    note: null,
    user_id: `user-${index}`,
    profile: { username: `hv${index}`, email: null, is_active: true },
    status: "active",
    current_level: null,
    enrollments: [],
    ...overrides,
  } as Student;
}

function inClass(
  index: number,
  cls: typeof LOP_01,
  overrides: Partial<Student> = {},
) {
  return makeStudent(index, {
    enrollments: [{ id: `enr-${index}`, status: "active", class: cls }],
    ...overrides,
  });
}

function renderDirectory(students: Student[]) {
  return render(
    <ConfirmationProvider>
      <StudentsDirectory students={students} levels={[]} canManageAccounts />
    </ConfirmationProvider>,
  );
}

/** Mã học viên chỉ xuất hiện ở ô đầu mỗi hàng, nên đếm nó = đếm hàng đang hiện. */
function visibleCodes() {
  return screen.queryAllByText(/^HV\d{6}$/).map((el) => el.textContent);
}

/**
 * User báo 2026-08-03: *"học viên mà quá nhiều sẽ bị loạn, chia ra thành nhiều
 * lớp (mục) để dễ xem, có thanh tìm kiếm"*. Trước đó 55 hàng đổ thẳng vào một
 * bảng phẳng, không có ô tìm, muốn biết ai thuộc lớp nào phải dò từng dòng.
 */
describe("danh bạ học viên gom theo lớp", () => {
  const STUDENTS = [
    inClass(1, LOP_01),
    inClass(2, LOP_01),
    inClass(3, LOP_02),
    makeStudent(4, { user_id: null, profile: null }), // chưa xếp lớp, chưa có tài khoản
  ];

  it("mở trang thấy CẤU TRÚC trước: mỗi lớp một mục thu gọn, chưa hàng nào hiện", () => {
    renderDirectory(STUDENTS);

    expect(
      screen.getByRole("button", { name: /LOP-01.*2 học viên/ }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.getByRole("button", { name: /LOP-02.*1 học viên/ }),
    ).toBeInTheDocument();
    // Người chưa có lớp KHÔNG được lặng lẽ biến mất — đó chính là việc còn tồn.
    expect(
      screen.getByRole("button", { name: /Cần xếp lớp.*1 học viên/ }),
    ).toBeInTheDocument();

    expect(visibleCodes()).toEqual([]);
  });

  it("bấm vào một lớp chỉ mở đúng lớp đó", async () => {
    const user = userEvent.setup();
    renderDirectory(STUDENTS);

    await user.click(screen.getByRole("button", { name: /LOP-01/ }));
    expect(visibleCodes()).toEqual(["HV000001", "HV000002"]);

    await user.click(screen.getByRole("button", { name: /LOP-02/ }));
    expect(visibleCodes()).toEqual(["HV000001", "HV000002", "HV000003"]);
  });

  it("tìm không dấu ra tên có dấu và TỰ MỞ mục chứa kết quả", async () => {
    const user = userEvent.setup();
    renderDirectory([
      ...STUDENTS,
      inClass(5, LOP_02, { full_name: "Phạm Thị Ngọc Dũng" }),
    ]);

    await user.type(screen.getByLabelText(/Tìm học viên/), "ngoc dung");

    // Không phải bấm mở mục lần nữa — kết quả hiện ngay.
    expect(visibleCodes()).toEqual(["HV000005"]);
    expect(
      screen.queryByRole("button", { name: /LOP-01/ }),
    ).not.toBeInTheDocument();
  });

  it("tìm được bằng số điện thoại người giám hộ", async () => {
    const user = userEvent.setup();
    renderDirectory([
      ...STUDENTS,
      inClass(6, LOP_01, {
        full_name: "Trần Bảo An",
        guardian_name: "Trần Văn Bố",
        guardian_phone: "0944117733",
      }),
    ]);

    await user.type(screen.getByLabelText(/Tìm học viên/), "0944117733");
    expect(visibleCodes()).toEqual(["HV000006"]);
  });

  it("không khớp gì thì nói rõ và cho đường lùi", async () => {
    const user = userEvent.setup();
    renderDirectory(STUDENTS);

    await user.type(screen.getByLabelText(/Tìm học viên/), "khong-ai-ten-nay");
    expect(screen.getByText(/Không có học viên nào khớp/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Xóa từ khóa" }));
    expect(screen.getByRole("button", { name: /LOP-01/ })).toBeInTheDocument();
  });
});
