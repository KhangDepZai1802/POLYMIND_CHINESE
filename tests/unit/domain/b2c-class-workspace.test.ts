import { describe, it, expect } from "vitest";
import {
  meetingSchema,
  attendanceSchema,
  commentSchema,
  classFiltersSchema,
} from "@/features/b2c/domain/class-workspace";
const id = "75000000-0000-4000-8000-000000000001";
const meeting = {
  class_id: id,
  request_id: id,
  date: "2026-10-14",
  start_time: "18:00",
  end_time: "19:30",
  teacher_name: "Cô Tú",
  status: "planned",
  note: "",
};
describe("B2C class workspace inputs", () => {
  it("accepts same-day lessons and rejects invalid times and durations", () => {
    expect(meetingSchema.safeParse(meeting).success).toBe(true);
    for (const p of [
      { end_time: "17:30" },
      { start_time: "05:00", end_time: "18:00" },
      { date: "2026-02-30" },
      { start_time: "25:00" },
    ])
      expect(meetingSchema.safeParse({ ...meeting, ...p }).success).toBe(false);
  });
  it("requires an explicit roll-call value instead of defaulting to present/absent", () => {
    const v = {
      class_id: id,
      request_id: id,
      meeting_id: id,
      enrollment_id: id,
      note: "",
      expected_updated_at: null,
    };
    expect(attendanceSchema.safeParse(v).success).toBe(false);
    expect(
      attendanceSchema.safeParse({ ...v, status: "present" }).success,
    ).toBe(true);
    expect(attendanceSchema.safeParse({ ...v, status: "absent" }).success).toBe(
      true,
    );
  });
  it("allows general feedback or a specified meeting and rejects blank feedback", () => {
    const v = {
      class_id: id,
      request_id: id,
      enrollment_id: id,
      meeting_id: null,
      content: "Có tiến bộ",
    };
    expect(commentSchema.safeParse(v).success).toBe(true);
    expect(commentSchema.safeParse({ ...v, meeting_id: id }).success).toBe(
      true,
    );
    expect(commentSchema.safeParse({ ...v, content: " " }).success).toBe(false);
  });
  it("bounds server pagination and rejects malformed session ids", () => {
    expect(classFiltersSchema.parse({}).tab).toBe("students");
    expect(classFiltersSchema.safeParse({ page: -1 }).success).toBe(false);
    expect(
      classFiltersSchema.safeParse({ meeting: "foreign-id" }).success,
    ).toBe(false);
  });
});
