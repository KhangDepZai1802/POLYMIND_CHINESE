import { describe, expect, it } from "vitest";
import {
  buildTodayTasks,
  vietnamDate,
  type TodayTaskData,
} from "@/features/b2c/domain/today-tasks";

const now = new Date("2026-10-16T03:00:00Z");
function fixture(): TodayTaskData {
  return {
    leads: [
      {
        id: "lead",
        full_name: "An",
        phone: "0900000000",
        stage: "consulted",
        salesperson: "Lan",
      },
    ],
    care: [
      {
        id: "log",
        lead_id: "lead",
        created_at: "2026-10-15T00:00:00Z",
        next_followup_date: "2026-10-16",
      },
    ],
    classes: [
      {
        id: "class",
        code: "A1",
        name: "Lớp A1",
        status: "active",
        end_date: "2026-10-30",
      },
    ],
    students: [{ id: "student", code: "HV01", full_name: "Bình" }],
    enrollments: [
      {
        id: "enrollment",
        student_id: "student",
        class_id: "class",
        status: "studying",
        tuition_end_date: "2026-10-16",
        learning_start_date: "2026-10-01",
        enrollment_date: "2026-09-30",
      },
    ],
    meetings: [
      {
        id: "meeting",
        class_id: "class",
        starts_at: "2026-10-15T01:00:00Z",
        ends_at: "2026-10-15T03:00:00Z",
        status: "completed",
      },
    ],
    attendance: [],
  };
}

describe("today tasks", () => {
  it("includes only B2C groups and links", () => {
    const tasks = buildTodayTasks(fixture(), now);
    expect(new Set(tasks.map((t) => t.group)).size).toBe(4);
    expect(tasks.find((t) => t.group === "attendance")?.href).toContain(
      "tab=attendance&meeting=meeting",
    );
    expect(tasks.find((t) => t.group === "tuition")?.href).toContain("q=HV01");
    expect(
      tasks.every((t) => t.scope === "B2C" && t.href.startsWith("/admin/b2c/")),
    ).toBe(true);
    expect(tasks[0]!.date).toBe("2026-10-15");
  });
  it("uses Vietnam midnight rather than server UTC dates", () => {
    expect(vietnamDate("2026-10-15T18:00:00Z")).toBe("2026-10-16");
    const data = fixture();
    data.care[0]!.next_followup_date = "2026-10-16";
    expect(
      buildTodayTasks(data, new Date("2026-10-15T18:00:00Z")).some(
        (t) => t.group === "callback",
      ),
    ).toBe(true);
  });
  it("clears an old callback when the latest saved contact has no next appointment", () => {
    const data = fixture();
    data.care.push({
      ...data.care[0]!,
      id: "new",
      created_at: "2026-10-16T00:00:00Z",
      next_followup_date: null,
    });
    expect(buildTodayTasks(data, now).some((t) => t.group === "callback")).toBe(
      false,
    );
  });
  it.each(["enrolled", "lost"])(
    "excludes closed admission stage %s",
    (stage) => {
      const data = fixture();
      data.leads[0]!.stage = stage;
      expect(
        buildTodayTasks(data, now).some((t) => t.group === "callback"),
      ).toBe(false);
    },
  );
  it("excludes future appointments, future/ cancelled meetings", () => {
    const data = fixture();
    data.care[0]!.next_followup_date = "2026-10-17";
    data.meetings[0]!.status = "cancelled";
    expect(buildTodayTasks(data, now).map((t) => t.group)).toEqual([
      "tuition",
      "ending",
    ]);
    data.meetings[0]!.status = "planned";
    data.meetings[0]!.ends_at = "2026-10-16T04:00:00Z";
    expect(
      buildTodayTasks(data, now).some((t) => t.group === "attendance"),
    ).toBe(false);
  });
  it("removes completed attendance; duplicate marks do not hide missing students", () => {
    const data = fixture();
    data.attendance.push({
      meeting_id: "meeting",
      enrollment_id: "enrollment",
    });
    expect(
      buildTodayTasks(data, now).some((t) => t.group === "attendance"),
    ).toBe(false);
    data.enrollments.push({ ...data.enrollments[0]!, id: "other" });
    data.attendance.push({ ...data.attendance[0]! });
    expect(
      buildTodayTasks(data, now).find((t) => t.group === "attendance")?.detail,
    ).toContain("1/2");
  });
  it("does not count students who started after the meeting or withdrawn enrollments", () => {
    const data = fixture();
    data.enrollments[0]!.learning_start_date = "2026-10-16";
    expect(
      buildTodayTasks(data, now).some((t) => t.group === "attendance"),
    ).toBe(false);
    data.enrollments[0]!.status = "withdrawn";
    expect(buildTodayTasks(data, now).some((t) => t.group === "tuition")).toBe(
      false,
    );
  });
  it("uses explicit class end dates and an inclusive fourteen-day horizon", () => {
    const data = fixture();
    expect(buildTodayTasks(data, now).some((t) => t.group === "ending")).toBe(
      true,
    );
    for (const date of [null, "2026-10-31", "2026-10-15"]) {
      data.classes[0]!.end_date = date;
      expect(buildTodayTasks(data, now).some((t) => t.group === "ending")).toBe(
        false,
      );
    }
  });
});
