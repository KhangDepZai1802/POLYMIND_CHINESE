import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ manager: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireManager: mocks.manager }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: mocks.rpc }));
import { exportCertificateMarketingAction } from "@/features/b2c/server/certificate-actions";
beforeEach(() => { vi.clearAllMocks(); mocks.manager.mockResolvedValue({ role: "academic_manager" }); });
it("forces explicit marketing selection and active data then removes internal fields", async () => {
  mocks.rpc.mockResolvedValue({ total: 1, rows: [{ student_code: "HV1", full_name: "An", certificate_type: "IELTS", level: "Academic", score: "6.5", exam_date: "2026-10-17", phone: "0901234567", email: "private@example.test", notes: "PRIVATE", marketing_note: "INTERNAL" }] });
  const result = await exportCertificateMarketingAction({ query: "An", marketing: "no", archived: true, page: 99 });
  expect(mocks.rpc).toHaveBeenCalledWith("read_b2c_certificate_results", expect.objectContaining({ p_limit: 5000, p_filters: expect.objectContaining({ query: "An", marketing: "yes", archived: false, page: 0 }) }));
  expect(result.rows?.[0]).toEqual({ student_code: "HV1", full_name: "An", certificate_type: "IELTS", level: "Academic", score: "6.5", exam_date: "2026-10-17" });
});
it("refuses to silently truncate a large marketing export", async () => {
  mocks.rpc.mockResolvedValue({ total: 5001, rows: [] });
  const result = await exportCertificateMarketingAction({});
  expect(result.error).toContain("5.000"); expect(result.rows).toBeUndefined();
});
it("requires a manager before reading export data", async () => {
  mocks.manager.mockRejectedValue(new Error("Forbidden"));
  await expect(exportCertificateMarketingAction({})).rejects.toThrow("Forbidden");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
