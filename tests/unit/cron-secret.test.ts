import { describe, expect, it } from "vitest";

import { hasValidCronAuthorization } from "@/lib/security/cron-secret";

describe("hasValidCronAuthorization", () => {
  const secret = "cron-secret-that-is-long-enough";

  it("chỉ chấp nhận Bearer secret khớp hoàn toàn", () => {
    expect(hasValidCronAuthorization(`Bearer ${secret}`, secret)).toBe(true);
  });

  it.each([null, "", "Basic abc", "Bearer wrong", `bearer ${secret}`])(
    "từ chối header thiếu hoặc sai: %s",
    (authorization) => {
      expect(hasValidCronAuthorization(authorization, secret)).toBe(false);
    },
  );
});
