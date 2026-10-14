import { describe, it, expect } from "vitest";
import {
  marketSchema,
  orderSchema,
  orderFiltersSchema,
  recruitmentExpired,
  formatOrderSalary,
} from "@/features/xkld/domain/orders";
const version = {
  id: "",
  create_request_id: "71000000-0000-4000-8000-000000000020",
  updated_at: "",
};
const order = {
  ...version,
  market_id: "71000000-0000-4000-8000-000000000010",
  employer: " Chủ sử dụng ",
  industry: "Cơ khí",
  recruitment_quantity: "12",
  salary_amount: "1234.56",
  salary_currency: "sgd",
  salary_period: "month",
  conditions: "Điều kiện tuyển",
  recruitment_deadline: "2027-01-01",
  partner: "Đối tác",
  status: "open",
};
describe("markets and orders", () => {
  it("preserves salary precision, currency and pay period", () => {
    const saved = orderSchema.parse(order);
    expect(saved.salary_amount).toBe(1234.56);
    expect(saved.salary_currency).toBe("SGD");
    expect(saved.employer).toBe("Chủ sử dụng");
    expect(formatOrderSalary(saved)).toBe("1.234,56 SGD / tháng");
  });
  it("rejects invalid quantities, salary precision and incomplete orders", () => {
    for (const invalid of [
      { salary_amount: "" },
      { salary_amount: "-1" },
      { salary_amount: "1.001" },
      { salary_currency: "SG" },
      { recruitment_quantity: 0 },
      { recruitment_quantity: 1.5 },
      { market_id: "unknown" },
      { conditions: " " },
      { recruitment_deadline: "2027-02-30" },
      { id: order.market_id, updated_at: "" },
    ])
      expect(orderSchema.safeParse({ ...order, ...invalid }).success).toBe(
        false,
      );
  });
  it("normalizes market codes and validates activation state", () => {
    const market = {
      ...version,
      country_code: "sg",
      country_name: " Singapore ",
      currency_code: "sgd",
      is_active: "false",
    };
    expect(marketSchema.parse(market)).toMatchObject({
      country_code: "SG",
      country_name: "Singapore",
      currency_code: "SGD",
      is_active: false,
    });
    for (const invalid of [
      { country_code: "SGP" },
      { currency_code: "SG" },
      { country_name: " " },
      { is_active: "yes" },
    ])
      expect(marketSchema.safeParse({ ...market, ...invalid }).success).toBe(
        false,
      );
  });
  it("keeps today's deadline inclusive and distinguishes closed orders", () => {
    expect(
      recruitmentExpired(
        { status: "open", recruitment_deadline: "2026-10-14" },
        "2026-10-14",
      ),
    ).toBe(false);
    expect(
      recruitmentExpired(
        { status: "open", recruitment_deadline: "2026-10-13" },
        "2026-10-14",
      ),
    ).toBe(true);
    expect(
      recruitmentExpired(
        { status: "closed", recruitment_deadline: "2026-10-13" },
        "2026-10-14",
      ),
    ).toBe(false);
  });
  it("bounds filters and supports market/status/deadline combinations", () => {
    expect(
      orderFiltersSchema.parse({
        market: order.market_id,
        status: "open",
        deadline: "expired",
      }),
    ).toMatchObject({ page: 0, q: "", status: "open" });
    for (const invalid of [
      { page: -1 },
      { page: 1.5 },
      { market: "x" },
      { deadline: "bad" },
      { q: "x".repeat(201) },
    ])
      expect(orderFiltersSchema.safeParse(invalid).success).toBe(false);
  });
});
