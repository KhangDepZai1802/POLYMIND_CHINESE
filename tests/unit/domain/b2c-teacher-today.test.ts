import { describe, expect, it } from "vitest";
import { getB2CClassesToday } from "@/features/b2c/domain/teacher-today";

const starter = {
  id: "starter",
  status: "active",
  start_date: null as string | null,
  weekdays_text: "T2-T4",
};
describe("B2C weekly classes today", () => {
  it("shows Starter Hero on Wednesday while excluding Tuesday/Thursday", () => {
    expect(
      getB2CClassesToday(
        [starter, { ...starter, id: "pre", weekdays_text: "T3-T5" }],
        new Date("2026-10-14T05:00:00Z"),
      ),
    ).toEqual([starter]);
  });
  it("uses the Vietnamese day across UTC midnight", () => {
    expect(
      getB2CClassesToday([starter], new Date("2026-10-13T17:01:00Z")),
    ).toEqual([starter]);
    expect(
      getB2CClassesToday([starter], new Date("2026-10-14T17:01:00Z")),
    ).toEqual([]);
  });
  it("excludes paused, ended, cancelled and not-yet-started classes", () => {
    const classes = ["paused", "completed", "cancelled", "planned"].map(
      (status) => ({ ...starter, status }),
    );
    classes.push({ ...starter, start_date: "2026-10-15" } as typeof starter);
    expect(
      getB2CClassesToday(classes, new Date("2026-10-14T05:00:00Z")),
    ).toEqual([]);
  });
  it("includes the opening day and matches Sunday, commas and lowercase", () => {
    const sunday = {
      ...starter,
      start_date: "2026-10-18",
      weekdays_text: "t7, cn",
    };
    expect(
      getB2CClassesToday([sunday], new Date("2026-10-18T05:00:00Z")),
    ).toEqual([sunday]);
  });
  it("does not infer missing or malformed days and lists each class once", () => {
    expect(
      getB2CClassesToday(
        [
          { ...starter, weekdays_text: "T40" },
          { ...starter, weekdays_text: null },
        ],
        new Date("2026-10-14T05:00:00Z"),
      ),
    ).toEqual([]);
    expect(
      getB2CClassesToday(
        [{ ...starter, weekdays_text: "T4-T4" }],
        new Date("2026-10-14T05:00:00Z"),
      ),
    ).toHaveLength(1);
  });
});
