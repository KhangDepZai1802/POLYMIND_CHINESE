import { describe, it, expect } from "vitest";
import {
  canManageFinance,
  installmentSchema,
  transactionSchema,
  voidTransactionSchema,
} from "@/features/xkld/domain/finance";
const id = "74000000-0000-4000-8000-000000000001";
const installment = {
  request_id: id,
  candidate_id: id,
  kind: "candidate_fee",
  title: "Đợt 1",
  counterparty: "Nguyễn A",
  amount: "1000000",
  due_date: "2026-10-01",
  note: "",
};
const receipt = {
  request_id: id,
  installment_id: id,
  kind: "receipt",
  amount: "200000",
  reduce_fee: false,
  occurred_on: "2026-10-01",
  method: "cash",
  note: "",
};
describe("XKLĐ finance inputs", () => {
  it("allows the two authorized financial editors only", () => {
    expect(canManageFinance("super_admin")).toBe(true);
    expect(canManageFinance("executive")).toBe(true);
    for (const role of [
      "xkld_staff",
      "consultant",
      "center_manager",
      "academic_manager",
      "teacher",
      "student",
    ] as const)
      expect(canManageFinance(role)).toBe(false);
  });
  it("requires integral VND, bounds and actual counterparties", () => {
    expect(installmentSchema.parse(installment).amount).toBe(1000000);
    for (const patch of [
      { amount: "1.5" },
      { amount: 0 },
      { amount: 1000000000000 },
      { counterparty: " " },
      { due_date: "2026-02-30" },
    ])
      expect(
        installmentSchema.safeParse({ ...installment, ...patch }).success,
      ).toBe(false);
    expect(
      installmentSchema.safeParse({ ...installment, id, amount: 0 }).success,
    ).toBe(true);
  });
  it("requires refund attribution and explanation without silently inferring policy", () => {
    expect(transactionSchema.safeParse(receipt).success).toBe(true);
    expect(
      transactionSchema.safeParse({ ...receipt, kind: "refund" }).success,
    ).toBe(false);
    expect(
      transactionSchema.safeParse({
        ...receipt,
        kind: "refund",
        receipt_id: id,
        note: "Hoàn theo thỏa thuận",
        reduce_fee: true,
      }).success,
    ).toBe(true);
    expect(
      transactionSchema.safeParse({
        ...receipt,
        kind: "refund",
        receipt_id: id,
        note: "Hoàn theo thỏa thuận",
        reduce_fee: false,
      }).success,
    ).toBe(true);
    expect(
      transactionSchema.safeParse({ ...receipt, reduce_fee: true }).success,
    ).toBe(false);
  });
  it("never accepts an empty cancellation reason or a negative cash movement", () => {
    expect(
      voidTransactionSchema.safeParse({ id, request_id: id, reason: " " })
        .success,
    ).toBe(false);
    expect(
      transactionSchema.safeParse({ ...receipt, amount: -100 }).success,
    ).toBe(false);
    expect(transactionSchema.safeParse({ ...receipt, amount: 0 }).success).toBe(
      false,
    );
  });
});
