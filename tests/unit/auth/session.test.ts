import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { loadCurrentUser } from "@/lib/auth/session";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function createSupabaseMock({
  claims,
  profile,
}: {
  claims: unknown;
  profile?: unknown;
}) {
  const single = vi
    .fn()
    .mockResolvedValue({ data: profile ?? null, error: null });
  const eq = vi.fn(() => ({ single }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getClaims = vi.fn().mockResolvedValue(claims);

  return { auth: { getClaims }, from, getClaims };
}

describe("loadCurrentUser", () => {
  beforeEach(() => createClient.mockReset());

  it("khóa tài khoản ngay bằng profiles dù JWT vẫn hợp lệ", async () => {
    const supabase = createSupabaseMock({
      claims: {
        data: { claims: { sub: USER_ID, email: "student@polymind.test" } },
        error: null,
      },
      profile: {
        role: "student",
        full_name: "Học viên bị khóa",
        avatar_path: null,
        is_active: false,
      },
    });
    createClient.mockResolvedValue(supabase);

    await expect(loadCurrentUser()).resolves.toBeNull();
    expect(supabase.from).toHaveBeenCalledWith("profiles");
  });

  it("lấy role từ profiles, không tin role hoặc metadata trong JWT", async () => {
    const supabase = createSupabaseMock({
      claims: {
        data: {
          claims: {
            sub: USER_ID,
            email: "student@polymind.test",
            role: "super_admin",
            user_metadata: { role: "super_admin" },
          },
        },
        error: null,
      },
      profile: {
        role: "student",
        full_name: "Học viên A",
        avatar_path: "avatars/student.webp",
        is_active: true,
      },
    });
    createClient.mockResolvedValue(supabase);

    await expect(loadCurrentUser()).resolves.toEqual({
      id: USER_ID,
      email: "student@polymind.test",
      role: "student",
      fullName: "Học viên A",
      avatarPath: "avatars/student.webp",
    });
  });

  it("không query profiles khi token không xác minh được", async () => {
    const supabase = createSupabaseMock({
      claims: { data: null, error: new Error("invalid jwt") },
    });
    createClient.mockResolvedValue(supabase);

    await expect(loadCurrentUser()).resolves.toBeNull();
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
