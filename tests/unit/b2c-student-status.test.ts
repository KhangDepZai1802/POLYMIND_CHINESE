import { describe, expect, it } from "vitest";
import { b2cStudentStatusSchema } from "@/features/b2c/schema";
import { B2C_STUDENT_STATUSES } from "@/features/b2c/domain/student-status";

const enrollment_id = "40000000-0000-4000-8000-000000000001";

describe("Trạng thái học viên B2C", () => {
  it.each(B2C_STUDENT_STATUSES)("nhận trạng thái %s", (status) => {
    expect(b2cStudentStatusSchema.parse({ enrollment_id, status, withdrawal_reason: "" }).status).toBe(status);
  });
  it("lưu lý do nghỉ đã bỏ khoảng trắng", () => {
    expect(b2cStudentStatusSchema.parse({ enrollment_id, status: "withdrawn", withdrawal_reason: "  Chuyển nơi ở  " }).withdrawal_reason).toBe("Chuyển nơi ở");
  });
  it("xóa lý do nghỉ khi chuyển sang đang học", () => {
    expect(b2cStudentStatusSchema.parse({ enrollment_id, status: "studying", withdrawal_reason: "Chuyển nơi ở" }).withdrawal_reason).toBeNull();
  });
  it("từ chối trạng thái lạ, ID sai và lý do quá dài", () => {
    const valid = { enrollment_id, status: "withdrawn", withdrawal_reason: "" };
    expect(b2cStudentStatusSchema.safeParse({ ...valid, status: "unknown" }).success).toBe(false);
    expect(b2cStudentStatusSchema.safeParse({ ...valid, enrollment_id: "bad" }).success).toBe(false);
    expect(b2cStudentStatusSchema.safeParse({ ...valid, withdrawal_reason: "a".repeat(1001) }).success).toBe(false);
  });
});
