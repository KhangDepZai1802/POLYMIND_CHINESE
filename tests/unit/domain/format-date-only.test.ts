import { describe, expect, it } from "vitest";

import { formatDate, formatDateOnly } from "@/lib/dates";

/**
 * `formatDateOnly` sinh ra từ một lỗi thật ở `/admin/reports`: cột `date` của
 * Postgres được in **thẳng chuỗi ISO** ra màn hình ("2026-07-15") thay vì
 * `dd/MM/yyyy` như `D-12` quy định. Không ai thấy vì seed không có hóa đơn nào.
 *
 * Bộ test này khoá cả hai vế: định dạng đúng, **và** không quy đổi múi giờ.
 */
describe("formatDateOnly", () => {
  it("đổi chuỗi date của Postgres sang dd/MM/yyyy", () => {
    expect(formatDateOnly("2026-07-15")).toBe("15/07/2026");
    expect(formatDateOnly("2026-01-01")).toBe("01/01/2026");
    expect(formatDateOnly("2026-12-31")).toBe("31/12/2026");
  });

  it("chấp nhận cả chuỗi có phần giờ phía sau", () => {
    expect(formatDateOnly("2026-07-15T00:00:00Z")).toBe("15/07/2026");
  });

  it("trả về '—' khi không có giá trị", () => {
    expect(formatDateOnly(null)).toBe("—");
    expect(formatDateOnly(undefined)).toBe("—");
    expect(formatDateOnly("")).toBe("—");
  });

  it("giữ nguyên chuỗi lạ thay vì bịa ra một ngày", () => {
    // Thà hiện thứ khó hiểu còn hơn hiện một ngày SAI mà trông như thật.
    expect(formatDateOnly("không phải ngày")).toBe("không phải ngày");
  });

  /**
   * Đây là lý do hàm này tồn tại. `formatDate` đẩy chuỗi qua `parseISO` (nửa
   * đêm theo giờ MÁY) rồi đổi sang giờ Việt Nam — máy ở múi giờ đông hơn +07 bị
   * **lùi một ngày**. Đo thật ngoài tiến trình bằng `TZ=<tz> node`:
   *
   *   UTC · New York · Berlin · Ho_Chi_Minh → 15/07/2026
   *   Pacific/Auckland (+12) · Kiritimati (+14) → **14/07/2026**
   *
   * ⚠️ **Không kiểm lại điều đó bằng cách gán `process.env.TZ` trong test.**
   * Node đọc TZ một lần lúc khởi động, gán lại giữa chừng **không có tác dụng**
   * — bài kiểm kiểu đó sẽ xanh với cả bản cài đặt hỏng, đúng loại "test xanh mà
   * không kiểm gì" mà `AGENTS.md` cấm.
   *
   * Thứ kiểm được ở đây là tính chất THẬT khiến hàm miễn nhiễm múi giờ: nó chỉ
   * cắt chuỗi, không bao giờ dựng `Date`. Nếu ai đó viết lại bằng `new Date()`
   * thì mốc dưới đây lệch ngay, vì với máy chạy test (UTC+7) một chuỗi có giờ
   * UTC muộn sẽ nhảy sang ngày hôm sau.
   */
  it("không dựng Date: phần ngày trong chuỗi được giữ nguyên", () => {
    // 23:30Z ngày 15 → nếu quy đổi sang +07 sẽ thành ngày 16. Phải vẫn là 15.
    expect(formatDateOnly("2026-07-15T23:30:00Z")).toBe("15/07/2026");
    // 00:30Z ngày 15 → nếu quy đổi sang múi giờ âm sẽ thành ngày 14. Vẫn là 15.
    expect(formatDateOnly("2026-07-15T00:30:00Z")).toBe("15/07/2026");
  });

  it("khác với formatDate: formatDate dành cho timestamptz, không dành cho date", () => {
    // `formatDate` vẫn đúng việc của nó — mốc thời gian thật có múi giờ.
    expect(formatDate("2026-07-15T10:00:00Z")).toBe("15/07/2026");
  });
});
