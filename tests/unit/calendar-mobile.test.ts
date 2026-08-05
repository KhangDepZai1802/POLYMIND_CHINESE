import { describe, expect, it } from "vitest";

import {
  getWeekDaySlots,
  pickMonthFocusDateKey,
} from "@/features/schedules/calendar";

/**
 * Phần tính toán của bố cục lịch trên điện thoại (`UX-MOBILE-1`).
 *
 * Dùng dữ liệu đúng hình dạng production: LOP-03 học **Thứ Hai + Thứ Tư**,
 * khai giảng 03/08/2026 (xem `DATA-SCHED-1` trong WORKLOG).
 */

const MON_03 = "2026-08-03";
const WED_05 = "2026-08-05";
const MON_10 = "2026-08-10";
const WED_12 = "2026-08-12";

function sessionsByDate(...dateKeys: string[]) {
  const map = new Map<string, string[]>();
  for (const dateKey of dateKeys) {
    map.set(dateKey, [`buổi ${dateKey}`]);
  }
  return map;
}

describe("getWeekDaySlots", () => {
  it("luôn trả đủ 7 ngày, tuần bắt đầu từ Thứ Hai", () => {
    const slots = getWeekDaySlots(WED_05, sessionsByDate(MON_03), WED_05);

    expect(slots).toHaveLength(7);
    expect(slots[0]?.dateKey).toBe(MON_03);
    expect(slots[6]?.dateKey).toBe("2026-08-09");
    expect(slots.map((slot) => slot.weekdayIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
  });

  it("GIỮ ngày không có buổi thay vì lọc bỏ — user chốt ngày trống vẫn hiện", () => {
    const slots = getWeekDaySlots(WED_05, sessionsByDate(MON_03, WED_05), WED_05);

    // 2 ngày có buổi, 5 ngày trống — nhưng vẫn đủ 7 phần tử.
    expect(slots.filter((slot) => slot.items.length > 0)).toHaveLength(2);
    expect(slots.filter((slot) => slot.items.length === 0)).toHaveLength(5);
  });

  it("đánh dấu đúng một ngày là hôm nay", () => {
    const slots = getWeekDaySlots(WED_05, sessionsByDate(MON_03), WED_05);
    const today = slots.filter((slot) => slot.isToday);

    expect(today).toHaveLength(1);
    expect(today[0]?.dateKey).toBe(WED_05);
  });

  it("không đánh dấu hôm nay khi đang xem tuần khác", () => {
    const slots = getWeekDaySlots(MON_10, sessionsByDate(MON_10), WED_05);
    expect(slots.some((slot) => slot.isToday)).toBe(false);
  });

  it("gắn buổi đúng vào ngày của nó", () => {
    const slots = getWeekDaySlots(WED_05, sessionsByDate(MON_03, WED_05), WED_05);

    expect(slots[0]?.items).toEqual([`buổi ${MON_03}`]);
    expect(slots[1]?.items).toEqual([]);
    expect(slots[2]?.items).toEqual([`buổi ${WED_05}`]);
  });
});

describe("pickMonthFocusDateKey", () => {
  it("chọn hôm nay khi hôm nay có buổi", () => {
    expect(
      pickMonthFocusDateKey(WED_05, [MON_03, WED_05, MON_10], WED_05),
    ).toBe(WED_05);
  });

  it("hôm nay trống thì nhảy tới buổi gần nhất SẮP tới, không phải buổi đã qua", () => {
    // 04/08 là hôm nay và không có buổi; buổi gần nhất phía trước là 05/08.
    expect(
      pickMonthFocusDateKey("2026-08-04", [MON_03, WED_05, MON_10], "2026-08-04"),
    ).toBe(WED_05);
  });

  it("mọi buổi đã qua thì rơi về buổi cuối cùng", () => {
    expect(
      pickMonthFocusDateKey("2026-08-20", [MON_03, WED_05], "2026-08-20"),
    ).toBe(WED_05);
  });

  it("xem tháng khác thì chỉ xét buổi TRONG tháng đó", () => {
    // Đang xem tháng 9 nhưng dữ liệu buổi nằm ở tháng 8 ⇒ không được lôi
    // buổi tháng 8 sang làm ngày chọn của tháng 9.
    expect(
      pickMonthFocusDateKey("2026-09-15", [MON_03, WED_05], WED_05),
    ).toBe("2026-09-01");
  });

  it("tháng đang xem không có buổi nhưng chứa hôm nay thì chọn hôm nay", () => {
    expect(pickMonthFocusDateKey(WED_05, [], WED_05)).toBe(WED_05);
  });

  it("tháng đang xem không có buổi và cũng không chứa hôm nay thì chọn ngày 1", () => {
    expect(pickMonthFocusDateKey("2026-12-20", [], WED_05)).toBe("2026-12-01");
  });

  it("bỏ qua ngày trùng lặp trong danh sách buổi", () => {
    expect(
      pickMonthFocusDateKey("2026-08-06", [WED_12, WED_12, MON_10], "2026-08-06"),
    ).toBe(MON_10);
  });
});
