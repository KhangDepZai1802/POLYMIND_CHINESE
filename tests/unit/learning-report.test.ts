import { describe, expect, it } from "vitest";

import {
  attendanceRate,
  averageScore,
  buildWeeklyTrend,
  exerciseScoreOn100,
  isoWeekOf,
  mondayOf,
  monthRangeOf,
  periodToUtcRange,
  resolveLearningPeriod,
  summarizeAttendance,
  weekRangeOf,
} from "@/features/reports/learning";
import {
  learningFilterSearchParams,
  parseLearningReportFilters,
} from "@/features/reports/schema";

// 2026-08-04 là Thứ Ba → tuần ISO của nó bắt đầu Thứ Hai 2026-08-03.
const TODAY = "2026-08-04";

describe("learning report filters (schema)", () => {
  it("round-trip filter hợp lệ qua parse → searchParams", () => {
    const parsed = parseLearningReportFilters({
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(learningFilterSearchParams(parsed.data).toString()).toBe(
      "from=2026-08-01&to=2026-08-31",
    );
  });

  it("từ chối khoảng ngày đảo ngược và range lạ", () => {
    expect(
      parseLearningReportFilters({ from: "2026-08-31", to: "2026-08-01" })
        .success,
    ).toBe(false);
    expect(parseLearningReportFilters({ range: "everything" }).success).toBe(
      false,
    );
  });

  it("range=all đi qua nguyên vẹn", () => {
    const parsed = parseLearningReportFilters({ range: "all" });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.range).toBe("all");
    expect(learningFilterSearchParams(parsed.data).toString()).toBe(
      "range=all",
    );
  });
});

describe("resolveLearningPeriod", () => {
  it("mặc định admin = Tháng này (AC1.1), giáo viên = Toàn khóa", () => {
    const admin = resolveLearningPeriod({}, TODAY, "month");
    expect(admin).toMatchObject({
      from: "2026-08-01",
      to: "2026-08-31",
      preset: "month",
      label: "Tháng 8/2026",
    });

    const teacher = resolveLearningPeriod({}, TODAY, "all");
    expect(teacher).toMatchObject({ from: null, to: null, preset: "all" });
  });

  it("nhận diện đúng preset Tuần này từ from/to trên URL", () => {
    const week = weekRangeOf(TODAY);
    expect(week).toEqual({ from: "2026-08-03", to: "2026-08-09" });
    const period = resolveLearningPeriod(
      { from: week.from, to: week.to },
      TODAY,
      "month",
    );
    expect(period.preset).toBe("week");
  });

  it("khoảng tự chọn → preset custom, giữ nguyên from/to", () => {
    const period = resolveLearningPeriod(
      { from: "2026-07-01", to: "2026-07-15" },
      TODAY,
      "month",
    );
    expect(period).toMatchObject({
      from: "2026-07-01",
      to: "2026-07-15",
      preset: "custom",
      label: "Từ 01/07/2026 đến 15/07/2026",
    });
  });

  it("range=all thắng mọi from/to", () => {
    const period = resolveLearningPeriod(
      { range: "all", from: "2026-07-01" },
      TODAY,
      "month",
    );
    expect(period.preset).toBe("all");
    expect(period.from).toBeNull();
  });
});

describe("mốc thời gian VN → UTC", () => {
  it("periodToUtcRange trừ đúng 7 giờ và mốc cuối là exclusive", () => {
    const { fromUtc, toUtcExclusive } = periodToUtcRange({
      from: "2026-08-01",
      to: "2026-08-31",
      preset: "month",
      label: "",
    });
    // 00:00 ngày 01/08 giờ VN = 17:00 ngày 31/07 UTC.
    expect(fromUtc).toBe("2026-07-31T17:00:00.000Z");
    // Exclusive: 00:00 ngày 01/09 giờ VN.
    expect(toUtcExclusive).toBe("2026-08-31T17:00:00.000Z");
  });

  it("Toàn khóa → không chặn hai đầu", () => {
    const range = periodToUtcRange({
      from: null,
      to: null,
      preset: "all",
      label: "",
    });
    expect(range).toEqual({ fromUtc: null, toUtcExclusive: null });
  });

  it("monthRangeOf xử lý đúng tháng thiếu/đủ ngày", () => {
    expect(monthRangeOf("2026-02-10")).toEqual({
      from: "2026-02-01",
      to: "2026-02-28",
    });
    expect(monthRangeOf("2026-12-31")).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
  });
});

describe("tuần ISO", () => {
  it("mondayOf neo về Thứ Hai kể cả khi hôm nay là Chủ Nhật", () => {
    // 2026-08-09 là Chủ Nhật — vẫn thuộc tuần bắt đầu 03/08.
    expect(mondayOf("2026-08-09")).toBe("2026-08-03");
    expect(mondayOf("2026-08-03")).toBe("2026-08-03");
  });

  it("tuần giáp ranh năm thuộc về năm chứa Thứ Năm (ISO-8601)", () => {
    // 01/01/2027 là Thứ Sáu → thuộc tuần 53 của 2026.
    expect(isoWeekOf("2027-01-01")).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf("2026-08-04")).toEqual({ year: 2026, week: 32 });
  });
});

