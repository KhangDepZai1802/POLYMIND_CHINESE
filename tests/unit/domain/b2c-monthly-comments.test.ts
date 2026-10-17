import { describe, expect, it } from "vitest";
import { monthlyCommentSchema, formatMonthlyComment } from "@/features/b2c/domain/monthly-comments";
import { toggleB2CPermission, DEFAULT_B2C_PERMISSIONS } from "@/features/b2c/domain/teacher-permissions";
const id = "17300000-0000-4000-8000-000000000001";
const content = { attendance: "Đều đặn", attitude: "Tích cực", learning: "Nói rõ hơn", strengths: "Tự tin", improvements: "Ôn từ", next_plan: "Đọc cùng con" };
describe("Monthly comments", () => {
  it("allows drafts and requires six nonempty fields before ready", () => {
    const data = { request_id: id, class_id: id, enrollment_id: id, month: "2026-10", expected_updated_at: null, status: "draft", content: { ...content, attitude: "" } };
    expect(monthlyCommentSchema.safeParse(data).success).toBe(true);
    expect(monthlyCommentSchema.safeParse({ ...data, status: "ready" }).success).toBe(false);
    expect(monthlyCommentSchema.safeParse({ ...data, status: "ready", content }).success).toBe(true);
    expect(monthlyCommentSchema.safeParse({ ...data, month: "2026-13" }).success).toBe(false);
  });
  it("formats a parent-ready message without internal identifiers", () => {
    const message = formatMonthlyComment({ fullName: "An", className: "Movers", month: "2026-10", content, teacher: "Cô Tú" });
    expect(message).toContain("NHẬN XÉT THÁNG 10/2026");
    expect(message).toContain("Kính gửi Quý phụ huynh của học viên An");
    expect(message).toContain("Chuyên cần: Đều đặn");
    expect(message).toContain("Giáo viên/người nhận xét: Cô Tú");
  });
  it("requires opt-in sharing and transitive write/read permissions", () => {
    expect(DEFAULT_B2C_PERMISSIONS).not.toContain("share_monthly_comments");
    const grants = toggleB2CPermission([], "share_monthly_comments", true);
    expect(grants).toEqual(["view_classes", "view_students", "view_comments", "write_comments", "share_monthly_comments"]);
    expect(toggleB2CPermission(grants, "write_comments", false)).not.toContain("share_monthly_comments");
  });
});
