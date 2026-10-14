import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({ requireRole: vi.fn(), getCandidates: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/features/xkld/server/candidates", () => ({ getCandidates: mocks.getCandidates }));
vi.mock("@/features/xkld/components/candidate-dialog", () => ({ CandidateDialog: () => <button>Thêm hoặc sửa ứng viên</button> }));
import CandidatesPage from "@/app/(dashboard)/workspace/xkld/candidates/page";
describe("candidate page server access", () => {
  beforeEach(() => { mocks.requireRole.mockReset(); mocks.getCandidates.mockReset(); });
  it("renders executive read-only without mutation controls", async () => {
    mocks.getCandidates.mockResolvedValue({ actor: { id: "exec", role: "executive" }, rows: [], total: 0, assignees: [] });
    render(await CandidatesPage({ searchParams: Promise.resolve({}) }));
    expect(mocks.requireRole).toHaveBeenCalledWith("super_admin", "executive", "xkld_staff");
    expect(screen.getByText(/Chế độ chỉ xem/)).toBeInTheDocument();
    expect(screen.queryByText("Thêm hoặc sửa ứng viên")).not.toBeInTheDocument();
  });
  it("rejects invalid query values before touching the database", async () => {
    render(await CandidatesPage({ searchParams: Promise.resolve({ page: "-1" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Bộ lọc không hợp lệ");
    expect(mocks.getCandidates).not.toHaveBeenCalled();
  });
  it("checks permissions before loading private candidates", async () => {
    mocks.requireRole.mockRejectedValue(new Error("denied"));
    await expect(CandidatesPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("denied");
    expect(mocks.getCandidates).not.toHaveBeenCalled();
  });
});
