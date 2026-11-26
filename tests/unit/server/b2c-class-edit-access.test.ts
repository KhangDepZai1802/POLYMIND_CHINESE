import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  identity: vi.fn(),
  profile: vi.fn(),
  rpc: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
  revalidate: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth/verified-identity", () => ({
  getVerifiedIdentity: mocks.identity,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {},
    from: () => ({
      select: () => ({ eq: () => ({ single: mocks.profile }) }),
    }),
    rpc: mocks.rpc,
  }),
}));

// Keep the real session guards and permissionRpc so role rejection is exercised.
import {
  readTeacherClassEditAction,
  readTeacherClassTeacherOptionsAction,
  readTeacherWorkspaceAction,
  saveTeacherClassAction,
} from "@/features/b2c/server/teacher-management-actions";

const classId = "10000000-0000-4000-8000-000000000001";
const teacherId = "20000000-0000-4000-8000-000000000002";
const requestId = "30000000-0000-4000-8000-000000000003";
const updatedAt = "2026-11-26T00:00:00Z";
const classData = {
  name: "Test class",
  program_slug: "tieng-anh",
  capacity: 15,
  campus: "",
  delivery_mode: "offline",
  start_date: "2026-11-01",
  end_date: "2026-12-24",
  status: "active",
  notes: "",
};
const teachers = [{ id: teacherId, full_name: "Test teacher" }];
const savedClass = { ...classData, id: classId, teacher_id: teacherId, updated_at: updatedAt };
const saveInput = {
  id: classId,
  request_id: requestId,
  expected_updated_at: updatedAt,
  teacher_id: teacherId,
  data: classData,
};
const actions = [
  ["read class", () => readTeacherClassEditAction(classId)],
  ["read teacher options", () => readTeacherClassTeacherOptionsAction()],
  ["save class", () => saveTeacherClassAction(saveInput)],
] as const;

function setProfile(role: string, active = true) {
  mocks.profile.mockResolvedValue({
    data: { role, full_name: "Test user", avatar_path: null, is_active: active },
    error: null,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.identity.mockResolvedValue({ id: "test-user", email: "admin@example.test" });
  setProfile("super_admin");
  mocks.rpc.mockImplementation(async (name: string) => ({
    data: name === "read_teacher_b2c_class_edit" ? savedClass
      : name === "read_b2c_class_teacher_options" ? teachers
      : name === "save_teacher_b2c_class" ? classId : null,
    error: null,
  }));
});

describe.each(["super_admin", "academic_manager", "teacher"])("class editor as %s", (role) => {
  beforeEach(() => setProfile(role));

  it("loads the class and teacher options without redirecting", async () => {
    await expect(readTeacherClassEditAction(classId)).resolves.toEqual({ ...savedClass, teachers });
    expect(mocks.rpc).toHaveBeenCalledWith("read_teacher_b2c_class_edit", { p_id: classId });
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("loads teacher options through the permission RPC", async () => {
    await expect(readTeacherClassTeacherOptionsAction()).resolves.toEqual(teachers);
    expect(mocks.rpc).toHaveBeenCalledWith("read_b2c_class_teacher_options", {});
  });

  it("saves with the existing request and stale guard before assigning the teacher", async () => {
    await expect(saveTeacherClassAction(saveInput)).resolves.toEqual({ success: true });
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "save_teacher_b2c_class", {
      p_id: classId, p_request_id: requestId, p_data: classData, p_expected_updated_at: updatedAt,
    });
    expect(mocks.rpc).toHaveBeenNthCalledWith(2, "assign_b2c_class_teacher", {
      p_class_id: classId, p_teacher_id: teacherId,
    });
    expect(mocks.revalidate).toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe.each(["student", "executive", "center_manager", "consultant", "xkld_staff"])("class editor rejects %s", (role) => {
  it.each(actions)("blocks %s before any RPC", async (_name, action) => {
    setProfile(role);
    await expect(action()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("class editor authorization boundaries", () => {
  it.each(actions)("requires login for %s", async (_name, action) => {
    mocks.identity.mockResolvedValue(null);
    await expect(action()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each(actions)("blocks an inactive admin from %s", async (_name, action) => {
    setProfile("super_admin", false);
    await expect(action()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("preserves the database denial for a teacher outside the permitted class", async () => {
    setProfile("teacher");
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Không có quyền sửa lớp." } });
    await expect(readTeacherClassEditAction(classId)).rejects.toThrow("Không có quyền sửa lớp.");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["teacher", "42501", "Không có quyền sửa lớp."],
    ["super_admin", "40001", "Lớp đã thay đổi. Vui lòng tải lại."],
  ])("preserves %s save failure %s without assignment or refresh", async (role, code, message) => {
    setProfile(role);
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message } });
    await expect(saveTeacherClassAction(saveInput)).resolves.toEqual({ error: message });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("keeps the teacher-only workspace guard unchanged for an admin", async () => {
    await expect(readTeacherWorkspaceAction(classId, {})).rejects.toThrow("NEXT_REDIRECT:/admin");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
