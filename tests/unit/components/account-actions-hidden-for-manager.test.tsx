import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmationProvider } from "@/components/shared/confirmation-provider";
import { StudentRowActions } from "@/features/students/components/student-row-actions";
import { TeacherRowActions } from "@/features/teachers/components/teacher-row-actions";

vi.mock("@/features/teachers/server/actions", () => ({
  resetTeacherPasswordAction: vi.fn(),
  toggleTeacherActiveAction: vi.fn(),
  updateTeacherAction: vi.fn(),
  createTeacherAction: vi.fn(),
}));
vi.mock("@/features/students/server/actions", () => ({
  provisionStudentAccountAction: vi.fn(),
  archiveStudentAction: vi.fn(),
  updateStudentAction: vi.fn(),
  createStudentAction: vi.fn(),
}));

const TEACHER = {
  id: "11111111-1111-4111-8111-111111111111",
  teacher_code: "GV000002",
  specialization: "HSK1-6",
  bio: null,
  is_active: true,
  profile: {
    full_name: "Khang dep zai",
    phone: "0944117733",
    email: "khanglehihi18@gmail.com",
    username: "khang",
  },
};

const STUDENT = {
  id: "22222222-2222-4222-8222-222222222222",
  student_code: "HV001",
  full_name: "Học viên Một",
  user_id: "33333333-3333-4333-8333-333333333333",
} as never;

// `useConfirmSubmit` đòi ConfirmationProvider ở trên cây, nếu không component
// ném ngay lúc render.
function renderWithProviders(ui: React.ReactElement) {
  return render(<ConfirmationProvider>{ui}</ConfirmationProvider>);
}

async function openMenu() {
  await userEvent.click(screen.getByRole("button", { name: "Thao tác" }));
}

/**
 * Bug user báo trên production 2026-08-03: đăng nhập bằng giáo vụ, vào
 * `/admin/teachers`, menu "..." của mỗi dòng vẫn bày **Đặt lại mật khẩu** và
 * **Khóa tài khoản** — hai việc `D-2` điểm (4) đã loại khỏi role này.
 *
 * Server action gác đúng (`requireRole("super_admin")`) nên không rò quyền,
 * nhưng một nút bấm vào là bị đá về trang chủ thì tệ hơn là không có nút.
 */
describe("giáo vụ KHÔNG thấy thao tác tài khoản", () => {
  it("dòng giáo viên: ẩn Đặt lại mật khẩu + Khóa tài khoản, GIỮ Sửa hồ sơ", async () => {
    renderWithProviders(<TeacherRowActions teacher={TEACHER} canManageAccounts={false} />);
    await openMenu();

    expect(screen.getByText("Sửa hồ sơ")).toBeInTheDocument();
    expect(screen.queryByText("Đặt lại mật khẩu")).not.toBeInTheDocument();
    expect(screen.queryByText("Khóa tài khoản")).not.toBeInTheDocument();
    expect(screen.queryByText("Mở khóa tài khoản")).not.toBeInTheDocument();
  });

  it("dòng giáo viên: super admin vẫn thấy đủ", async () => {
    renderWithProviders(<TeacherRowActions teacher={TEACHER} canManageAccounts />);
    await openMenu();

    expect(screen.getByText("Sửa hồ sơ")).toBeInTheDocument();
    expect(screen.getByText("Đặt lại mật khẩu")).toBeInTheDocument();
    expect(screen.getByText("Khóa tài khoản")).toBeInTheDocument();
  });

  it("dòng học viên: ẩn Đặt lại mật khẩu nhưng GIỮ Lưu trữ hồ sơ", async () => {
    // Lưu trữ hồ sơ là thao tác trên HỒ SƠ, thuộc quyền quản lý của giáo vụ —
    // ẩn nhầm nó là cắt mất việc họ phải làm hằng ngày.
    renderWithProviders(
      <StudentRowActions
        student={STUDENT}
        levels={[]}
        canManageAccounts={false}
      />,
    );
    await openMenu();

    expect(screen.queryByText("Đặt lại mật khẩu")).not.toBeInTheDocument();
    expect(screen.queryByText("Cấp tài khoản")).not.toBeInTheDocument();
    expect(screen.getByText("Lưu trữ hồ sơ")).toBeInTheDocument();
  });
});
