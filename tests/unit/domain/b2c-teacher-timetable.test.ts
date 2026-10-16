import { describe, expect, it } from "vitest";
import {
  buildTeacherTimetable,
  type TimetableClass,
} from "@/features/b2c/domain/teacher-timetable";
const teacher = { id: "teacher-a", full_name: "Cô Tú" };
const cls: TimetableClass = {
  id: "class-a",
  code: "B2C-1",
  name: "Teen 3",
  teacher_id: teacher.id,
  teacher_name: "Cô Tú",
  weekdays_text: "T4-T6",
  time_text: "T4 19:30–21:00; T6 18:00–19:30",
  campus: null,
  status: "active",
};
describe("B2C teacher timetable", () => {
  it("uses each weekday's hours without making dated sessions", () => {
    const result = buildTeacherTimetable([cls], [teacher]);
    expect(result.lessons.map((l) => [l.day, l.start, l.end])).toEqual([
      ["T6", "18:00", "19:30"],
      ["T4", "19:30", "21:00"],
    ]);
    expect(
      result.lessons.every(
        (l) =>
          l.classId === "class-a" && l.teacherKey === teacher.id && !l.conflict,
      ),
    ).toBe(true);
  });
  it("flags overlapping classes of the same teacher and weekday", () => {
    const other = {
      ...cls,
      id: "class-b",
      code: "B2C-2",
      time_text: "19:45–20:30",
      weekdays_text: "T4",
    };
    const result = buildTeacherTimetable([cls, other], [teacher]);
    expect(result.lessons.filter((l) => l.conflict).map((l) => l.day)).toEqual([
      "T4",
      "T4",
    ]);
  });
  it("does not flag consecutive times or another teacher", () => {
    const other = {
      ...cls,
      id: "class-b",
      code: "B2C-2",
      time_text: "21:00–22:00",
      weekdays_text: "T4",
    };
    expect(
      buildTeacherTimetable([cls, other], [teacher]).lessons.some(
        (l) => l.conflict,
      ),
    ).toBe(false);
    expect(
      buildTeacherTimetable(
        [cls, { ...other, teacher_id: "teacher-b", time_text: "19:45–20:30" }],
        [teacher],
      ).lessons.some((l) => l.conflict),
    ).toBe(false);
  });
  it("keeps incomplete classes visible and excludes inactive classes", () => {
    const result = buildTeacherTimetable(
      [
        { ...cls, weekdays_text: null },
        { ...cls, id: "paused", status: "paused" },
      ],
      [teacher],
    );
    expect(result.lessons).toEqual([]);
    expect(result.incomplete).toHaveLength(1);
    expect(result.incomplete[0]?.classId).toBe(cls.id);
  });
  it("matches a legacy name only when the teacher profile is unique", () => {
    expect(
      buildTeacherTimetable([{ ...cls, teacher_id: null }], [teacher])
        .lessons[0]?.teacherKey,
    ).toBe(teacher.id);
    const result = buildTeacherTimetable(
      [{ ...cls, teacher_id: null }],
      [teacher, { id: "teacher-b", full_name: "Cô Tú" }],
    );
    expect(result.lessons[0]?.teacherKey).toBe("unlinked:class-a");
    expect(result.incomplete[0]?.reason).toContain("trùng");
  });
  it("does not report a teacher conflict for unassigned classes", () => {
    const noTeacher = { ...cls, teacher_id: null, teacher_name: null };
    const result = buildTeacherTimetable(
      [noTeacher, { ...noTeacher, id: "other" }],
      [],
    );
    expect(
      result.lessons.every(
        (l) => !l.conflict && l.teacherName === "Chưa phân công",
      ),
    ).toBe(true);
  });
});
