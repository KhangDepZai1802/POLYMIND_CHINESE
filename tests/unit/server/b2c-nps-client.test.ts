// @vitest-environment node
import { beforeEach, expect, it, vi } from "vitest";
const api = vi.hoisted(() => ({ create: vi.fn(), rpc: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/supabase-js", () => ({ createClient: api.create }));
vi.mock("@/lib/env", () => ({ getPublicEnv: () => ({ NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" }) }));
import { readPublicNps, npsPublicRpc } from "@/features/b2c/server/nps-public";
beforeEach(() => { vi.clearAllMocks(); api.create.mockReturnValue({ rpc: api.rpc }); api.rpc.mockResolvedValue({ data: { state: "open" }, error: null }); });
it("uses a fresh publishable client without session persistence or cookies", async () => {
  await readPublicNps("a".repeat(64));
  expect(api.create).toHaveBeenCalledWith("https://project.supabase.co", "sb_publishable_test", { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  expect(api.rpc).toHaveBeenCalledWith("read_public_b2c_nps", { p_token: "a".repeat(64) });
});
it("rejects malformed tokens without a database request", async () => {
  expect(await readPublicNps("guess")).toEqual({ state: "invalid" }); expect(api.create).not.toHaveBeenCalled();
});
it("does not expose internal database errors to anonymous parents", async () => {
  api.rpc.mockResolvedValue({ data: null, error: { code: "XX000", message: "PRIVATE DATABASE DETAIL" } });
  await expect(npsPublicRpc("read_public_b2c_nps", { p_token: "a".repeat(64) })).rejects.toThrow();
  try { await readPublicNps("a".repeat(64)); } catch (e) { expect(String(e)).not.toContain("PRIVATE DATABASE DETAIL"); }
});
