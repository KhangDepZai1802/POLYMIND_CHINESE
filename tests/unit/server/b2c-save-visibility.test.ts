import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  permissionRpc: vi.fn(),
  revalidate: vi.fn(),
  auth: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/lib/auth/session", () => ({
  requireTeaching: mocks.auth,
  requireManager: mocks.auth,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/features/b2c/server/permission-rpc", () => ({
  permissionRpc: mocks.permissionRpc,
}));

import {
  saveClassMeetingAction,
  saveClassAttendanceAction,
  addClassCommentAction,
} from "@/features/b2c/server/class-workspace-actions";
import { saveTeacherStudentAction } from "@/features/b2c/server/teacher-management-actions";
import { saveMonthlyCommentAction } from "@/features/b2c/server/monthly-comment-actions";
import { saveB2CAssessmentAction } from "@/features/b2c/server/assessment-actions";
import {
  saveB2CTuitionPackageAction,
  recordB2CReceiptAction,
} from "@/features/b2c/server/tuition-actions";
import {
  recordTeachingCheckpoint,
  prepareWeeklyCheckin,
} from "@/features/b2c/server/teaching-actions";
import { generateB2CScheduleAction } from "@/features/b2c/server/schedule-actions";

const id = "11111111-1111-4111-8111-111111111111";
const base = { class_id: id, request_id: id };
function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
const cases: [string, () => Promise<unknown>][] = [
  [
    "điểm danh",
    () =>
      saveClassAttendanceAction({
        ...base,
        meeting_id: id,
        enrollment_id: id,
        status: "present",
        note: "",
        expected_updated_at: null,
      }),
  ],
  [
    "nhận xét",
    () =>
      addClassCommentAction({
        ...base,
        enrollment_id: id,
        meeting_id: null,
        content: "Đã tiến bộ",
      }),
  ],
  [
    "buổi học",
    () =>
      saveClassMeetingAction({
        ...base,
        date: "2026-10-21",
        start_time: "18:00",
        end_time: "19:30",
        teacher_name: "TEST",
        status: "planned",
        note: "",
      }),
  ],
  [
    "hồ sơ học viên",
    () =>
      saveTeacherStudentAction(id, id, {
        full_name: "TEST STUDENT",
        phone: "",
        status: "studying",
        withdrawal_reason: "",
        enrollment_date: "2026-10-01",
        updated_at: "2026-10-21T00:00:00Z",
        student_updated_at: "2026-10-21T00:00:00Z",
      }),
  ],
  [
    "nhận xét tháng nháp",
    () =>
      saveMonthlyCommentAction({
        ...base,
        enrollment_id: id,
        month: "2026-10",
        expected_updated_at: null,
        status: "draft",
        content: {
          attendance: "Có mặt",
          attitude: "",
          learning: "",
          strengths: "",
          improvements: "",
          next_plan: "",
        },
      }),
  ],
  [
    "điểm kiểm tra",
    () =>
      saveB2CAssessmentAction("result", {
        ...base,
        exam_id: id,
        enrollment_id: id,
        expected_updated_at: null,
        score: 8,
        feedback: "Tốt",
        reason: "",
      }),
  ],
  [
    "gói học phí",
    () =>
      saveB2CTuitionPackageAction(
        {},
        form({
          enrollment_id: id,
          sessions: "10",
          unit_price: "100000",
          discount: "0",
          discount_reason: "",
        }),
      ),
  ],
  [
    "phiếu thu",
    () =>
      recordB2CReceiptAction(
        {},
        form({
          package_id: id,
          request_id: id,
          paid_date: "2026-10-21",
          amount: "100000",
          method: "cash",
          collector_name: "TEST",
        }),
      ),
  ],
  [
    "chấm công",
    () =>
      recordTeachingCheckpoint({
        id,
        kind: "in",
        photo: `${id}/test/in/photo.jpg`,
      }),
  ],
  ["mở buổi theo lịch tuần", () => prepareWeeklyCheckin(id)],
  [
    "sinh lịch",
    () =>
      generateB2CScheduleAction({
        ...base,
        weekdays: [3],
        start_time: "18:00",
        end_time: "19:00",
        date_from: "2026-10-21",
        date_to: "2026-10-21",
        room_name: "",
      }),
  ],
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id, fullName: "TEST TEACHER" });
  mocks.rpc.mockResolvedValue({
    data: { created: 1, skipped: 0, retry: false },
    error: null,
  });
  mocks.permissionRpc.mockResolvedValue(id);
});

describe("giáo viên lưu thì admin đọc lại dữ liệu mới", () => {
  it.each(cases)(
    "%s làm mới cả admin và giáo viên khi lưu thành công",
    async (_name, save) => {
      const result = await save();
      expect(result).not.toHaveProperty("error");
      expect(mocks.revalidate).toHaveBeenCalledWith("/admin/b2c", "layout");
      expect(mocks.revalidate).toHaveBeenCalledWith("/teacher", "layout");
    },
  );
  it.each(cases)(
    "%s không báo lưu/làm mới khi DB từ chối",
    async (_name, save) => {
      mocks.rpc.mockResolvedValue({
        data: null,
        error: { code: "42501", message: "Forbidden" },
      });
      mocks.permissionRpc.mockRejectedValue(new Error("Forbidden"));
      expect(await save()).toHaveProperty("error");
      expect(mocks.revalidate).not.toHaveBeenCalled();
    },
  );
});
