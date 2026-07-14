import { describe, expect, it } from "vitest";

import {
  OPEN_ENROLLMENT_STATUSES,
  TERMINAL_ENROLLMENT_STATUSES,
  allowedEnrollmentTransitions,
  canTransferEnrollment,
  isOpenEnrollment,
  type EnrollmentStatus,
} from "@/lib/domain/enrollment";

const ALL_STATUSES: EnrollmentStatus[] = [
  "pending",
  "active",
  "paused",
  "completed",
  "withdrawn",
  "transferred",
];

describe("phân loại trạng thái ghi danh", () => {
  it("mở và đóng phủ kín mọi trạng thái, không chồng nhau", () => {
    // Thêm giá trị enum mới vào DB mà quên phân loại → test này đỏ ngay.
    const open = new Set<string>(OPEN_ENROLLMENT_STATUSES);
    const terminal = new Set<string>(TERMINAL_ENROLLMENT_STATUSES);

    for (const s of ALL_STATUSES) {
      expect(open.has(s) !== terminal.has(s), `${s} phải thuộc đúng 1 nhóm`).toBe(
        true,
      );
    }
    expect(open.size + terminal.size).toBe(ALL_STATUSES.length);
  });

  it("chỉ pending/active/paused là đang mở (chiếm chỗ + tính vào D-18)", () => {
    expect(isOpenEnrollment("pending")).toBe(true);
    expect(isOpenEnrollment("active")).toBe(true);
    expect(isOpenEnrollment("paused")).toBe(true);

    // D-18: học xong HSK1 vẫn đăng ký được HSK2 → completed KHÔNG được tính là mở.
    expect(isOpenEnrollment("completed")).toBe(false);
    expect(isOpenEnrollment("withdrawn")).toBe(false);
    // Chuyển lớp vẫn chạy được cũng nhờ điều này.
    expect(isOpenEnrollment("transferred")).toBe(false);
  });
});

describe("allowedEnrollmentTransitions", () => {
  it("trạng thái CUỐI không đi đâu được nữa", () => {
    for (const s of TERMINAL_ENROLLMENT_STATUSES) {
      expect(allowedEnrollmentTransitions(s), s).toEqual([]);
    }
  });

  it("đường đi hợp lệ từ mỗi trạng thái đang mở", () => {
    expect(allowedEnrollmentTransitions("pending")).toEqual([
      "active",
      "withdrawn",
    ]);
    expect(allowedEnrollmentTransitions("active")).toEqual([
      "paused",
      "completed",
      "withdrawn",
    ]);
    expect(allowedEnrollmentTransitions("paused")).toEqual([
      "active",
      "completed",
      "withdrawn",
    ]);
  });

  it("không trạng thái nào tự đi về chính nó", () => {
    for (const s of ALL_STATUSES) {
      expect(allowedEnrollmentTransitions(s), s).not.toContain(s);
    }
  });

  it("không ai đi thẳng sang 'transferred' — đó là việc của RPC chuyển lớp", () => {
    // `transferred` chỉ được RPC `transfer_enrollment` đặt, trong cùng transaction
    // với việc mở ghi danh mới. Cho phép đặt tay là tạo ra học viên "đã chuyển"
    // mà không có lớp nào để chuyển đến.
    for (const s of ALL_STATUSES) {
      expect(allowedEnrollmentTransitions(s), s).not.toContain("transferred");
    }
  });

  it("FAIL-CLOSED: trạng thái lạ → không cho làm gì, không phải cho làm tất", () => {
    // Hệ cũ dính đúng bug ngược lại: fallback `return true` trong hàm phân quyền.
    const unknown = "khong_ton_tai" as EnrollmentStatus;
    expect(allowedEnrollmentTransitions(unknown)).toEqual([]);
    expect(isOpenEnrollment(unknown)).toBe(false);
    expect(canTransferEnrollment(unknown)).toBe(false);
  });
});

describe("canTransferEnrollment", () => {
  it("chỉ chuyển lớp được khi ghi danh còn mở", () => {
    expect(canTransferEnrollment("active")).toBe(true);
    expect(canTransferEnrollment("paused")).toBe(true);
    expect(canTransferEnrollment("pending")).toBe(true);

    expect(canTransferEnrollment("completed")).toBe(false);
    expect(canTransferEnrollment("withdrawn")).toBe(false);
    expect(canTransferEnrollment("transferred")).toBe(false);
  });
});
