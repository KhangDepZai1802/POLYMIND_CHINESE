import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/b2c/server/actions", () => ({
  createB2CClassAction: mocks.create,
}));
vi.mock("@/features/b2c/server/teacher-management-actions", () => ({
  readTeacherClassEditAction: mocks.read,
  saveTeacherClassAction: mocks.save,
  readTeacherStudentEditAction: vi.fn(),
  saveTeacherStudentAction: vi.fn(),
}));
import { B2CClassFormDialog } from "@/features/b2c/components/class-form-dialog";
import { TeacherClassManageDialog } from "@/features/b2c/components/teacher-management-dialogs";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.create.mockResolvedValue({ success: "Đã tạo lớp" });
  mocks.save.mockResolvedValue({ success: true });
  mocks.read.mockResolvedValue({
    id: "class-a",
    name: "Lớp A",
    program_slug: "tieng-anh",
    capacity: 10,
    campus: "",
    delivery_mode: "offline",
    start_date: "2026-10-01",
    end_date: "2026-12-31",
    status: "active",
    notes: "",
    updated_at: "2026-10-16T00:00:00Z",
  });
});
afterEach(cleanup);
describe("course end date inputs", () => {
  it("sends optional end date when creating a class", async () => {
    render(
      <B2CClassFormDialog programSlug="tieng-anh" programTitle="Tiếng Anh" />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Thêm lớp mới" }));
    expect(screen.getByLabelText("Ngày kết thúc khóa học")).not.toBeRequired();
    fireEvent.change(screen.getByLabelText("Tên lớp *"), {
      target: { value: "Lớp A" },
    });
    fireEvent.change(screen.getByLabelText("Ngày khai giảng khóa học"), {
      target: { value: "2026-10-01" },
    });
    fireEvent.change(screen.getByLabelText("Ngày kết thúc khóa học"), {
      target: { value: "2026-12-31" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Tạo lớp" }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledOnce());
    const payload = mocks.create.mock.calls[0]?.[1] as FormData;
    expect(payload.get("end_date")).toBe("2026-12-31");
  });
  it("loads the saved date and permits clearing it when editing", async () => {
    render(<TeacherClassManageDialog classId="class-a" />);
    fireEvent.click(screen.getByRole("button", { name: "Sửa thông tin lớp" }));
    await screen.findByDisplayValue("2026-12-31");
    fireEvent.change(screen.getByLabelText("Ngày kết thúc khóa học"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Lưu lớp" }));
    await waitFor(() =>
      expect(mocks.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "class-a",
          expected_updated_at: "2026-10-16T00:00:00Z",
          data: expect.objectContaining({ end_date: "" }),
        }),
      ),
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
