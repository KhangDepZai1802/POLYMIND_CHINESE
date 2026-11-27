import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  manager: vi.fn(), teaching: vi.fn(), rpc: vi.fn(), rawRpc: vi.fn(), readClass: vi.fn(),
  classes: vi.fn(), permissions: vi.fn(), notFound: vi.fn(), redirect: vi.fn(), role: vi.fn(),
  studentDashboard: vi.fn(), enrollment: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireManager: mocks.manager, requireTeaching: mocks.teaching, requireRole: mocks.role }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({
  from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.readClass }) }) }),
  rpc: mocks.rawRpc,
}) }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: mocks.rpc }));
vi.mock("@/features/b2c/server/teacher-class-queries", () => ({ getMyB2CClasses: mocks.classes }));
vi.mock("@/features/b2c/server/permission-actions", () => ({ getMyB2CPermissionsAction: mocks.permissions }));
vi.mock("@/features/b2c/components/class-workspace-content", () => ({ ClassWorkspaceContent: () => null }));
vi.mock("@/features/dashboard/server/student-queries", () => ({ getStudentDashboard: mocks.studentDashboard }));
vi.mock("@/features/student/server/queries", () => ({
  getMyEnrollment: mocks.enrollment,
  getMyClassOverview: vi.fn(), getMyAttendanceSummary: vi.fn(), getMyMaterials: vi.fn(),
  getMyProgress: vi.fn(), getMySchedule: vi.fn(),
}));
vi.mock("@/features/assessment-results/server/overview", () => ({ getStudentAssessmentOverview: vi.fn() }));

import { readClassWorkspaceAction } from "@/features/b2c/server/class-workspace-read";
import { readTeacherWorkspaceAction } from "@/features/b2c/server/teacher-management-actions";
import TeacherB2CClassPage from "@/app/(dashboard)/teacher/b2c-classes/[classId]/page";
import StudentDashboardPage from "@/app/(dashboard)/student/page";
import StudentClassPage from "@/app/(dashboard)/student/class/page";
import { classFiltersSchema } from "@/features/b2c/domain/class-workspace";
import { toggleB2CPermission } from "@/features/b2c/domain/teacher-permissions";

const classId = "11111111-1111-4111-8111-111111111111";
const otherClassId = "22222222-2222-4222-8222-222222222222";
const cls = {
  id: classId, code: "B2C-TEST", name: "Lớp thử", program_slug: "tieng-trung", teacher_name: "Giáo viên thử",
  weekdays_text: null, time_text: null, capacity: 15, enrolled_count: 2, start_date: null, end_date: null,
  campus: null, delivery_mode: "offline", notes: null,
};
const homeworkPage = {
  class: cls, schedules: [], rows: [{ id: "homework-record", title: "Bài đọc" }], total: 1,
  classes: [cls], server_now: "2026-11-27T10:00:00.000Z", linked_student: null,
};
function teacherPage(classValue = classId, query: Record<string, string> = { tab: "homework" }) {
  return TeacherB2CClassPage({ params: Promise.resolve({ classId: classValue }), searchParams: Promise.resolve(query) });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.manager.mockResolvedValue({ fullName: "Admin" });
  mocks.teaching.mockResolvedValue({ fullName: "Teacher" });
  mocks.readClass.mockResolvedValue({ data: cls, error: null });
  mocks.rpc.mockResolvedValue(homeworkPage);
  mocks.classes.mockResolvedValue([cls]);
  mocks.permissions.mockResolvedValue(["view_classes", "view_students", "view_assessments"]);
  mocks.role.mockResolvedValue({ role: "student", fullName: "Học viên thử" });
  mocks.studentDashboard.mockResolvedValue({ enrollment: null });
  mocks.enrollment.mockResolvedValue(null);
  mocks.notFound.mockImplementation(() => { throw new Error("NEXT_NOT_FOUND"); });
  mocks.redirect.mockImplementation((destination: string) => { throw new Error(`NEXT_REDIRECT:${destination}`); });
});

