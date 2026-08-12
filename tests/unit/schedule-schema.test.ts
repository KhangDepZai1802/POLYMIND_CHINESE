import { describe, expect, it } from "vitest";

import { rescheduleSessionWithMakeupSchema } from "@/features/schedules/schema";

const VALID = {
  class_id: "33333333-3333-4333-8333-333333333333",
  session_id: "11111111-1111-4111-8111-111111111111",
  request_id: "55555555-5555-4555-8555-555555555555",
  new_starts_at: "2099-12-02T08:00",
  new_ends_at: "2099-12-02T09:30",
  reason: "Nghỉ theo thông báo của đơn vị",
};

describe("rescheduleSessionWithMakeupSchema", () => {
  it("nhận ngày bù hợp lệ", () => {
    expect(rescheduleSessionWithMakeupSchema.safeParse(VALID).success).toBe(
      true,
    );
  });

  it("chặn giờ kết thúc trước giờ bắt đầu", () => {
    const result = rescheduleSessionWithMakeupSchema.safeParse({
      ...VALID,
      new_ends_at: "2099-12-02T07:30",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.new_ends_at).toContain(
        "Giờ kết thúc phải sau giờ bắt đầu",
      );
    }
  });

  it("chặn lý do quá ngắn", () => {
    const result = rescheduleSessionWithMakeupSchema.safeParse({
      ...VALID,
      reason: "x",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.reason).toContain(
        "Nhập lý do ít nhất 3 ký tự",
      );
    }
  });
});
