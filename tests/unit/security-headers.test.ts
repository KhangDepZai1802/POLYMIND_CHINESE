import { describe, expect, it } from "vitest";

import nextConfig from "../../next.config";

describe("security headers", () => {
  it("cho phép chính website dùng micro nhưng vẫn chặn camera và vị trí", async () => {
    const headers = await nextConfig.headers?.();
    const policy = headers?.[0]?.headers.find(
      (header) => header.key === "Permissions-Policy",
    )?.value;

    expect(policy).toContain("microphone=(self)");
    expect(policy).toContain("camera=()");
    expect(policy).toContain("geolocation=()");
    expect(policy).not.toContain("microphone=()");
  });
});
