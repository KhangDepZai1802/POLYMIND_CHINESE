import { describe, expect, it } from "vitest";
import { b2cAssessmentSchema, b2cAssessmentResultSchema } from "@/features/b2c/domain/assessments";
import { toggleB2CPermission, DEFAULT_B2C_PERMISSIONS } from "@/features/b2c/domain/teacher-permissions";
const id = "17200000-0000-4000-8000-000000000001";
describe("B2C assessment validation", () => {
  it("supports midterm/final and positive scales with two decimal places", () => {
    const exam = { request_id: id, class_id: id, id: null, expected_updated_at: null, title: "Giữa kỳ", kind: "midterm", exam_date: "2026-10-17", max_score: 10 };
    expect(b2cAssessmentSchema.safeParse(exam).success).toBe(true);
    expect(b2cAssessmentSchema.safeParse({ ...exam, kind: "final" }).success).toBe(true);
    expect(b2cAssessmentSchema.safeParse({ ...exam, max_score: 0 }).success).toBe(false);
    expect(b2cAssessmentSchema.safeParse({ ...exam, max_score: 1.234 }).success).toBe(false);
  });
  it("keeps null and zero distinct and requires a reason when correcting", () => {
    const result = { request_id: id, class_id: id, exam_id: id, enrollment_id: id, expected_updated_at: null, score: null, feedback: "", reason: "" };
    expect(b2cAssessmentResultSchema.parse(result).score).toBeNull();
    expect(b2cAssessmentResultSchema.parse({ ...result, score: 0 }).score).toBe(0);
    expect(b2cAssessmentResultSchema.safeParse({ ...result, score: -1 }).success).toBe(false);
    expect(b2cAssessmentResultSchema.safeParse({ ...result, expected_updated_at: "2026-10-17T00:00:00Z" }).success).toBe(false);
    expect(b2cAssessmentResultSchema.safeParse({ ...result, expected_updated_at: "2026-10-17T00:00:00Z", reason: "Sửa nhầm" }).success).toBe(true);
  });
  it("makes assessment permissions opt-in with transitive dependencies", () => {
    expect(DEFAULT_B2C_PERMISSIONS).not.toContain("view_assessments");
    const granted = toggleB2CPermission([], "grade_assessments", true);
    expect(granted).toEqual(["view_classes", "view_students", "view_assessments", "grade_assessments"]);
    expect(toggleB2CPermission(granted, "view_students", false)).toEqual(["view_classes"]);
  });
});
