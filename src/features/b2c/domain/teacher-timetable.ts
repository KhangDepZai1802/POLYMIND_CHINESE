import { readWeeklySlots, type WeeklyDay } from "./weekly-schedule";
export type TimetableTeacher = { id: string; full_name: string };
export type TimetableClass = {
  id: string;
  code: string;
  name: string;
  teacher_id: string | null;
  teacher_name: string | null;
  weekdays_text: string | null;
  time_text: string | null;
  campus: string | null;
  status: string;
};
export type TimetableLesson = {
  id: string;
  classId: string;
  code: string;
  name: string;
  teacherKey: string;
  teacherName: string;
  day: WeeklyDay;
  start: string;
  end: string;
  campus: string | null;
  conflict: boolean;
  status: string;
};
export function buildTeacherTimetable(
  classes: TimetableClass[],
  teachers: TimetableTeacher[],
) {
  const options = new Map(teachers.map((t) => [t.id, t.full_name]));
  const normalize = (v: string) => v.trim().toLocaleLowerCase("vi");
  const lessons: TimetableLesson[] = [],
    incomplete: {
      classId: string;
      code: string;
      name: string;
      teacherKey: string;
      teacherName: string;
      reason: string;
    }[] = [];
  for (const cls of classes) {
    if (!["active", "planned"].includes(cls.status)) continue;
    const matches = teachers.filter(
      (t) => normalize(t.full_name) === normalize(cls.teacher_name ?? ""),
    );
    const teacherKey =
      cls.teacher_id ??
      (matches.length === 1
        ? matches[0]!.id
        : matches.length > 1
          ? `unlinked:${cls.id}`
          : cls.teacher_name?.trim()
            ? `name:${normalize(cls.teacher_name)}`
            : "unassigned");
    const teacherName =
      matches.length > 1 && !cls.teacher_id
        ? `${cls.teacher_name?.trim()} · chưa xác định hồ sơ (${cls.code})`
        : (options.get(teacherKey) ?? cls.teacher_name?.trim()) ||
          "Chưa phân công";
    options.set(teacherKey, teacherName || "Chưa phân công");
    const slots = readWeeklySlots(cls.weekdays_text, cls.time_text);
    const valid = slots.filter(
      (s) =>
        /^([01]\d|2[0-3]):[0-5]\d$/.test(s.start_time) &&
        /^([01]\d|2[0-3]):[0-5]\d$/.test(s.end_time) &&
        s.end_time > s.start_time,
    );
    if (
      !slots.length ||
      valid.length !== slots.length ||
      teacherKey === "unassigned" ||
      teacherKey.startsWith("unlinked:")
    )
      incomplete.push({
        classId: cls.id,
        code: cls.code,
        name: cls.name,
        teacherKey,
        teacherName,
        reason: teacherKey.startsWith("unlinked:")
          ? "Tên giáo viên trùng nhiều hồ sơ; cần xác định giáo viên phụ trách"
          : teacherKey === "unassigned"
            ? "Chưa phân công giáo viên"
            : !slots.length
              ? "Chưa nhập thứ học"
              : "Chưa đủ giờ hợp lệ cho từng thứ",
      });
    for (const slot of valid)
      lessons.push({
        id: `${cls.id}:${slot.day}`,
        classId: cls.id,
        code: cls.code,
        name: cls.name,
        teacherKey,
        teacherName,
        day: slot.day,
        start: slot.start_time,
        end: slot.end_time,
        campus: cls.campus,
        conflict: false,
        status: cls.status,
      });
  }
  for (let i = 0; i < lessons.length; i++)
    for (let j = i + 1; j < lessons.length; j++) {
      const a = lessons[i]!,
        b = lessons[j]!;
      if (
        a.teacherKey !== "unassigned" &&
        a.teacherKey === b.teacherKey &&
        a.day === b.day &&
        a.start < b.end &&
        b.start < a.end
      ) {
        a.conflict = true;
        b.conflict = true;
      }
    }
  return {
    lessons: lessons.sort(
      (a, b) => a.start.localeCompare(b.start) || a.code.localeCompare(b.code),
    ),
    incomplete,
    teachers: [...options]
      .map(([id, full_name]) => ({ id, full_name }))
      .sort((a, b) => a.full_name.localeCompare(b.full_name, "vi")),
  };
}
