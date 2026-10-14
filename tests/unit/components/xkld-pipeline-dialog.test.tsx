import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
  PipelineDialog,
  ProgressHistoryDialog,
} from "@/features/xkld/components/pipeline-dialogs";
import type { PipelineCard } from "@/features/xkld/domain/pipeline";
const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  classes: vi.fn(async () => ({
    data: {
      total: 1,
      rows: [
        {
          id: "class1",
          code: "B2C-1",
          name: "Chinese",
          status: "active",
          program_slug: "tieng-trung",
        },
      ],
    },
  })),
  history: vi.fn(async () => ({
    data: {
      total: 1,
      rows: [
        {
          id: "event1",
          created_at: "2026-10-14T00:00:00Z",
          from_stage: "lead",
          to_stage: "consultation",
          actor_name: "Actual Staff",
          note: "Called candidate",
        },
      ],
    },
  })),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("@/features/xkld/server/pipeline-actions", () => ({
  transitionCandidateAction: vi.fn(async () => ({ success: "Saved" })),
  searchPipelineClassesAction: mocks.classes,
  searchPipelineOrdersAction: vi.fn(async () => ({
    data: { total: 0, rows: [] },
  })),
  getProgressHistoryAction: mocks.history,
}));
const candidate: PipelineCard = {
  id: "72000000-0000-4000-8000-000000000030",
  code: "UV-1",
  full_name: "Candidate",
  phone: "0901234567",
  stage: "registration",
  assignee_id: "staff",
  assignee_name: "Staff",
  updated_at: "2026-10-14T00:00:00Z",
  order_id: null,
  order_code: null,
  order_employer: null,
  b2c_class_id: null,
  class_label: null,
};
describe("pipeline dialogs", () => {
  it("disables forward skips, requires rollback reason, and searches real B2C links", async () => {
    render(<PipelineDialog candidate={candidate} />);
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật bước" }));
    expect(
      screen.getByRole("option", { name: "4. Đào tạo ngoại ngữ" }),
    ).not.toBeDisabled();
    expect(
      screen.getByRole("option", { name: "5. Hoàn thiện hồ sơ" }),
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Giai đoạn"), {
      target: { value: "consultation" },
    });
    expect(screen.getByLabelText("Lý do quay lại *")).toBeRequired();
    const picker = screen.getByRole("group", { name: "Lớp B2C liên kết" });
    fireEvent.click(within(picker).getByRole("button", { name: "Tìm" }));
    await waitFor(() =>
      expect(
        within(picker).getByRole("button", { name: "B2C-1 · Chinese" }),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      within(picker).getByRole("button", { name: "B2C-1 · Chinese" }),
    );
    expect(
      document.querySelector<HTMLInputElement>('[name="b2c_class_id"]')?.value,
    ).toBe("class1");
  });
  it("shows actual actor and transition when history is opened", async () => {
    render(<ProgressHistoryDialog candidate={candidate} />);
    fireEvent.click(screen.getByRole("button", { name: "Lịch sử" }));
    await waitFor(() =>
      expect(screen.getByText("Called candidate")).toBeInTheDocument(),
    );
    expect(screen.getByText(/Actual Staff/)).toBeInTheDocument();
    expect(screen.getByText("Lead → Tư vấn")).toBeInTheDocument();
  });
});
