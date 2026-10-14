import { describe, expect, it } from "vitest";
import { teacherRenewalRates } from "@/features/b2c/domain/teacher-renewal";

describe("teacher renewal rates", () => {
  it("distinguishes installments from post-expiry payments and excludes future receipts", () => {
    expect(
      teacherRenewalRates(
        [
          { id: "a", student_id: "1", tuition_end_date: "2026-10-01" },
          { id: "b", student_id: "2", tuition_end_date: "2026-10-01" },
          { id: "c", student_id: "3", tuition_end_date: "2026-11-01" },
        ],
        [
          { enrollmentId: "a", paid_date: "2026-09-01" },
          { enrollmentId: "a", paid_date: "2026-09-15" },
          { enrollmentId: "b", paid_date: "2026-10-02" },
          { enrollmentId: "b", paid_date: "2026-12-02" },
        ],
        "2026-10-14",
      ),
    ).toEqual({ repeatPaymentRate: 50, renewalAfterExpiryRate: 50 });
  });
  it("counts each student once across classes", () => {
    expect(
      teacherRenewalRates(
        [
          { id: "a", student_id: "1", tuition_end_date: "2026-10-01" },
          { id: "b", student_id: "1", tuition_end_date: "2026-10-01" },
        ],
        [
          { enrollmentId: "a", paid_date: "2026-09-01" },
          { enrollmentId: "b", paid_date: "2026-10-02" },
        ],
        "2026-10-14",
      ),
    ).toEqual({ repeatPaymentRate: 100, renewalAfterExpiryRate: 100 });
  });
  it("keeps missing denominators unknown and does not treat today's expiry as expired", () => {
    expect(
      teacherRenewalRates(
        [{ id: "a", student_id: "1", tuition_end_date: "2026-10-14" }],
        [],
        "2026-10-14",
      ),
    ).toEqual({ repeatPaymentRate: null, renewalAfterExpiryRate: null });
  });
});
