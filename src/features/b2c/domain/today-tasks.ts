import type { Database } from "@/types/database";

type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export const TASK_GROUPS = {
  callback: "Cần gọi lại",
  tuition: "Học phí đến hạn",
  ending: "Lớp sắp kết thúc",
  attendance: "Chưa điểm danh đủ",
} as const;
export type TaskGroup = keyof typeof TASK_GROUPS;
export type TodayTask = {
  id: string;
  group: TaskGroup;
  title: string;
  displayName?: string;
  studentCode?: string;
  detail: string;
  date: string;
  href: string;
  action: string;
  scope: "B2C";
  lead?: { id: string; name: string; caretaker: string };
};
export type TodayTaskData = {
  leads: Pick<
    Row<"b2c_admission_leads">,
    "id" | "full_name" | "phone" | "stage" | "salesperson"
  >[];
  care: Pick<
    Row<"b2c_admission_care_logs">,
    "id" | "lead_id" | "created_at" | "next_followup_date"
  >[];
  classes: Pick<
    Row<"b2c_classes">,
    "id" | "code" | "name" | "status" | "end_date"
  >[];
  students: Pick<Row<"b2c_students">, "id" | "code" | "full_name">[];
  enrollments: Pick<
    Row<"b2c_enrollments">,
    | "id"
    | "class_id"
    | "student_id"
    | "status"
    | "tuition_end_date"
    | "learning_start_date"
    | "enrollment_date"
  >[];
  meetings: Pick<
    Row<"b2c_class_meetings">,
    "id" | "class_id" | "starts_at" | "ends_at" | "status"
  >[];
  attendance: Pick<
    Row<"b2c_student_attendance">,
    "meeting_id" | "enrollment_id"
  >[];
};

export function vietnamDate(value: string | Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function buildTodayTasks(
  data: TodayTaskData,
  now = new Date(),
): TodayTask[] {
  const today = vietnamDate(now);
  const horizon = new Date(`${today}T00:00:00+07:00`);
  horizon.setUTCDate(horizon.getUTCDate() + 14);
  const until = vietnamDate(horizon);
  const tasks: TodayTask[] = [];
  const latestCare = new Map<string, TodayTaskData["care"][number]>();
  // A later contact without another appointment clears the previous reminder.
  for (const log of data.care) {
    const old = latestCare.get(log.lead_id);
    if (
      !old ||
      log.created_at > old.created_at ||
      (log.created_at === old.created_at && log.id > old.id)
    )
      latestCare.set(log.lead_id, log);
  }
  for (const lead of data.leads) {
    const date = latestCare.get(lead.id)?.next_followup_date;
    if (!date || date > today || ["enrolled", "lost"].includes(lead.stage))
      continue;
    tasks.push({
      id: `callback:${lead.id}`,
      group: "callback",
      title: lead.full_name,
      detail: `${lead.phone} · ${lead.salesperson || "Chưa có người phụ trách"}`,
      date,
      scope: "B2C",
      href: `/admin/b2c/admissions?view=list&q=${encodeURIComponent(lead.phone)}`,
      action: "Mở tuyển sinh",
      lead: { id: lead.id, name: lead.full_name, caretaker: lead.salesperson },
    });
  }
  const classes = new Map(data.classes.map((c) => [c.id, c]));
  const students = new Map(data.students.map((s) => [s.id, s]));
  const open = data.enrollments.filter(
    (e) => !["withdrawn", "completed", "transferred", "on_hold"].includes(e.status),
  );
  for (const e of open) {
    const cls = classes.get(e.class_id),
      student = students.get(e.student_id);
    if (
      !cls ||
      cls.status !== "active" ||
      !student ||
      !e.tuition_end_date ||
      e.tuition_end_date > today
    )
      continue;
    tasks.push({
      id: `tuition:${e.id}`,
      group: "tuition",
      title: `${student.full_name} · ${student.code}`,
      displayName: student.full_name,
      studentCode: student.code,
      detail: `${cls.code} · Đến hạn gia hạn học phí`,
      date: e.tuition_end_date,
      scope: "B2C",
      href: `/admin/b2c/classes/${cls.id}?tab=tuition&q=${encodeURIComponent(student.code)}`,
      action: "Xử lý học phí",
    });
  }
  for (const cls of data.classes) {
    if (
      cls.status !== "active" ||
      !cls.end_date ||
      cls.end_date < today ||
      cls.end_date > until
    )
      continue;
    tasks.push({
      id: `ending:${cls.id}`,
      group: "ending",
      title: `${cls.code} · ${cls.name}`,
      detail: "Liên hệ học viên, chuẩn bị kết thúc hoặc khóa tiếp theo",
      date: cls.end_date,
      scope: "B2C",
      href: `/admin/b2c/classes/${cls.id}?tab=students`,
      action: "Mở lớp học",
    });
  }
  const marked = new Map<string, Set<string>>();
  for (const a of data.attendance) {
    const ids = marked.get(a.meeting_id) ?? new Set<string>();
    ids.add(a.enrollment_id);
    marked.set(a.meeting_id, ids);
  }
  for (const m of data.meetings) {
    const cls = classes.get(m.class_id);
    if (!cls || m.status === "cancelled" || new Date(m.ends_at) > now) continue;
    const date = vietnamDate(m.starts_at);
    const expected = open.filter(
      (e) =>
        e.class_id === m.class_id &&
        (e.learning_start_date ?? e.enrollment_date ?? "") <= date,
    );
    const missing = expected.filter((e) => !marked.get(m.id)?.has(e.id)).length;
    if (!missing) continue;
    tasks.push({
      id: `attendance:${m.id}`,
      group: "attendance",
      title: `${cls.code} · ${cls.name}`,
      detail: `Còn ${missing}/${expected.length} học viên chưa điểm danh`,
      date,
      scope: "B2C",
      href: `/admin/b2c/classes/${cls.id}?tab=attendance&meeting=${m.id}`,
      action: "Điểm danh",
    });
  }
  return tasks.sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  );
}
