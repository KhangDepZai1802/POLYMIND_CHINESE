import { describe, expect, it } from "vitest";
import { isLowEnrollment } from "@/features/b2c/domain/class-enrollment-warning";

describe("B2C low enrollment warning", () => {
  it("flags active classes below five, including empty classes", () => {
    expect(isLowEnrollment(0, "active")).toBe(true);
    expect(isLowEnrollment(4, "active")).toBe(true);
    expect(isLowEnrollment(5, "active")).toBe(false);
    expect(isLowEnrollment(6, "active")).toBe(false);
  });

  it("excludes classes that are not active and invalid counts", () => {
    for (const status of ["planned", "paused", "completed", "cancelled"])
      expect(isLowEnrollment(3, status)).toBe(false);
    for (const count of [-1, NaN, Infinity, 1.5])
      expect(isLowEnrollment(count, "active")).toBe(false);
  });
});