describe("student landing B2C account integration", () => {
  const page = StudentDashboardPage;

  it("redirects a linked B2C-only student to their homework portal", async () => {
    mocks.rpc.mockResolvedValue({ ...homeworkPage, linked_student: { id: classId, full_name: "Học viên thử" } });
    await expect(page()).rejects.toThrow("NEXT_REDIRECT:/student/b2c-homework");
    expect(mocks.role).toHaveBeenCalledWith("student");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("read_b2c_homework_page", { p_class_id: null, p_page: 0 });
    expect(mocks.redirect).toHaveBeenCalledExactlyOnceWith("/student/b2c-homework");
  });

  it("keeps the existing unassigned view for an account without a B2C link", async () => {
    expect(await page()).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("does not hide a failed B2C account lookup behind an unassigned state", async () => {
    mocks.rpc.mockRejectedValue(new Error("Không tải được bài tập B2C."));
    await expect(page()).rejects.toThrow("Không tải được bài tập B2C.");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("student class B2C account integration", () => {
  it("renders the linked B2C class in Lớp của tôi", async () => {
    mocks.rpc.mockResolvedValue({
      ...homeworkPage,
      linked_student: { id: classId, full_name: "Học viên thử" },
    });

    expect(await StudentClassPage()).toBeTruthy();
    expect(mocks.role).toHaveBeenCalledWith("student");
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith(
      "read_b2c_homework_page",
      { p_class_id: null, p_page: 0 },
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("keeps the existing unassigned view for an account without a B2C link", async () => {
    expect(await StudentClassPage()).toBeTruthy();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("does not hide a failed B2C account lookup behind an unassigned state", async () => {
    mocks.rpc.mockRejectedValue(new Error("Không tải được bài tập B2C."));
    await expect(StudentClassPage()).rejects.toThrow("Không tải được bài tập B2C.");
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});

describe("B2C homework class workspace integration", () => {
  it("uses the homework permission projection without calling the legacy workspace with an unsupported tab", async () => {
    const result = await readTeacherWorkspaceAction(classId, { tab: "homework", page: "2" });
    expect(mocks.teaching).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("read_b2c_homework_page", { p_class_id: classId, p_page: 0 });
    expect(result.cls).toEqual(cls);
    expect(result.schedules).toEqual([]);
    expect(result.filters.tab).toBe("homework");
    // The child panel pages its own assignments. Shared roster rendering must
    // never receive assignment rows in place of student enrollment records.
    expect(result.result.rows).toEqual([]);
    expect(result.result.total).toBe(0);
    expect(result.base).toBe(`/teacher/b2c-classes/${classId}`);
    expect(mocks.rawRpc).not.toHaveBeenCalled();
  });

  it("prepares the admin workspace without querying unsupported homework through the legacy roster RPC", async () => {
    const result = await readClassWorkspaceAction(classId, { tab: "homework" });
    expect(mocks.manager).toHaveBeenCalledExactlyOnceWith();
    expect(result.cls).toEqual(cls);
    expect(result.result).toEqual({ rows: [], total: 0, stats: null });
    expect(mocks.rawRpc).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("propagates a revoked homework permission without falling back to student roster access", async () => {
    mocks.rpc.mockRejectedValue(new Error("Không có quyền xem bài tập lớp này."));
    await expect(readTeacherWorkspaceAction(classId, { tab: "homework" })).rejects.toThrow("Không có quyền xem bài tập lớp này.");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.rawRpc).not.toHaveBeenCalled();
  });

  it.each([readClassWorkspaceAction, readTeacherWorkspaceAction])("rejects unauthenticated access before retrieving class or homework", async (read) => {
    mocks.manager.mockRejectedValue(new Error("NEXT_REDIRECT"));
    mocks.teaching.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(read(classId, { tab: "homework" })).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.readClass).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("validates the tab and class identifier before reaching the reader", async () => {
    expect(classFiltersSchema.parse({ tab: "homework" }).tab).toBe("homework");
    await expect(readTeacherWorkspaceAction("invalid", { tab: "homework" })).rejects.toThrow();
    await expect(readTeacherWorkspaceAction(classId, { tab: "homework_admin" })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("B2C homework teacher route and permission dependencies", () => {
  it("opens homework for an assigned teacher with viewing permission but no write permission", async () => {
    expect(await teacherPage()).toBeTruthy();
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("read_b2c_homework_page", { p_class_id: classId, p_page: 0 });
  });

  it("rejects a direct homework URL when only student-roster permission exists", async () => {
    mocks.permissions.mockResolvedValue(["view_classes", "view_students"]);
    await expect(teacherPage()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects another class before requesting homework", async () => {
    await expect(teacherPage(otherClassId)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a homework route if authorization fails before class enumeration", async () => {
    mocks.teaching.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(teacherPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.classes).not.toHaveBeenCalled();
    expect(mocks.permissions).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires view-class and roster prerequisites when granting homework management", () => {
    expect(toggleB2CPermission([], "grade_assessments", true)).toEqual(expect.arrayContaining(["view_classes", "view_students", "view_assessments", "grade_assessments"]));
    expect(toggleB2CPermission(["view_classes", "view_students", "view_assessments", "grade_assessments"], "view_assessments", false)).not.toContain("grade_assessments");
  });
});
