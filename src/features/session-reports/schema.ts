import { z } from "zod";

import {
  EVIDENCE_KINDS,
  HOMEWORK_COMPLETIONS,
  ISSUE_CATEGORIES,
  ISSUE_IMPACTS,
  ISSUE_SEVERITIES,
  OVERALL_RATINGS,
  PLAN_COMPLETIONS,
  SESSION_REPORT_MODES,
  STUDENT_CATEGORIES,
} from "./domain/labels";
import type { SessionReportForm } from "./domain/completion";

/**
 * Zod cho payload biểu mẫu báo cáo.
 *
 * Danh sách giá trị hợp lệ suy THẲNG từ `domain/labels.ts` — gõ lại ở đây là
 * có ngày thêm một nhóm vấn đề vào labels mà quên thêm vào Zod, rồi lựa chọn
 * mới im lặng bị loại ở server. Bảng `session_reports` cũng có CHECK constraint
 * cùng danh sách; ba tầng cùng một nguồn.
 */

function valuesOf<T extends readonly { readonly value: string }[]>(options: T) {
  return options.map((option) => option.value) as [string, ...string[]];
}

const trimmed = (max: number) => z.string().trim().max(max).default("");

export const sessionReportFormSchema = z.object({
  // Mục 1
  mode: z.enum(valuesOf(SESSION_REPORT_MODES)).nullable().default(null),
  topic: trimmed(500),

  // Mục 3
  //
  // `lesson_title` là chữ giáo viên TỰ GÕ (`TEACHER-REPORT-2`), không tra bảng
  // `lessons`. Bản đầu bắt chọn từ giáo trình nên khoá chưa nhập giáo trình là
  // mục 3 không bao giờ xong được và nút Gửi bị chặn vĩnh viễn.
  lesson_title: trimmed(500),
  plan_completion: z.enum(valuesOf(PLAN_COMPLETIONS)).nullable().default(null),
  has_unfinished: z.boolean().default(false),
  unfinished_content: trimmed(2000),
  unfinished_reason: trimmed(2000),
  has_homework: z.boolean().default(false),
  homework_assigned: trimmed(2000),

  // Mục 4 — ba thang 1–5 và một thang phần trăm
  comprehension_level: z.number().int().min(1).max(5).nullable().default(null),
  interaction_level: z.number().int().min(1).max(5).nullable().default(null),
  focus_level: z.number().int().min(1).max(5).nullable().default(null),
  homework_completion: z
    .enum(valuesOf(HOMEWORK_COMPLETIONS))
    .nullable()
    .default(null),

  // Mục 5
  no_students_of_note: z.boolean().default(false),

  // Mục 6
  has_issue: z.boolean().nullable().default(null),
  issue_categories: z.array(z.enum(valuesOf(ISSUE_CATEGORIES))).default([]),
  issue_other: trimmed(500),
  issue_description: trimmed(2000),
  issue_impact: z.enum(valuesOf(ISSUE_IMPACTS)).nullable().default(null),
  issue_severity: z.enum(valuesOf(ISSUE_SEVERITIES)).nullable().default(null),

  // Mục 7
  next_content: trimmed(2000),
  review_content: trimmed(2000),
  teacher_watch_note: trimmed(2000),
  needs_support: z.boolean().default(false),
  support_request: trimmed(2000),

  // Mục 8
  evidence_kinds: z.array(z.enum(valuesOf(EVIDENCE_KINDS))).default([]),

  // Mục 9
  overall_rating: z.enum(valuesOf(OVERALL_RATINGS)).nullable().default(null),
  closing_note: trimmed(3000),

  // XÁC NHẬN
  confirmed: z.boolean().default(false),
});

export const reportStudentSchema = z.object({
  category: z.enum(valuesOf(STUDENT_CATEGORIES)),
  enrollment_id: z.uuid(),
  note: z.string().trim().max(1000).default(""),
});

/**
 * Mục 3 có ba ô sống ở `class_sessions` chứ không ở bảng báo cáo (`D-43` điểm
 * 1). Chúng đi cùng payload nhưng được ghi bằng `save_session_log()`.
 */
export const sessionLogPartSchema = z.object({
  lesson_id: z.uuid().nullable().default(null),
  lesson_log: z.string().trim().max(5000).default(""),
  teacher_note: z.string().trim().max(2000).default(""),
});

export const saveSessionReportSchema = z.object({
  session_id: z.uuid("Buổi học không hợp lệ."),
  form: sessionReportFormSchema,
  students: z.array(reportStudentSchema).max(200).default([]),
  log: sessionLogPartSchema,
});

export type SaveSessionReportInput = z.infer<typeof saveSessionReportSchema>;

/**
 * Ép kiểu về `SessionReportForm` của tầng domain.
 *
 * Zod đã kiểm giá trị nằm trong danh sách hợp lệ; `as` ở đây chỉ để hai hình
 * dạng gặp nhau, không phải để bỏ qua kiểm tra.
 */
export function toDomainForm(
  parsed: z.infer<typeof sessionReportFormSchema>,
): SessionReportForm {
  return parsed as SessionReportForm;
}

// --- Bộ lọc của giáo vụ -------------------------------------------------------

export const teacherReportFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  // Dùng đúng hình dạng của `LearningReportFilters` để tab này chia sẻ được
  // `ReportPeriodFilter` và `resolveLearningPeriod` với tab Học tập —
  // `range=all` là cờ tường minh cho "Toàn khóa".
  range: z.literal("all").optional(),
  class: z.uuid().optional(),
  teacher: z.uuid().optional(),
  state: z.enum(["all", "submitted", "missing", "attention"]).optional(),
});

export type TeacherReportFilters = z.infer<typeof teacherReportFilterSchema>;

export function parseTeacherReportFilters(
  params: Record<string, string | string[] | undefined>,
) {
  const single = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  return teacherReportFilterSchema.safeParse({
    from: single("from"),
    to: single("to"),
    range: single("range"),
    class: single("class") || undefined,
    teacher: single("teacher") || undefined,
    state: single("state"),
  });
}

/**
 * Dựng lại query string từ bộ lọc đang chọn.
 *
 * 🔴 Nút xuất file gọi hàm này chứ không tự ghép chuỗi — `BUG_M16_01` ở hệ cũ
 * đúng là ca "export bỏ qua date range đang chọn nên file luôn ra toàn kỳ".
 */
export function teacherReportSearchParams(
  filters: TeacherReportFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.range) params.set("range", filters.range);
  if (filters.class) params.set("class", filters.class);
  if (filters.teacher) params.set("teacher", filters.teacher);
  if (filters.state && filters.state !== "all") params.set("state", filters.state);
  return params;
}
