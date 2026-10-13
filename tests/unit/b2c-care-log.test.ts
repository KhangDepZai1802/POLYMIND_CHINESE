import { describe, expect, it } from "vitest";
import { b2cCareLogSchema } from "@/features/b2c/schema";
const valid = { lead_id: "44000000-0000-4000-8000-000000000001", channel: "call", contact_date: "2026-10-13", caretaker_name: "Giáo vụ", content: "Trao đổi lịch học với phụ huynh", next_followup_date: "2026-10-15" };
describe("Nhật ký chăm sóc B2C", () => {
  it("nhận gọi/nhắn tin, cho phép không hẹn tiếp", () => {
    expect(b2cCareLogSchema.safeParse(valid).success).toBe(true);
    expect(b2cCareLogSchema.parse({ ...valid, channel: "message", next_followup_date: "" }).next_followup_date).toBeNull();
  });
  it("chặn hẹn trước ngày liên hệ", () => {
    expect(b2cCareLogSchema.safeParse({ ...valid, next_followup_date: "2026-10-12" }).success).toBe(false);
    expect(b2cCareLogSchema.safeParse({ ...valid, next_followup_date: valid.contact_date }).success).toBe(true);
  });
  it("bắt buộc người phụ trách, nội dung, ngày và lead hợp lệ", () => {
    for (const field of ["lead_id", "caretaker_name", "content", "contact_date"]) expect(b2cCareLogSchema.safeParse({ ...valid, [field]: "" }).success).toBe(false);
  });
});
