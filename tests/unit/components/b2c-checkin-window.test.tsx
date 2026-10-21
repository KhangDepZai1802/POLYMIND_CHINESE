import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckinWindow } from "@/features/b2c/components/checkin-window";

afterEach(() => vi.useRealTimers());
const start = "2026-10-21T18:00:00+07:00";
const end = "2026-10-21T19:30:00+07:00";
function show(time: string, checkedIn = false) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(time));
  return render(<CheckinWindow startsAt={start} endsAt={end} checkedIn={checkedIn}><button>Chấm công</button></CheckinWindow>);
}
describe("khung giờ chấm công", () => {
  it("hiện thẻ nhưng khóa nút trước 15 phút và tự mở đúng giờ", () => {
    show("2026-10-21T17:44:59+07:00");
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("17:45");
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByRole("button")).toBeEnabled();
  });
  it("khóa check-in đúng giờ kết thúc", () => {
    show(end);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Đã hết giờ");
  });
  it("cho check-out từ giờ kết thúc", () => {
    show(end, true);
    expect(screen.getByRole("button")).toBeEnabled();
  });
  it("khóa check-out trước giờ kết thúc", () => {
    show(start, true);
    expect(screen.getByRole("button")).toBeDisabled();
  });
  it("không cho check-out sang ngày hôm sau", () => {
    show("2026-10-22T00:00:00+07:00", true);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
