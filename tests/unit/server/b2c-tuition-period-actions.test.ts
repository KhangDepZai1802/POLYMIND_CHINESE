import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireTeaching: mocks.auth }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({
  permissionRpc: mocks.rpc,
}));
vi.mock("@/features/b2c/server/revalidate-views", () => ({
  revalidateB2CViews: mocks.revalidate,
}));

import {
  saveB2CTuitionPeriodAction,
  startB2CTuitionPeriodAction,
} from "@/features/b2c/server/tuition-period-actions";

const enrollment = "11111111-1111-4111-8111-111111111111";
const packageId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const values = {
  enrollment_id: enrollment,
  package_id: packageId,
  previous_package_id: packageId,
  request_id: requestId,
  sessions: "24",
  unit_price: "120000",
  discount: "100000",
  discount_reason: "Ưu đãi đợt mới",
  adjustment_reason: "Tạo đợt học phí mới",
  expected_due: "3695000",
  expected_paid: "3695000",
};
function form(changes: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({ ...values, ...changes })) {
    result.set(key, value);
  }
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "teacher" });
  mocks.rpc.mockResolvedValue("44444444-4444-4444-8444-444444444444");
});

describe("B2C tuition period actions", () => {
  it("edits the exact package instead of whichever period is current", async () => {
    expect(await saveB2CTuitionPeriodAction({}, form())).toHaveProperty(
      "success",
    );
    expect(mocks.auth).toHaveBeenCalledWith("super_admin");
    expect(mocks.rpc).toHaveBeenCalledWith("save_b2c_tuition_period", {
      p_package_id: packageId,
      p_sessions: 24,
      p_unit_price: 120000,
      p_discount: 100000,
      p_discount_reason: "Ưu đãi đợt mới",
      p_reason: "Tạo đợt học phí mới",
      p_expected_due: 3695000,
      p_expected_paid: 3695000,
    });
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });

  it("creates a separate period with the prior balance for conflict checks and a retry id", async () => {
    expect(await startB2CTuitionPeriodAction({}, form())).toHaveProperty(
      "success",
    );
    expect(mocks.auth).toHaveBeenCalledWith("super_admin");
    expect(mocks.rpc).toHaveBeenCalledWith("start_b2c_tuition_period", {
      p_enrollment_id: enrollment,
      p_previous_package_id: packageId,
      p_request_id: requestId,
      p_sessions: 24,
      p_unit_price: 120000,
      p_discount: 100000,
      p_discount_reason: "Ưu đãi đợt mới",
      p_reason: "Tạo đợt học phí mới",
      p_expected_due: 3695000,
      p_expected_paid: 3695000,
    });
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
  });

  it.each<Record<string, string>>([
    { sessions: "" },
    { sessions: "1.5" },
    { unit_price: " " },
    { discount: "" },
    { discount: "2880001" },
    { discount_reason: " " },
    { expected_due: "" },
    { expected_paid: "" },
    { expected_paid: "-1" },
    { adjustment_reason: " " },
    { previous_package_id: "invalid" },
    { request_id: "invalid" },
  ])("rejects malformed or incomplete new-period input %j", async (change) => {
    expect(await startB2CTuitionPeriodAction({}, form(change))).toHaveProperty(
      "fieldErrors",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("does not edit without a package id even when enrollment is valid", async () => {
    const input = form();
    input.delete("package_id");
    expect(await saveB2CTuitionPeriodAction({}, input)).toHaveProperty(
      "fieldErrors.package_id",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([saveB2CTuitionPeriodAction, startB2CTuitionPeriodAction])(
    "keeps server authorization errors out of the mutation path",
    async (action) => {
      mocks.auth.mockRejectedValue(new Error("NEXT_REDIRECT"));
      await expect(action({}, form())).rejects.toThrow("NEXT_REDIRECT");
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.revalidate).not.toHaveBeenCalled();
    },
  );

  it.each([saveB2CTuitionPeriodAction, startB2CTuitionPeriodAction])(
    "returns a denied or stale DB result without refreshing or claiming success",
    async (action) => {
      mocks.rpc.mockRejectedValue(
        new Error("Số dư đã thay đổi. Vui lòng tải lại."),
      );
      expect(await action({}, form())).toEqual({
        error: "Số dư đã thay đổi. Vui lòng tải lại.",
      });
      expect(mocks.revalidate).not.toHaveBeenCalled();
    },
  );
});
