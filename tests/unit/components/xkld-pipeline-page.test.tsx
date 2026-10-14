import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  getPipeline: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/features/xkld/server/pipeline", () => ({
  getPipeline: mocks.getPipeline,
}));
vi.mock("@/features/xkld/components/pipeline-dialogs", () => ({
  PipelineDialog: () => <button>Mutation</button>,
  ProgressHistoryDialog: () => <button>Lịch sử</button>,
}));
import PipelinePage from "@/app/(dashboard)/workspace/xkld/pipeline/page";
import { STAGE_CODES } from "@/features/xkld/domain/pipeline";
describe("pipeline page", () => {
  beforeEach(() => {
    mocks.requireRole.mockReset();
    mocks.getPipeline.mockReset();
  });
  it("renders ten ordered columns and read-only history for executive", async () => {
    mocks.getPipeline.mockResolvedValue({
      actor: { role: "executive" },
      groups: STAGE_CODES.map((stage) => ({
        stage,
        total: stage === "lead" ? 1 : 0,
        candidates:
          stage === "lead"
            ? [
                {
                  id: "1",
                  code: "UV-1",
                  stage,
                  full_name: "Test Candidate",
                  phone: "0901234567",
                  assignee_name: "Staff",
                },
              ]
            : [],
      })),
      assignees: [],
    });
    render(await PipelinePage({ searchParams: Promise.resolve({}) }));
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(10);
    expect(screen.getByText("Test Candidate")).toBeInTheDocument();
    expect(screen.getByText("Lịch sử")).toBeInTheDocument();
    expect(screen.queryByText("Mutation")).not.toBeInTheDocument();
    expect(mocks.requireRole).toHaveBeenCalledWith(
      "super_admin",
      "executive",
      "xkld_staff",
    );
  });
  it("rejects invalid stage filters before querying", async () => {
    render(
      await PipelinePage({ searchParams: Promise.resolve({ stage: "wrong" }) }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Bộ lọc không hợp lệ");
    expect(mocks.getPipeline).not.toHaveBeenCalled();
  });
  it("checks access before reading private candidates", async () => {
    mocks.requireRole.mockRejectedValue(new Error("denied"));
    await expect(
      PipelinePage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("denied");
    expect(mocks.getPipeline).not.toHaveBeenCalled();
  });
});
