import { describe, expect, it } from "vitest";
import {
  readWeeklyDefaults,
  weeklyScheduleSchema,
  readWeeklySlots,
  serializeWeeklySlots,
} from "@/features/b2c/domain/weekly-schedule";
describe("B2C weekly schedule without dates", () => {
  it.each(["18h00-19h30", "18:00–19:30", "18g00 - 19g30"])(
    "prefills Sheet time %s",
    (time) => {
      expect(readWeeklyDefaults("T4-T2", time)).toEqual({
        weekdays: ["T2", "T4"],
        start_time: "18:00",
        end_time: "19:30",
      });
    },
  );
  it("does not invent missing weekdays or hours", () => {
    expect(readWeeklyDefaults(null, null)).toEqual({
      weekdays: [],
      start_time: "",
      end_time: "",
    });
  });
  const input = {
    class_id: "11111111-1111-4111-8111-111111111111",
    expected_updated_at: "2026-10-16T00:00:00Z",
    teacher_name: "Cô Tú",
    weekdays: ["T2", "T4"],
    start_time: "18:00",
    end_time: "19:30",
  };
  it("roundtrips distinct hours for T4 and T6 without changing the old shared format", () => {
    const slots = [
      { day: "T4" as const, start_time: "19:30", end_time: "21:00" },
      { day: "T6" as const, start_time: "18:00", end_time: "19:30" },
    ];
    const text = serializeWeeklySlots(slots);
    expect(text).toBe("T4 19:30–21:00; T6 18:00–19:30");
    expect(readWeeklySlots("T4-T6", text)).toEqual(slots);
    expect(
      weeklyScheduleSchema.safeParse({
        class_id: input.class_id,
        expected_updated_at: input.expected_updated_at,
        teacher_name: input.teacher_name,
        slots,
      }).success,
    ).toBe(true);
  });
  it("does not guess a shared range when legacy text contains several ranges without weekday labels", () => {
    expect(readWeeklySlots("T4-T6", "T4 19h30-21h00 / T6 18h00-19h30").every(s=>s.start_time==="" && s.end_time==="")).toBe(true);
    expect(
      readWeeklySlots("T4-T6", "19h30-21h00 / 18h00-19h30").every(
        (s) => s.start_time === "" && s.end_time === "",
      ),
    ).toBe(true);
  });
  it("rejects a duplicate weekday or an invalid range within any weekday", () => {
    const base = {
      class_id: input.class_id,
      expected_updated_at: input.expected_updated_at,
      teacher_name: input.teacher_name,
    };
    const slot = { day: "T4", start_time: "19:30", end_time: "21:00" };
    expect(
      weeklyScheduleSchema.safeParse({ ...base, slots: [slot, slot] }).success,
    ).toBe(false);
    expect(
      weeklyScheduleSchema.safeParse({
        ...base,
        slots: [slot, { day: "T6", start_time: "20:00", end_time: "19:00" }],
      }).success,
    ).toBe(false);
  });
  it("accepts a weekly schedule without any dates", () =>
    expect(weeklyScheduleSchema.safeParse(input).success).toBe(true));
  it("rejects invalid weekdays, no selected days, invalid hours and overnight intervals", () => {
    for (const patch of [
      { weekdays: [] },
      { weekdays: ["T8"] },
      { start_time: "25:00" },
      { end_time: "17:00" },
      { teacher_name: "" },
    ])
      expect(
        weeklyScheduleSchema.safeParse({ ...input, ...patch }).success,
      ).toBe(false);
  });
});
