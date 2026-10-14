import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import B2CChangeHistoryPage from "@/app/(dashboard)/admin/b2c/history/page";
const mocks = vi.hoisted(() => ({ role: vi.fn(), history: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.role }));
vi.mock("@/features/b2c/server/change-history", () => ({
  getB2CChangeHistory: mocks.history,
}));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.role.mockResolvedValue({ role: "super_admin" });
  mocks.history.mockResolvedValue({
    total: 1,
    rows: [
      {
        id: "h1",
        created_at: "2026-10-14T03:00:00Z",
        actor_id: "a1",
        actor_name: "Người sửa mẫu",
        actor_role: "academic_manager",
        entity_type: "tuition_package",
        entity_id: "p1",
        operation: "UPDATE",
        enrollment_id: "50000000-0000-4000-8000-000000000003",
        student_code: "B2C-HV000001",
        student_name: "Học viên mẫu",
        class_code: "L1",
        class_name: "Lớp mẫu",
        before_data: { unit_price: 100000 },
        after_data: { unit_price: 120000 },
      },
    ],
  });
});
describe("B2C history page", () => {
  it("requires super admin and shows the actual actor and before/after details", async () => {
    render(
      await B2CChangeHistoryPage({
        searchParams: Promise.resolve({
          enrollment: "50000000-0000-4000-8000-000000000003",
        }),
      }),
    );
    expect(mocks.role).toHaveBeenCalledWith("super_admin");
    expect(mocks.history).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollment: "50000000-0000-4000-8000-000000000003",
        page: 0,
      }),
    );
    expect(screen.getByText("Người sửa mẫu")).toBeInTheDocument();
    expect(screen.getByText("Học viên mẫu")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Xem 1 trường thay đổi"));
    expect(screen.getByText("Đơn giá / buổi")).toBeInTheDocument();
    expect(screen.getByText(/Trước: 100/)).toBeInTheDocument();
    expect(screen.getByText(/Sau: 120/)).toBeInTheDocument();
  });
  it("does not silently drop invalid date filters", async () => {
    render(
      await B2CChangeHistoryPage({
        searchParams: Promise.resolve({ from: "2026-02-30" }),
      }),
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(mocks.history).not.toHaveBeenCalled();
  });
  it("never loads history if the role guard rejects access", async () => {
    mocks.role.mockRejectedValue(new Error("denied"));
    await expect(
      B2CChangeHistoryPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("denied");
    expect(mocks.history).not.toHaveBeenCalled();
  });
});
