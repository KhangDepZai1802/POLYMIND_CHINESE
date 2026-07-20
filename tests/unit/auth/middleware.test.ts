// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";

const { createServerClient } = vi.hoisted(() => ({
  createServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient }));
vi.mock("@/lib/env", () => ({
  getPublicEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
  }),
}));

import { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function createSupabaseMock(claims: unknown) {
  const getClaims = vi.fn().mockResolvedValue(claims);
  const getUser = vi.fn();
  const from = vi.fn();

  return {
    auth: { getClaims, getUser, signOut: vi.fn() },
    from,
    getClaims,
    getUser,
  };
}

describe("updateSession JWT verification", () => {
  beforeEach(() => createServerClient.mockReset());

  it("dùng getClaims thay vì gọi Auth server bằng getUser", async () => {
    const supabase = createSupabaseMock({
      data: { claims: { sub: USER_ID, email: "admin@polymind.test" } },
      error: null,
    });
    createServerClient.mockReturnValue(supabase);

    const response = await updateSession(
      new NextRequest("https://polymind.test/admin"),
    );

    expect(response.status).toBe(200);
    expect(supabase.getClaims).toHaveBeenCalledOnce();
    expect(supabase.getUser).not.toHaveBeenCalled();
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("redirect route bảo vệ khi claims bị từ chối", async () => {
    const supabase = createSupabaseMock({
      data: null,
      error: new Error("invalid jwt"),
    });
    createServerClient.mockReturnValue(supabase);

    const response = await updateSession(
      new NextRequest("https://polymind.test/admin/students"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://polymind.test/login?next=%2Fadmin%2Fstudents",
    );
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