describe("tổng hợp điểm danh", () => {
  it("chuyên cần = (có mặt + muộn) / tổng buổi — buổi chưa điểm danh vẫn trong mẫu số", () => {
    // 4 buổi, chỉ 3 buổi được điểm danh: 2 có mặt + 1 muộn → 75%, không phải 100%.
    const summary = summarizeAttendance(["present", "present", "late"], 4);
    expect(summary).toMatchObject({
      present: 2,
      late: 1,
      absent: 0,
      unmarked: 1,
      rate: 75,
    });
  });

  it("không có buổi nào → rate null (chưa biết ≠ 0%)", () => {
    expect(summarizeAttendance([], 0).rate).toBeNull();
    expect(attendanceRate(0, 0, 0)).toBeNull();
  });

  it("điểm trung bình: mảng rỗng → null, có điểm → làm tròn 1 chữ số", () => {
    expect(averageScore([])).toBeNull();
    expect(averageScore([80, 85])).toBe(82.5);
    expect(averageScore([1, 2, 2])).toBe(1.7);
  });

  it("điểm bài tập quy thang 100 như view DB; max_score 0 → null", () => {
    expect(exerciseScoreOn100(8, 10)).toBe(80);
    expect(exerciseScoreOn100(5, 0)).toBeNull();
  });
});

describe("buildWeeklyTrend", () => {
  it("gom buổi theo tuần ISO và tính tỉ lệ trên sĩ số lớp", () => {
    const sessions = [
      { id: "s1", classId: "c1", dateKey: "2026-08-03" }, // T32
      { id: "s2", classId: "c1", dateKey: "2026-08-05" }, // T32
      { id: "s3", classId: "c1", dateKey: "2026-08-10" }, // T33
    ];
    const records = [
      { sessionId: "s1", status: "present" as const },
      { sessionId: "s1", status: "late" as const },
      { sessionId: "s2", status: "present" as const },
      { sessionId: "s2", status: "absent" as const },
      { sessionId: "s3", status: "present" as const },
    ];
    const trend = buildWeeklyTrend(sessions, records, new Map([["c1", 2]]));

    expect(trend).toHaveLength(2);
    // Tuần 32: (2 + 1) lượt có mặt / (2 buổi × 2 học viên) = 75%.
    expect(trend[0]).toMatchObject({
      key: "2026-W32",
      label: "T32",
      weekStart: "2026-08-03",
      rate: 75,
      sessionCount: 2,
    });
    // Tuần 33: 1 / 2 = 50%.
    expect(trend[1]).toMatchObject({ key: "2026-W33", rate: 50 });
  });

  it("lớp không rõ sĩ số → rate null, không chia cho 0", () => {
    const trend = buildWeeklyTrend(
      [{ id: "s1", classId: "c9", dateKey: "2026-08-03" }],
      [{ sessionId: "s1", status: "present" }],
      new Map(),
    );
    expect(trend[0]?.rate).toBeNull();
  });
});
