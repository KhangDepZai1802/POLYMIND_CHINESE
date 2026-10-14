import { describe, it, expect } from "vitest";
import {
  teachingSessionSchema,
  checkpointSchema,
} from "@/features/b2c/teaching-schema";
const session = {
  class_id: "50000000-0000-4000-8000-000000000006",
  teacher_id: "50000000-0000-4000-8000-000000000005",
  date: "2026-10-14",
  start_time: "18:00",
  end_time: "19:30",
};
describe("lịch dạy và chấm công B2C", () => {
  it("nhận lịch một buổi hợp lệ", () =>
    expect(teachingSessionSchema.safeParse(session).success).toBe(true));
  it.each(["17:00", "18:00", "99:99"])("chặn giờ kết thúc %s", (end_time) =>
    expect(
      teachingSessionSchema.safeParse({ ...session, end_time }).success,
    ).toBe(false),
  );
  it("chặn buổi quá 12 giờ", () =>
    expect(
      teachingSessionSchema.safeParse({
        ...session,
        start_time: "06:00",
        end_time: "20:00",
      }).success,
    ).toBe(false));
  it("không nhận thời gian check-in từ client", () =>
    expect(
      checkpointSchema.parse({
        id: session.class_id,
        kind: "in",
        photo: "file.jpg",
        at: "2000-01-01",
      }),
    ).not.toHaveProperty("at"));
  it("chặn loại checkpoint và ảnh trống", () => {
    expect(
      checkpointSchema.safeParse({
        id: session.class_id,
        kind: "bad",
        photo: "file.jpg",
      }).success,
    ).toBe(false);
    expect(
      checkpointSchema.safeParse({
        id: session.class_id,
        kind: "in",
        photo: "",
      }).success,
    ).toBe(false);
  });
});
