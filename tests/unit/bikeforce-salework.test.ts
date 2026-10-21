import { describe, expect, it } from "vitest";

import { saleWorkSyncSchema } from "@/features/b2c/salework-schema";
import { hasValidApiKey } from "@/lib/security/api-key";

describe("BikeForce SaleWork sync contract", () => {
  const snapshot = {
    conversations: 12,
    sentMessages: 30,
    receivedMessages: 24,
    incomingCalls: 7,
    outgoingCalls: 9,
    missedCalls: 2,
    callDurationSeconds: 3660,
    syncedAt: "2026-10-21T07:30:00Z",
  };

  it.each(["co-le", "co-thy"])("nhận snapshot của %s không cần mã Telesale", (person) => {
    expect(saleWorkSyncSchema.parse({ person, date: "2026-10-21", snapshot })).toEqual({
      person,
      date: "2026-10-21",
      snapshot,
    });
  });

  it.each([
    { person: "co-khac", date: "2026-10-21", snapshot },
    { person: "co-le", date: "21/10/2026", snapshot },
    { person: "co-le", date: "2026-10-21", snapshot: [] },
    { person: "co-le", date: "2026-10-21", snapshot: { ...snapshot, missedCalls: -1 } },
    { person: "co-le", date: "2026-10-21", snapshot: { ...snapshot, extra: 1 } },
    { person: "co-le", date: "2026-10-21", snapshot, telesaleCode: "X" },
  ])("từ chối payload ngoài hợp đồng", (payload) => {
    expect(saleWorkSyncSchema.safeParse(payload).success).toBe(false);
  });

  it("so sánh API key chính xác", () => {
    expect(hasValidApiKey("bikeforce-secret", "bikeforce-secret")).toBe(true);
    expect(hasValidApiKey("bikeforce-wrong", "bikeforce-secret")).toBe(false);
    expect(hasValidApiKey(null, "bikeforce-secret")).toBe(false);
  });
});
