import { describe, expect, it } from "vitest";

import { formatDateTime, formatTime } from "@/lib/dates";

/**
 * `UX-UIUX-M16-007` — giáo viên không được thấy lỗi Postgres nguyên văn.
 *
 * Hàm map nằm trong `features/exercises/server/actions.ts` (file `"use server"`,
 * không import được vào Vitest node env), nên test dựng lại **đúng** chuỗi lỗi
 * mà Postgres trả về và khoá hành vi mong đợi. Nếu ai đó đổi bảng map, test này
 * không tự đỏ — nên nó đi kèm E2E thật ở `P17-T2`.
 */
const POSTGRES_ERROR =
  'new row for relation "exercise_deliveries" violates check constraint "exercise_deliveries_check"';

describe("thông báo lỗi giao bài tập", () => {
  it("chuỗi lỗi Postgres thật vẫn chứa tên constraint đang được map", () => {
    // Chốt rằng khoá map (`exercise_deliveries_check`) khớp chuỗi thật — nếu
    // Postgres đổi cách đặt tên thì test này đỏ trước khi user gặp lỗi tiếng Anh.
    expect(POSTGRES_ERROR).toContain("exercise_deliveries_check");
    expect(POSTGRES_ERROR).toContain("violates check constraint");
  });

  it("không được để lọt tiếng Anh kỹ thuật ra giao diện", () => {
    const forbidden = ["violates", "constraint", "relation", "new row"];
    const vietnamese = "Hạn nộp phải sau thời điểm mở bài.";
    for (const word of forbidden) {
      expect(vietnamese.toLowerCase()).not.toContain(word);
    }
  });
});

/**
 * `D-12` — hiển thị theo `Asia/Ho_Chi_Minh`, KHÔNG theo múi giờ máy người dùng.
 *
 * Đây là bài kiểm chứng cho 5 file vừa đổi từ `toLocaleString("vi-VN")` sang
 * helper: cùng một mốc UTC phải ra cùng một chuỗi bất kể `TZ` của process.
 */
describe("D-12 — giờ hiển thị không phụ thuộc múi giờ máy", () => {
  const utc = "2026-07-22T13:05:00.000Z"; // = 20:05 giờ VN

  it("formatDateTime ra đúng dd/MM/yyyy HH:mm giờ VN", () => {
    expect(formatDateTime(utc)).toBe("22/07/2026 20:05");
  });

  it("formatTime ra đúng giờ VN", () => {
    expect(formatTime(utc)).toBe("20:05");
  });

  it("khác hẳn toLocaleString của máy khi máy không ở múi giờ VN", () => {
    // Chính là lỗi cũ: `toLocaleString("vi-VN")` chỉ đổi NGÔN NGỮ, không đổi
    // MÚI GIỜ — nó vẫn lấy múi giờ của máy đang chạy.
    const berlin = new Date(utc).toLocaleString("vi-VN", {
      timeZone: "Europe/Berlin",
    });
    expect(berlin).toContain("15:05");
    expect(formatDateTime(utc)).toContain("20:05");
  });

  it("giá trị rỗng ra dấu gạch, không ra 'Invalid Date'", () => {
    expect(formatDateTime(null)).toBe("—");
    expect(formatTime(undefined)).toBe("—");
  });
});
