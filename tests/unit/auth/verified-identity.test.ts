import { describe, expect, it, vi } from "vitest";

import { getVerifiedIdentity } from "@/lib/auth/verified-identity";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function createAuth(result: unknown) {
  return {
    getClaims: vi.fn().mockResolvedValue(result),
  } as never;
}

describe("getVerifiedIdentity", () => {
  it("chỉ lấy định danh từ claims đã được SDK xác minh", async () => {
    const auth = createAuth({
      data: {
        claims: {
          sub: USER_ID,
          email: "student@polymind.test",
          user_metadata: { role: "super_admin" },
        },
      },
      error: null,
    });

    await expect(getVerifiedIdentity(auth)).resolves.toEqual({
      id: USER_ID,
      email: "student@polymind.test",
    });
  });

  it.each([
    ["SDK từ chối token", { data: null, error: new Error("invalid jwt") }],
    ["không có dữ liệu", { data: null, error: null }],
    ["thiếu sub", { data: { claims: { email: "a@b.test" } }, error: null }],
    [
      "sub không phải UUID",
      { data: { claims: { sub: "attacker" } }, error: null },
    ],
  ])("fail-closed khi %s", async (_label, result) => {
    await expect(getVerifiedIdentity(createAuth(result))).resolves.toBeNull();
  });

  it("fail-closed khi SDK ném lỗi", async () => {
    const auth = {
      getClaims: vi.fn().mockRejectedValue(new Error("JWKS unavailable")),
    } as never;

    await expect(getVerifiedIdentity(auth)).resolves.toBeNull();
  });
});
