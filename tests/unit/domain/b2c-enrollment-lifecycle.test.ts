import { describe, expect, it } from "vitest";
import { enrollmentLifecycleSchema } from "@/features/b2c/domain/enrollment-lifecycle";
import { tuitionExpiring, summarizeStudentStatus, type StudentDashboardEnrollment } from "@/features/b2c/domain/student-dashboard";

const base = {
  request_id: "17100000-0000-4000-8000-000000000001",
  enrollment_id: "17100000-0000-4000-8000-000000000002",
  expected_updated_at: "2026-10-17T00:00:00+00:00",
  action: "hold", effective_date: "2026-10-17", expected_return_date: "2026-11-01",
  target_class_id: "", reason: "Bận công việc",
};
describe("B2C enrollment lifecycle", () => {
  it("validates hold and requires a reason and sensible return date", () => {
    expect(enrollmentLifecycleSchema.safeParse(base).success).toBe(true);
    expect(enrollmentLifecycleSchema.safeParse({ ...base, reason: " " }).success).toBe(false);
    expect(enrollmentLifecycleSchema.safeParse({ ...base, expected_return_date: "2026-10-16" }).success).toBe(false);
  });
  it("requires destination only on transfer and return date only on hold", () => {
    expect(enrollmentLifecycleSchema.safeParse({ ...base, action: "transfer", expected_return_date: "" }).success).toBe(false);
    expect(enrollmentLifecycleSchema.safeParse({ ...base, action: "transfer", expected_return_date: "", target_class_id: base.request_id }).success).toBe(true);
    expect(enrollmentLifecycleSchema.safeParse({ ...base, action: "resume" }).success).toBe(false);
    expect(enrollmentLifecycleSchema.safeParse({ ...base, action: "resume", expected_return_date: "" }).success).toBe(true);
    expect(enrollmentLifecycleSchema.safeParse({ ...base, target_class_id: base.request_id }).success).toBe(false);
  });
  it("prioritizes the active destination enrollment over the closed source", () => {
    const old = { status: "transferred", tuition_end_date: "2026-10-20" } as StudentDashboardEnrollment;
    expect(tuitionExpiring(old, "2026-10-17")).toBe(false);
    expect(summarizeStudentStatus([old, { status: "studying" } as StudentDashboardEnrollment])).toBe("studying");
  });
});
