import { z } from "zod";
export const CLASS_WORKSPACE_PATH = "/admin/b2c/classes";
export const CLASS_TABS = {
  students: "Học viên",
  schedule: "Lịch học",
  attendance: "Điểm danh",
  tuition: "Học phí",
  comments: "Nhận xét",
} as const;
export const MEETING_STATUSES = {
  planned: "Theo lịch",
  completed: "Đã học",
  cancelled: "Đã hủy",
} as const;
export const ATTENDANCE_STATUSES = {
  present: "Có mặt",
  late: "Đi muộn",
  absent: "Vắng",
  excused: "Vắng có phép",
} as const;
export type ClassTab = keyof typeof CLASS_TABS;
export type ClassMeeting = {
  id: string;
  class_id: string;
  teaching_session_id: string | null;
  schedule_id?: string | null;
  room_name?: string;
  starts_at: string;
  ends_at: string;
  teacher_name: string;
  status: keyof typeof MEETING_STATUSES;
  note: string;
  updated_at: string;
};
export type ClassStudent = {
  enrollment_id: string;
  student_id: string;
  student_code: string;
  full_name: string;
  phone: string | null;
  guardian_name: string | null;
  student_status: import("./student-status").B2CStudentStatus;
  enrollment_date: string | null;
  tuition_end_date: string | null;
  registered_sessions: number | null;
  class_name: string;
  attendance_id: string | null;
  attendance_status: keyof typeof ATTENDANCE_STATUSES | null;
  attendance_note: string | null;
  attendance_updated_at: string | null;
  package_id: string | null;
  sessions: number | null;
  unit_price: number | null;
  discount: number | null;
  discount_reason: string | null;
  total_due: number | null;
  paid_amount: number | null;
  balance: number | null;
};
export type ClassComment = {
  id: string;
  student_code: string;
  full_name: string;
  meeting_starts_at: string | null;
  content: string;
  actor_name: string;
  created_at: string;
};
export type ClassWorkspaceResult<T> = {
  rows: T[];
  total: number;
  stats: Record<string, number> | null;
  meeting?: ClassMeeting | null;
};
const base = { class_id: z.uuid(), request_id: z.uuid() };
export const meetingSchema = z
  .object({
    ...base,
    id: z.uuid().optional(),
    date: z.iso.date().refine((v) => v >= "1900-01-01"),
    start_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    teacher_name: z.string().trim().max(200),
    room_name: z.string().trim().max(120).default(""),
    status: z.enum(["planned", "completed", "cancelled"]),
    note: z.string().max(2000),
    expected_updated_at: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const a =
        Number(v.start_time.slice(0, 2)) * 60 + Number(v.start_time.slice(3)),
      b = Number(v.end_time.slice(0, 2)) * 60 + Number(v.end_time.slice(3));
    if (b <= a || b - a > 720)
      ctx.addIssue({
        code: "custom",
        message: "Buổi học cùng ngày, kết thúc sau bắt đầu, tối đa 12 giờ.",
      });
  });
export const attendanceSchema = z.object({
  ...base,
  meeting_id: z.uuid(),
  enrollment_id: z.uuid(),
  status: z.enum(["present", "late", "absent", "excused"]),
  note: z.string().max(1000),
  expected_updated_at: z.string().nullable(),
});
export const commentSchema = z.object({
  ...base,
  enrollment_id: z.uuid(),
  meeting_id: z.uuid().nullable(),
  content: z.string().trim().min(1).max(4000),
});
export const classFiltersSchema = z.object({
  tab: z
    .enum(["students", "schedule", "attendance", "tuition", "comments"])
    .default("students"),
  page: z.coerce.number().int().min(0).max(1000000).default(0),
  q: z.string().trim().max(200).default(""),
  meeting: z.uuid().optional(),
});
