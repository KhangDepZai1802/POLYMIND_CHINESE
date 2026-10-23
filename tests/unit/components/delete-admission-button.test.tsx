import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ confirm: vi.fn(), archive: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("@/components/shared/confirmation-provider", () => ({ useConfirmation: () => mocks.confirm }));
vi.mock("@/features/b2c/server/actions", () => ({ archiveB2CAdmissionAction: mocks.archive }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
import { DeleteAdmissionButton } from "@/features/b2c/components/delete-admission-button";

describe("delete admission button", () => {
  beforeEach(() => vi.resetAllMocks());
  function click() {
    render(<DeleteAdmissionButton id="lead-id" fullName="Khách thử" />);
    fireEvent.click(screen.getByRole("button", { name: "Xóa khách Khách thử" }));
  }
  it("names the customer in confirmation and does nothing on cancel", async () => {
    mocks.confirm.mockResolvedValue(false);
    click();
    await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith(expect.objectContaining({ description: expect.stringContaining("Khách thử") })));
    expect(mocks.archive).not.toHaveBeenCalled();
  });
  it("archives only after confirmation and shows success", async () => {
    mocks.confirm.mockResolvedValue(true);
    mocks.archive.mockResolvedValue({ success: "Đã xóa" });
    click();
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledWith("lead-id"));
    await waitFor(() => expect(mocks.success).toHaveBeenCalledWith("Đã xóa"));
  });
  it("shows server failure without success", async () => {
    mocks.confirm.mockResolvedValue(true);
    mocks.archive.mockResolvedValue({ error: "Không có quyền" });
    click();
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Không có quyền"));
    expect(mocks.success).not.toHaveBeenCalled();
  });
});
