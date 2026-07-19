import { describe, expect, it } from "vitest";

import {
  calculateAttendanceScore,
  formatAttendanceScore,
} from "@/lib/domain/attendance";

describe("điểm chuyên cần", () => {
  it("mặc định 10 điểm và mỗi buổi vắng trừ 0,5", () => {
    expect(calculateAttendanceScore(undefined)).toBe(10);
    expect(calculateAttendanceScore(1)).toBe(9.5);
    expect(calculateAttendanceScore(4)).toBe(8);
    expect(formatAttendanceScore(1)).toBe("9.5");
    expect(formatAttendanceScore(4)).toBe("8");
  });

  it("không cho điểm âm hoặc số buổi vắng âm", () => {
    expect(calculateAttendanceScore(-2)).toBe(10);
    expect(calculateAttendanceScore(99)).toBe(0);
  });
});
