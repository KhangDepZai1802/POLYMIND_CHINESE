import { describe, expect, it } from "vitest";

import {
  attendanceChangeListSchema,
  describeOverrideResult,
  groupChangesBySession,
  parseOverrideResult,
  type AttendanceChange,
} from "@/features/attendance/admin-edit";

const S1 = "11111111-1111-4111-8111-111111111111";
const S2 = "22222222-2222-4222-8222-222222222222";
const E1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const E2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const change = (
  session_id: string,
  enrollment_id: string,
  status: AttendanceChange["status"],
  note?: string,
): AttendanceChange => ({ session_id, enrollment_id, status, ...(note ? { note } : {}) });

describe("groupChangesBySession", () => {
  it("gom các ô của cùng một buổi vào một nhóm", () => {
    const groups = groupChangesBySession([
      change(S1, E1, "present"),
      change(S1, E2, "absent"),
      change(S2, E1, "late"),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.session_id === S1)?.records).toHaveLength(2);
    expect(groups.find((g) => g.session_id === S2)?.records).toHaveLength(1);
  });

  /*
   * 🔴 Bài này ghim đúng hành vi người dùng thật: bấm một ô mấy lần trước khi
   * bấm Lưu. Không khử trùng thì payload mang cả ba trạng thái cho MỘT hàng,
   * con số "đã sửa N ô" báo lên màn hình sai gấp ba.
   */
  it("bấm một ô nhiều lần chỉ gửi đi trạng thái CUỐI CÙNG", () => {
    const groups = groupChangesBySession([
      change(S1, E1, "absent"),
      change(S1, E1, "excused"),
      change(S1, E1, "present"),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.records).toHaveLength(1);
    expect(groups[0]?.records[0]?.status).toBe("present");
  });

  it("khử trùng theo CẶP (buổi, ghi danh) — cùng học viên ở hai buổi vẫn là hai ô", () => {
    const groups = groupChangesBySession([
      change(S1, E1, "absent"),
      change(S2, E1, "present"),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups.flatMap((g) => g.records)).toHaveLength(2);
  });

  it("ghi chú rỗng không được gửi xuống DB", () => {
    const groups = groupChangesBySession([change(S1, E1, "present", "   ")]);
    expect(groups[0]?.records[0]).not.toHaveProperty("note");
  });

  it("ghi chú có nội dung thì đi kèm", () => {
    const groups = groupChangesBySession([
      change(S1, E1, "excused", "Phụ huynh báo ốm"),
    ]);
    expect(groups[0]?.records[0]?.note).toBe("Phụ huynh báo ốm");
  });

  it("danh sách rỗng ra mảng rỗng, không nổ", () => {
    expect(groupChangesBySession([])).toEqual([]);
  });
});

describe("attendanceChangeListSchema", () => {
  it("nhận payload đúng hình dạng", () => {
    const parsed = attendanceChangeListSchema.safeParse([
      { session_id: S1, enrollment_id: E1, status: "present" },
    ]);
    expect(parsed.success).toBe(true);
  });

  it("từ chối trạng thái ngoài bốn giá trị hợp lệ", () => {
    const parsed = attendanceChangeListSchema.safeParse([
      { session_id: S1, enrollment_id: E1, status: "chua_diem_danh" },
    ]);
    expect(parsed.success).toBe(false);
  });

  it("từ chối id không phải uuid", () => {
    const parsed = attendanceChangeListSchema.safeParse([
      { session_id: "buoi-1", enrollment_id: E1, status: "present" },
    ]);
    expect(parsed.success).toBe(false);
  });

  it("cắt trắng hai đầu ghi chú và chặn ghi chú quá 300 ký tự", () => {
    expect(
      attendanceChangeListSchema.safeParse([
        { session_id: S1, enrollment_id: E1, status: "late", note: "  ốm  " },
      ]).data?.[0]?.note,
    ).toBe("ốm");

    expect(
      attendanceChangeListSchema.safeParse([
        { session_id: S1, enrollment_id: E1, status: "late", note: "x".repeat(301) },
      ]).success,
    ).toBe(false);
  });
});

describe("describeOverrideResult", () => {
  /*
   * `sessions = 0` là ca RPC bỏ qua vì không có gì đổi. Câu chữ phải nói đúng
   * chuyện đó — "Đã lưu 0 ô" đọc như hệ thống nuốt mất thao tác.
   */
  it("không có gì đổi thì nói rõ là không có gì đổi", () => {
    const message = describeOverrideResult({
      sessions: 0,
      records: 0,
      reports_resynced: 0,
    });
    expect(message).toContain("Không có gì thay đổi");
    expect(message).not.toContain("Đã lưu");
  });

  it("có thay đổi thì nói đủ số ô và số buổi", () => {
    expect(
      describeOverrideResult({ sessions: 2, records: 5, reports_resynced: 0 }),
    ).toBe("Đã lưu 5 ô điểm danh ở 2 buổi.");
  });

  /*
   * 🔴 Vế quan trọng nhất của `D-45`: báo cáo giáo viên ĐÃ KÝ vừa bị đổi số.
   * Im lặng về chuyện đó là đúng thứ mà quyết định này dễ gây ra nhất.
   */
  it("báo cáo đã gửi bị cập nhật lại thì PHẢI nói ra", () => {
    const message = describeOverrideResult({
      sessions: 1,
      records: 3,
      reports_resynced: 1,
    });
    expect(message).toContain("1 báo cáo đã gửi");
    expect(message).toContain("chuyên cần");
  });
});

describe("parseOverrideResult", () => {
  it("đọc đúng ba con số từ kết quả RPC", () => {
    expect(
      parseOverrideResult({ sessions: 2, records: 7, reports_resynced: 1 }),
    ).toEqual({ sessions: 2, records: 7, reports_resynced: 1 });
  });

  it("kết quả null/thiếu trường thì về 0 chứ không NaN", () => {
    expect(parseOverrideResult(null)).toEqual({
      sessions: 0,
      records: 0,
      reports_resynced: 0,
    });
    expect(parseOverrideResult({ sessions: "hai" })).toEqual({
      sessions: 0,
      records: 0,
      reports_resynced: 0,
    });
  });
});
