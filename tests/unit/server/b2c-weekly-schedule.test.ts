import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  manager: vi.fn(),
  client: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  maybeSingle: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireManager: mocks.manager }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveWeeklyScheduleAction } from "@/features/b2c/server/weekly-schedule-actions";
const input = {
  class_id: "11111111-1111-4111-8111-111111111111",
  expected_updated_at: "2026-10-16T00:00:00Z",
  teacher_name: "Cô Tú",
  weekdays: ["T4", "T2", "T2"],
  start_time: "18:00",
  end_time: "19:30",
};
describe("save B2C weekly schedule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager.mockResolvedValue({ role: "super_admin" });
    const query = {
      update: mocks.update,
      eq: mocks.eq,
      select: mocks.select,
      maybeSingle: mocks.maybeSingle,
    };
    for (const fn of [mocks.from, mocks.update, mocks.eq, mocks.select])
      fn.mockReturnValue(query);
    mocks.client.mockResolvedValue({ from: mocks.from });
    mocks.maybeSingle.mockResolvedValue({
      data: { id: input.class_id },
      error: null,
    });
  });
  it("checks manager authorization before reading or changing data", async () => {
    mocks.manager.mockRejectedValue(new Error("denied"));
    await expect(saveWeeklyScheduleAction(input)).rejects.toThrow("denied");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("writes only weekly fields through the session client, with a stale-write guard", async () => {
    expect(await saveWeeklyScheduleAction(input)).toHaveProperty("success");
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith("b2c_classes");
    expect(mocks.update).toHaveBeenCalledWith({
      teacher_name: "Cô Tú",
      weekdays_text: "T2-T4",
      time_text: "18:00–19:30",
    });
    expect(mocks.eq).toHaveBeenCalledWith("id", input.class_id);
    expect(mocks.eq).toHaveBeenCalledWith(
      "updated_at",
      input.expected_updated_at,
    );
  });
  it("does not report success or refresh when a stale or invisible row was not updated", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await saveWeeklyScheduleAction(input)).toHaveProperty("error");
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rejects invalid times before contacting the database", async () => {
    expect(
      await saveWeeklyScheduleAction({ ...input, end_time: "17:00" }),
    ).toHaveProperty("error");
    expect(mocks.client).not.toHaveBeenCalled();
  });
});
