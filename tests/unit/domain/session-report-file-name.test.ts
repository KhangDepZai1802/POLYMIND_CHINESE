import { describe, expect, it } from "vitest";

import {
  sessionReportFileBase,
  sessionReportPdfName,
} from "@/features/session-reports/domain/file-name";

/**
 * Tên file PDF báo cáo buổi dạy (`TEACHER-REPORT-5`, user chốt 2026-08-17).
 *
 * Bài kiểm ghim đúng ba thứ user yêu cầu — **lớp_buổi_ngày** — cộng hai cái bẫy
 * đã lường trước: đuôi `.pdf` KHÔNG được nằm trong `document.title`, và mốc
 * ngày phải đọc theo giờ Việt Nam chứ không giờ UTC của máy chủ.
 */
describe("sessionReportFileBase", () => {
  const buoi4 = {
    classCode: "LOP-03",
    sessionNumber: 4,
    startsAt: "2026-08-17T01:00:00Z", // 08:00 giờ VN
  };

  it("ghép đúng thứ tự lớp_buổi_ngày mà user chốt", () => {
    expect(sessionReportFileBase(buoi4)).toBe("LOP-03_Buoi-4_17-08-2026");
  });

  it("KHÔNG có đuôi .pdf — Chrome tự thêm vào tên gợi ý từ document.title", () => {
    expect(sessionReportFileBase(buoi4)).not.toContain(".pdf");
    expect(sessionReportPdfName(buoi4)).toBe("LOP-03_Buoi-4_17-08-2026.pdf");
  });

  /*
   * 🔴 Buổi 17:30 giờ VN được lưu là 10:30Z; buổi 07:00 giờ VN ngày 18 được lưu
   * là 2026-08-17T24:00 → tức 17/08 UTC. Format theo UTC là tên file lệch MỘT
   * NGÀY so với ngày ghi trên báo cáo — thứ giáo vụ sẽ phát hiện bằng cách mở
   * file ra thấy ngày khác tên file.
   */
  it("lấy ngày theo giờ Việt Nam, không theo UTC", () => {
    expect(
      sessionReportFileBase({
        classCode: "LOP-02",
        sessionNumber: 1,
        startsAt: "2026-08-17T18:00:00Z", // 01:00 ngày 18/08 giờ VN
      }),
    ).toBe("LOP-02_Buoi-1_18-08-2026");
  });

  it("bỏ dấu và ký tự không an toàn trong mã lớp", () => {
    expect(
      sessionReportFileBase({
        classCode: "Lớp Sơ cấp 1/2026",
        sessionNumber: 12,
        startsAt: "2026-08-17T01:00:00Z",
      }),
    ).toBe("Lop-So-cap-1-2026_Buoi-12_17-08-2026");
  });

  it("bỏ hẳn đoạn thiếu thay vì để lại dấu _ trống", () => {
    expect(
      sessionReportFileBase({
        classCode: null,
        sessionNumber: 4,
        startsAt: "2026-08-17T01:00:00Z",
      }),
    ).toBe("Buoi-4_17-08-2026");

    expect(
      sessionReportFileBase({
        classCode: "LOP-03",
        sessionNumber: null,
        startsAt: null,
      }),
    ).toBe("LOP-03");
  });

  it("không bao giờ trả tên file rỗng", () => {
    expect(
      sessionReportFileBase({
        classCode: "—",
        sessionNumber: 0,
        startsAt: "khong-phai-ngay",
      }),
    ).toBe("bao-cao-buoi-day");
  });
});
