import { describe, expect, it } from "vitest";
import {
  b2cTuitionPackageSchema,
  b2cReceiptSchema,
} from "@/features/b2c/tuition-schema";
const uuid = "46000000-0000-4000-8000-000000000003";
const pack = {
  enrollment_id: uuid,
  sessions: "12",
  unit_price: "100000",
  discount: "200000",
  discount_reason: "Promotion",
};
const receipt = {
  package_id: uuid,
  request_id: uuid,
  paid_date: "2026-10-13",
  amount: "400000",
  method: "cash",
  collector_name: "Collector",
};
describe("B2C tuition validation", () => {
  it("coerces form numbers for totals", () => {
    const p = b2cTuitionPackageSchema.parse(pack);
    expect(p.sessions * p.unit_price - p.discount).toBe(1000000);
  });
  it("requires discount reason", () =>
    expect(
      b2cTuitionPackageSchema.safeParse({ ...pack, discount_reason: " " })
        .success,
    ).toBe(false));
  it("rejects discount above subtotal", () =>
    expect(
      b2cTuitionPackageSchema.safeParse({ ...pack, discount: "1200001" })
        .success,
    ).toBe(false));
  it("allows no discount without reason", () =>
    expect(
      b2cTuitionPackageSchema.safeParse({
        ...pack,
        discount: "0",
        discount_reason: "",
      }).success,
    ).toBe(true));
  it("rejects fractional sessions and money", () => {
    for (const change of [
      { sessions: "1.5" },
      { unit_price: "1.5" },
      { discount: "1.5" },
    ])
      expect(
        b2cTuitionPackageSchema.safeParse({ ...pack, ...change }).success,
      ).toBe(false);
  });
  it("rejects oversized subtotal", () =>
    expect(
      b2cTuitionPackageSchema.safeParse({
        ...pack,
        sessions: "100000",
        unit_price: "999999999999",
      }).success,
    ).toBe(false));
  it("accepts cash and transfer", () => {
    for (const method of ["cash", "bank_transfer"])
      expect(b2cReceiptSchema.safeParse({ ...receipt, method }).success).toBe(
        true,
      );
  });
  it("rejects invalid payment data", () => {
    for (const change of [
      { amount: "0" },
      { amount: "1.5" },
      { method: "card" },
      { collector_name: " " },
      { paid_date: "2026-02-30" },
      { request_id: "" },
    ])
      expect(
        b2cReceiptSchema.safeParse({ ...receipt, ...change }).success,
      ).toBe(false);
  });
});
