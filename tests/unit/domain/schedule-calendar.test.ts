import { describe, expect, it } from "vitest";

import {
  formatCalendarPeriod,
  getMonthGridDateKeys,
  getWeekDateKeys,
  pickInitialDateKey,
  shiftCalendarAnchor,
} from "@/features/schedules/calendar";

describe("schedule calendar", () => {
  it("tạo tuần từ thứ Hai đến Chủ Nhật", () => {
    expect(getWeekDateKeys("2026-07-22")).toEqual([
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
      "2026-07-26",
    ]);
  });

  it("lưới tháng luôn phủ trọn các tuần giao tháng", () => {
    const days = getMonthGridDateKeys("2026-07-16");

    expect(days[0]).toBe("2026-06-29");
    expect(days.at(-1)).toBe("2026-08-02");
    expect(days.length % 7).toBe(0);
  });

  it("mở ở buổi sắp tới gần nhất, hoặc buổi cuối nếu lớp đã kết thúc", () => {
    const sessions = ["2026-07-20", "2026-07-27", "2026-08-03"];

    expect(pickInitialDateKey(sessions, "2026-07-22")).toBe("2026-07-27");
    expect(pickInitialDateKey(sessions, "2026-08-10")).toBe("2026-08-03");
    expect(pickInitialDateKey([], "2026-07-22")).toBe("2026-07-22");
  });

  it("điều hướng đúng một tuần hoặc một tháng", () => {
    expect(shiftCalendarAnchor("2026-07-22", "week", 1)).toBe("2026-07-29");
    expect(shiftCalendarAnchor("2026-07-22", "month", -1)).toBe("2026-06-22");
    expect(formatCalendarPeriod("2026-07-22", "week")).toBe(
      "20/07 – 26/07/2026",
    );
    expect(formatCalendarPeriod("2026-07-22", "month")).toBe(
      "Tháng 7 năm 2026",
    );
  });
});
