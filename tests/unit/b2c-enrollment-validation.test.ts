import { describe, expect, it } from "vitest";
import { b2cEnrollmentEditSchema } from "@/features/b2c/schema";
const valid = { learning_goal: "", certificate_goal: "", customer_source: "", referrer_name: "", enrollment_id: "40000000-0000-4000-8000-000000000001", phone: "0912345678", salesperson: "Giáo vụ", enrollment_date: "2026-10-13", program_slug: "tieng-anh", learning_start_date: "2026-10-13", tuition_end_date: "2026-11-13", status: "studying", withdrawal_reason: "" };
describe("Validation ghi danh B2C", () => {
  it("mục tiêu chứng chỉ bắt buộc tên và mục tiêu khác xóa tên cũ", () => {
    expect(b2cEnrollmentEditSchema.safeParse({ ...valid, learning_goal: "certificate" }).success).toBe(false);
    expect(b2cEnrollmentEditSchema.parse({ ...valid, learning_goal: "certificate", certificate_goal: " HSK 3 " }).certificate_goal).toBe("HSK 3");
    expect(b2cEnrollmentEditSchema.parse({ ...valid, learning_goal: "communication", certificate_goal: "HSK 3" }).certificate_goal).toBeNull();
    expect(b2cEnrollmentEditSchema.safeParse({ ...valid, learning_goal: "invalid" }).success).toBe(false);
  });
  it("nguồn giới thiệu bắt buộc tên và nguồn khác xóa tên cũ", () => {
    expect(b2cEnrollmentEditSchema.safeParse({ ...valid, customer_source: "referral" }).success).toBe(false);
    expect(b2cEnrollmentEditSchema.parse({ ...valid, customer_source: "referral", referrer_name: "  Lan  " }).referrer_name).toBe("Lan");
    expect(b2cEnrollmentEditSchema.parse({ ...valid, customer_source: "facebook", referrer_name: "Lan" }).referrer_name).toBeNull();
    expect(b2cEnrollmentEditSchema.parse({ ...valid, customer_source: "tiktok", referrer_name: "Lan" }).referrer_name).toBeNull();
    expect(b2cEnrollmentEditSchema.safeParse({ ...valid, customer_source: "invalid" }).success).toBe(false);
  });
  it("nhận dữ liệu hợp lệ và hai ngày bằng nhau", () => {
    expect(b2cEnrollmentEditSchema.safeParse(valid).success).toBe(true);
    expect(b2cEnrollmentEditSchema.safeParse({ ...valid, tuition_end_date: valid.learning_start_date }).success).toBe(true);
  });
  it.each(["", "091234567", "09123456789", "09123abc78", "+84912345678"])("từ chối SĐT %s", (phone) => {
    expect(b2cEnrollmentEditSchema.safeParse({ ...valid, phone }).success).toBe(false);
  });
  it.each(["salesperson", "enrollment_date", "program_slug"])("bắt buộc %s", (field) => {
    expect(b2cEnrollmentEditSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false);
  });
  it("chặn ngày hết phí trước bắt đầu hoặc thiếu ngày bắt đầu", () => {
    expect(b2cEnrollmentEditSchema.safeParse({ ...valid, tuition_end_date: "2026-10-12" }).success).toBe(false);
    expect(b2cEnrollmentEditSchema.safeParse({ ...valid, learning_start_date: "" }).success).toBe(false);
  });
  it("chặn ngày không có thật và người chốt chỉ có khoảng trắng", () => {
    expect(b2cEnrollmentEditSchema.safeParse({ ...valid, enrollment_date: "2026-02-30" }).success).toBe(false);
    expect(b2cEnrollmentEditSchema.safeParse({ ...valid, salesperson: "   " }).success).toBe(false);
  });
});
