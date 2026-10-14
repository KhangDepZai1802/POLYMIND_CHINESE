import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CandidateDialog } from "@/features/xkld/components/candidate-dialog";
const refresh = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/xkld/server/candidate-actions", () => ({ saveCandidateAction: vi.fn(async () => ({ success: "Saved" })) }));
const owner = { id: "60000000-0000-4000-8000-000000000001", full_name: "Người phụ trách", is_active: true };
describe("candidate dialog", () => {
  it("opens all requested fields with server generated code and a stable retry token", () => {
    const { container } = render(<CandidateDialog assignees={[owner]} actorId={owner.id} />);
    fireEvent.click(screen.getByRole("button", { name: "Thêm ứng viên" }));
    for (const label of ["Họ tên *", "Ngày sinh *", "Số điện thoại *", "Zalo", "Quê quán *", "Trình độ *", "Nghề *", "Sức khỏe *", "Nguồn *", "Người phụ trách *"]) expect(screen.getByLabelText(label)).toBeInTheDocument();
    expect(screen.getByLabelText("Người phụ trách *")).toHaveValue(owner.id);
    expect(document.querySelector<HTMLInputElement>('[name="create_request_id"]')?.value).toMatch(/^[0-9a-f-]{36}$/);
    expect(container.querySelector('[name="code"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
