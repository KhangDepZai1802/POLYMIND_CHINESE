import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StudentTuitionPage from "@/app/(dashboard)/student/tuition/page";
import { getMyB2CTuition } from "@/features/b2c/server/student-tuition";
import { getTuitionInvoices } from "@/features/tuition/server/queries";
import { requireRole } from "@/lib/auth/session";

vi.mock("@/lib/auth/session", () => ({ requireRole: vi.fn() }));
vi.mock("@/features/b2c/server/student-tuition", () => ({
  getMyB2CTuition: vi.fn(),
}));
vi.mock("@/features/tuition/server/queries", () => ({
  getTuitionInvoices: vi.fn(),
}));
vi.mock("@/features/b2c/components/student-tuition-overview", () => ({
  B2CStudentTuitionOverview: () => <div>Học phí B2C của tôi</div>,
}));
vi.mock("@/features/tuition/components/student-tuition-overview", () => ({
  StudentTuitionOverview: () => <div>Hóa đơn hệ cũ</div>,
}));

describe("StudentTuitionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({ role: "student" } as never);
    vi.mocked(getTuitionInvoices).mockResolvedValue([]);
    vi.mocked(getMyB2CTuition).mockResolvedValue({
      linked_student: null,
      periods: [],
    });
  });

  it("ưu tiên học phí B2C khi tài khoản đã liên kết", async () => {
    vi.mocked(getMyB2CTuition).mockResolvedValue({
      linked_student: {
        id: "11111111-1111-4111-8111-111111111111",
        code: "B2C-HV000002",
        full_name: "Lê Huỳnh Gia Hân",
      },
      periods: [],
    });

    render(await StudentTuitionPage());

    expect(screen.getByText("Học phí B2C của tôi")).toBeInTheDocument();
    expect(screen.queryByText("Hóa đơn hệ cũ")).not.toBeInTheDocument();
  });

  it("giữ màn hóa đơn cũ cho tài khoản không liên kết B2C", async () => {
    render(await StudentTuitionPage());

    expect(screen.getByText("Hóa đơn hệ cũ")).toBeInTheDocument();
    expect(screen.queryByText("Học phí B2C của tôi")).not.toBeInTheDocument();
  });
});
