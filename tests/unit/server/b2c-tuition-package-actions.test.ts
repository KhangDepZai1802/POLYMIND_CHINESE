import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireTeaching: mocks.auth }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({
  permissionRpc: mocks.rpc,
}));
vi.mock("@/features/b2c/server/revalidate-views", () => ({
  revalidateB2CViews: mocks.revalidate,
}));

import { saveB2CTuitionPackageAction } from "@/features/b2c/server/tuition-actions";

const enrollment = "11111111-1111-4111-8111-111111111111";
function form(changes: Record<string, string> = {}) {
  const result = new FormData();
  for (const [key, value] of Object.entries({
    enrollment_id: enrollment,
    sessions: "24",
    unit_price: "120000",
    discount: "100000",
    discount_reason: "Ưu đãi",
    ...changes,
  })) {
    result.set(key, value);
  }
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "teacher" });
  mocks.rpc.mockResolvedValue("22222222-2222-4222-8222-222222222222");
});

describe("B2C initial tuition package actions", () => {
  it.each([undefined, ""])(
    "retains automatic formula mode for empty total %j",
    async (total) => {
      expect(
        await saveB2CTuitionPackageAction(
          {},
          form(total === undefined ? {} : { total_due_override: total }),
        ),
      ).toHaveProperty("success");
      expect(mocks.auth).toHaveBeenCalledWith("super_admin");
      expect(mocks.rpc).toHaveBeenCalledWith("save_b2c_tuition_package_amounts", {
        p_enrollment_id: enrollment,
        p_sessions: 24,
        p_unit_price: 120000,
        p_discount: 100000,
        p_discount_reason: "Ưu đãi",
        p_total_due: null,
        p_reason: "",
        p_expected_due: null,
        p_expected_paid: 0,
      });
      expect(mocks.revalidate).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["0", "2500000"])(
    "passes manual total %s to storage without altering the component amounts",
    async (total) => {
      expect(
        await saveB2CTuitionPackageAction({}, form({ total_due_override: total })),
      ).toHaveProperty("success");
      expect(mocks.rpc).toHaveBeenCalledWith(
        "save_b2c_tuition_package_amounts",
        expect.objectContaining({
          p_sessions: 24,
          p_unit_price: 120000,
          p_discount: 100000,
          p_total_due: Number(total),
        }),
      );
    },
  );

  it.each(["-1", "1.5", "NaN", "Infinity", "1000000000001", "abc", " "])(
    "rejects invalid total %s before RPC",
    async (total) => {
      expect(
        await saveB2CTuitionPackageAction({}, form({ total_due_override: total })),
      ).toHaveProperty("fieldErrors.total_due_override");
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.revalidate).not.toHaveBeenCalled();
    },
  );

  it("preserves snapshot and reason inputs while editing with a manual total", async () => {
    expect(
      await saveB2CTuitionPackageAction({}, form({
        total_due_override: "2500000",
        adjustment_reason: "Điều chỉnh học phí",
        expected_due: "2780000",
        expected_paid: "1000000",
      })),
    ).toHaveProperty("success");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "save_b2c_tuition_package_amounts",
      expect.objectContaining({
        p_total_due: 2500000,
        p_reason: "Điều chỉnh học phí",
        p_expected_due: 2780000,
        p_expected_paid: 1000000,
      }),
    );
  });

  it("does not reach RPC when server authorization fails", async () => {
    mocks.auth.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(saveB2CTuitionPackageAction({}, form())).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("does not report success or refresh when the database refuses the write", async () => {
    mocks.rpc.mockRejectedValue(new Error("Số dư đã thay đổi. Vui lòng tải lại."));
    expect(await saveB2CTuitionPackageAction({}, form())).toEqual({
      error: "Số dư đã thay đổi. Vui lòng tải lại.",
    });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
});
