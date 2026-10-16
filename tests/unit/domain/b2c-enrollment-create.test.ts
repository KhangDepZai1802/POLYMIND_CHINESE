import { describe, expect, it } from "vitest";
import { b2cEnrollmentCreateSchema } from "@/features/b2c/enrollment-create-schema";
const base = {
  request_id: "16200000-0000-4000-8000-000000000001",
  class_id: "16200000-0000-4000-8000-000000000002",
  mode: "new",
  full_name: "Học viên mới",
  salesperson: "Tư vấn A",
  enrollment_date: "2026-10-16",
};
describe("B2C enrollment creation", () => {
  it("accepts missing or blank parent Zalo and validates a supplied phone", () => {
    expect(b2cEnrollmentCreateSchema.parse(base).guardian_zalo).toBe("");
    expect(
      b2cEnrollmentCreateSchema.parse({ ...base, guardian_zalo: "   " })
        .guardian_zalo,
    ).toBe("");
    expect(
      b2cEnrollmentCreateSchema.parse({
        ...base,
        guardian_zalo: " 0912345678 ",
      }).guardian_zalo,
    ).toBe("0912345678");
    expect(
      b2cEnrollmentCreateSchema.safeParse({ ...base, guardian_zalo: "abc" })
        .success,
    ).toBe(false);
  });
  it("allows optional contact and issues no user-selected status/account fields", () => {
    const parsed = b2cEnrollmentCreateSchema.parse({
      ...base,
      status: "completed",
      user_id: "ignored",
    });
    expect(parsed.phone).toBe("");
    expect(parsed).not.toHaveProperty("status");
    expect(parsed).not.toHaveProperty("user_id");
  });
  it("requires an existing student ID for reuse mode", () => {
    expect(
      b2cEnrollmentCreateSchema.safeParse({
        ...base,
        mode: "existing",
        full_name: "",
      }).success,
    ).toBe(false);
    expect(
      b2cEnrollmentCreateSchema.safeParse({
        ...base,
        mode: "existing",
        full_name: "",
        student_id: base.request_id,
      }).success,
    ).toBe(true);
  });
  it("rejects malformed phone and missing referral/certificate details", () => {
    for (const extra of [
      { phone: "123" },
      { customer_source: "referral" },
      { learning_goal: "certificate" },
    ])
      expect(
        b2cEnrollmentCreateSchema.safeParse({ ...base, ...extra }).success,
      ).toBe(false);
  });
  it("checks fee expiry against learning start", () => {
    expect(
      b2cEnrollmentCreateSchema.safeParse({
        ...base,
        tuition_end_date: "2026-11-01",
      }).success,
    ).toBe(false);
    expect(
      b2cEnrollmentCreateSchema.safeParse({
        ...base,
        learning_start_date: "2026-10-01",
        tuition_end_date: "2026-09-30",
      }).success,
    ).toBe(false);
  });
});
