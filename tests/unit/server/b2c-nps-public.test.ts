import { beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/features/b2c/server/nps-public", () => ({ npsPublicRpc: rpc }));
import { submitPublicNpsAction } from "@/features/b2c/server/nps-public-actions";
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue(undefined); });
function form(score?: string) { const f = new FormData(); for (const [k, v] of Object.entries({ token: "a".repeat(64), request_id: "17600000-0000-4000-8000-000000000060", reason: "", teacher_feedback: "", service_feedback: "" })) f.set(k, v); if (score !== undefined) f.set("score", score); return f; }
it("rejects a missing score without calling the anonymous RPC", async () => {
  expect(await submitPublicNpsAction(form())).toHaveProperty("error"); expect(rpc).not.toHaveBeenCalled();
});
it("submits explicit zero and separates the secret token from stored response data", async () => {
  expect(await submitPublicNpsAction(form("0"))).toEqual({ success: true });
  expect(rpc).toHaveBeenCalledWith("submit_public_b2c_nps", { p_token: "a".repeat(64), p_data: { request_id: "17600000-0000-4000-8000-000000000060", score: 0, reason: "", teacher_feedback: "", service_feedback: "" } });
});
