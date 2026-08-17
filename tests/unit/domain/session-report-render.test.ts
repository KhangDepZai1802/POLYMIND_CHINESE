import { describe, expect, it } from "vitest";

import {
  buildReportSections,
  type ReportForRender,
} from "@/features/session-reports/domain/render";

/**
 * 🔴 `TEACHER-REPORT-4` — user báo 2026-08-14 kèm ảnh: dòng *"Thời gian"* của
 * mục 1 in ra `10/08/2026 – 09:30`, tức **ghép NGÀY bắt đầu với GIỜ kết thúc**.
 * Thấy trên cả bản DOCX lẫn bản in vì cả ba bề mặt cùng đọc `buildReportSections`.
 *
 * Gốc lỗi: `ReportForRender.session.startsAt` là chuỗi đã định dạng thành NGÀY
 * (`formatDate`), nhưng dòng "Thời gian" lại dùng chính nó làm mốc bắt đầu. Hai
 * ý nghĩa khác nhau dùng chung một trường thì không có cách nào in đúng cả hai.
 */

function report(overrides: Partial<ReportForRender["session"]> = {}): ReportForRender {
  return {
    session: {
      classCode: "LOP-03",
      className: "VCB — Tiếng Trung ngân hàng (Lớp 03)",
      teacherName: "Phạm Nguyễn Cao Sơn",
      startsAt: "10/08/2026",
      // Cùng một buổi với hai dòng trên: 01:00Z = 08:00 giờ VN ngày 10/08.
      startsAtISO: "2026-08-10T01:00:00Z",
      startTime: "08:00",
      endsAt: "09:30",
      sessionNumber: 3,
      lessonTitle: "Bài 3",
      lessonLog: "Đã dạy xong",
      teacherNote: null,
      ...overrides,
    },
    report: {},
    students: [],
    evidence: [],
    snapshot: null,
  };
}

function line(data: ReportForRender, label: string) {
  return buildReportSections(data)
    .flatMap((section) => section.lines)
    .find((item) => item.label === label)?.value;
}

describe("mục 1 — ngày và giờ là HAI thứ khác nhau", () => {
  it('🔴 "Thời gian" in giờ bắt đầu – giờ kết thúc, KHÔNG phải ngày – giờ', () => {
    const value = line(report(), "Thời gian");

    expect(value).toBe("08:00 – 09:30");
    // Ghim đúng hình dạng lỗi cũ: ngày không được lọt vào dòng giờ.
    expect(value).not.toContain("10/08/2026");
  });

  it('"Ngày học" vẫn là ngày — sửa dòng giờ không được kéo theo dòng ngày', () => {
    expect(line(report(), "Ngày học")).toBe("10/08/2026");
  });

  it("buổi học vắt qua trưa vẫn in đúng hai mốc giờ", () => {
    const value = line(report({ startTime: "11:30", endsAt: "13:00" }), "Thời gian");
    expect(value).toBe("11:30 – 13:00");
  });
});
