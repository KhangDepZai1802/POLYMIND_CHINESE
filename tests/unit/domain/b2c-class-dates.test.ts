import { describe, expect, it } from "vitest";
import { b2cClassSchema } from "@/features/b2c/schema";
const base = {
  program_slug: "tieng-anh",
  name: "Lớp thử",
  level_name: "",
  teacher_name: "",
  weekdays_text: "",
  time_text: "",
  capacity: 10,
  enrolled_count: 0,
  campus: "",
  delivery_mode: "offline",
  start_date: "2026-10-01",
  status: "planned",
  notes: "",
};
describe("B2C course dates", () => {
  it("keeps the end date optional and independent of start date", () => {
    expect(b2cClassSchema.parse(base).end_date).toBeNull();
    expect(
      b2cClassSchema.parse({ ...base, start_date: "", end_date: "2026-12-31" })
        .end_date,
    ).toBe("2026-12-31");
  });
  it("accepts same-day or later end dates", () => {
    for (const end_date of ["2026-10-01", "2026-12-31"])
      expect(b2cClassSchema.safeParse({ ...base, end_date }).success).toBe(
        true,
      );
  });
  it("rejects an end date before opening", () => {
    const result = b2cClassSchema.safeParse({
      ...base,
      end_date: "2026-09-30",
    });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0]?.path).toEqual(["end_date"]);
  });
  it("rejects invalid date text", () => {
    expect(
      b2cClassSchema.safeParse({ ...base, end_date: "invalid" }).success,
    ).toBe(false);
    expect(
      b2cClassSchema.safeParse({ ...base, start_date: "invalid" }).success,
    ).toBe(false);
  });
});
