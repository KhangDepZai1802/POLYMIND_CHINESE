import { render, screen } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { B2CTeachingPage } from "@/features/b2c/components/teaching-page";
const mocks = vi.hoisted(() => ({ role: "super_admin", rpc: vi.fn(), signed: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireManager: async () => ({ role: mocks.role }), requireTeaching: async () => ({ role: "teacher" }) }));
vi.mock("@/features/b2c/server/permission-actions", () => ({ getMyB2CPermissionsAction: async () => ["view_pay"] }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: vi.fn() }));
vi.mock("@/features/b2c/components/teaching-dialog", () => ({ TeachingSessionDialog: () => <button>Thêm buổi dạy</button> }));
vi.mock("@/features/b2c/components/teaching-checkpoint", () => ({ TeachingCheckpoint: () => null }));
vi.mock("@/features/b2c/components/teaching-setup", () => ({ TeachingSetup: () => null }));
vi.mock("@/features/b2c/server/teaching-actions", () => ({ archiveTeachingSessionAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: mocks.rpc, storage: { from: () => ({ createSignedUrls: mocks.signed }) }, from: () => { const q = { select: () => q, in: () => q, not: () => q, order: async () => ({ data: [], error: null }) }; return q; } }) }));
beforeEach(() => {
  vi.clearAllMocks(); mocks.role = "super_admin";
  mocks.rpc.mockResolvedValue({ error: null, data: { total: 1, hours: 1.5, salary: 150000, rows: [{ id: "s1", class_name: "Starter Hero", teacher_name: "Cô Lê", starts_at: "2026-10-21T11:00:00Z", ends_at: "2026-10-21T12:30:00Z", hourly_rate: 100000, teaching_hours: 1.5, salary: 150000, check_in_at: "2026-10-21T11:02:00Z", check_out_at: "2026-10-21T12:39:00Z", check_in_photo: "in.jpg", check_out_photo: "out.jpg" }] } });
  mocks.signed.mockResolvedValue({ data: [{ path: "in.jpg", signedUrl: "https://example.test/in" }, { path: "out.jpg", signedUrl: "https://example.test/out" }] });
});
it("lets the administrator delete and shows both checkpoint thumbnails", async () => {
  render(await B2CTeachingPage({ params: { month: "2026-10" }, mine: false }));
  expect(screen.getByRole("button", { name: /Xóa buổi dạy Starter Hero/ })).toBeVisible();
  expect(screen.getAllByRole("img")).toHaveLength(2);
  expect(mocks.signed).toHaveBeenCalledWith(["in.jpg", "out.jpg"], 300);
});
it("does not expose the delete control to an academic manager", async () => {
  mocks.role = "academic_manager";
  render(await B2CTeachingPage({ params: {}, mine: false }));
  expect(screen.queryByRole("button", { name: /Xóa buổi dạy/ })).not.toBeInTheDocument();
});
it("does not expose payroll deletion on the teacher's own page", async () => {
  render(await B2CTeachingPage({ params: {}, mine: true }));
  expect(screen.queryByRole("button", { name: /Xóa buổi dạy/ })).not.toBeInTheDocument();
  expect(screen.getAllByRole("img")).toHaveLength(2);
});
