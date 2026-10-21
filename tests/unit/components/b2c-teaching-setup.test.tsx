import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TeachingSetup } from "@/features/b2c/components/teaching-setup";
const mocks = vi.hoisted(() => ({ prepare: vi.fn(), weekly: vi.fn(), price: vi.fn(), refresh: vi.fn(), success: vi.fn(), error: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("sonner", () => ({ toast: { success: mocks.success, error: mocks.error } }));
vi.mock("@/features/b2c/server/teaching-actions", () => ({ prepareMeetingCheckin: mocks.prepare, prepareWeeklyCheckin: mocks.weekly, priceTeachingSession: mocks.price }));
beforeEach(() => vi.clearAllMocks());
describe("mở chấm công và bổ sung giá", () => {
  it("mở buổi từ lịch tuần bằng mã lớp, không gửi giờ từ máy người dùng", async () => {
    mocks.weekly.mockResolvedValue({ success: "OK" });
    render(<TeachingSetup classId="weekly-class" />);
    fireEvent.click(screen.getByRole("button", { name: "Mở check-in" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.weekly).toHaveBeenCalledWith("weekly-class");
    expect(mocks.prepare).not.toHaveBeenCalled();
  });
  it("mở buổi thực tế không yêu cầu nhập đơn giá", async () => {
    mocks.prepare.mockResolvedValue({ success: "OK" });
    render(<TeachingSetup meetingId="meeting" />);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mở check-in" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(mocks.prepare).toHaveBeenCalledWith("meeting");
    expect(mocks.price).not.toHaveBeenCalled();
  });
  it("lỗi mở buổi hiện thông báo và không báo thành công", async () => {
    mocks.prepare.mockResolvedValue({ error: "Forbidden" });
    render(<TeachingSetup meetingId="meeting" />);
    fireEvent.click(screen.getByRole("button", { name: "Mở check-in" }));
    await waitFor(() => expect(mocks.error).toHaveBeenCalledWith("Forbidden"));
    expect(mocks.success).not.toHaveBeenCalled();
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("nhập giá áp dụng đúng buổi được chọn", async () => {
    mocks.price.mockResolvedValue({ success: "OK" });
    const { container } = render(<TeachingSetup sessionId="session" />);
    fireEvent.change(screen.getByRole("spinbutton"), { target: { value: "120000" } });
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    const data = mocks.price.mock.calls[0]![0] as FormData;
    expect(data.get("id")).toBe("session");
    expect(data.get("rate")).toBe("120000");
  });
});
