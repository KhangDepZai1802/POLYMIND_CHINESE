import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  manager: vi.fn(),
  client: vi.fn(),
  from: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/session", () => ({ requireManager: mocks.manager }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { getTodayTasks } from "@/features/b2c/server/today-tasks";

describe("today task reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.manager.mockResolvedValue({ role: "academic_manager" });
    mocks.client.mockResolvedValue({ from: mocks.from });
  });
  it("rejects unauthorized actors before accessing any business data", async () => {
    mocks.manager.mockRejectedValue(new Error("denied"));
    await expect(getTodayTasks()).rejects.toThrow("denied");
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("fails visibly when any source cannot be read", async () => {
    mocks.from.mockImplementation(() => {
      const query = {
        select: vi.fn(),
        order: vi.fn(),
        lte: vi.fn(),
        neq: vi.fn(),
        is: vi.fn(),
        range: vi
          .fn()
          .mockResolvedValue({ data: null, error: { message: "offline" } }),
      };
      for (const method of [
        query.select,
        query.order,
        query.lte,
        query.neq,
        query.is,
      ])
        method.mockReturnValue(query);
      return query;
    });
    await expect(getTodayTasks()).rejects.toThrow(
      "Không tải được danh sách công việc",
    );
  });
  it("reads additional pages instead of silently stopping at the API row limit", async () => {
    const ranges: number[] = [];
    mocks.from.mockImplementation((table: string) => {
      const query = {
        select: vi.fn(),
        order: vi.fn(),
        lte: vi.fn(),
        neq: vi.fn(),
        is: vi.fn(),
        range: vi.fn().mockImplementation((offset: number) => {
          if (table === "b2c_admission_care_logs") ranges.push(offset);
          return Promise.resolve({
            data:
              table === "b2c_admission_care_logs" && offset === 0
                ? Array.from({ length: 500 }, (_, i) => ({
                    id: String(i),
                    lead_id: String(i),
                    created_at: "2026-10-16T00:00:00Z",
                    next_followup_date: null,
                  }))
                : [],
            error: null,
          });
        }),
      };
      for (const method of [
        query.select,
        query.order,
        query.lte,
        query.neq,
        query.is,
      ])
        method.mockReturnValue(query);
      return query;
    });
    const result = await getTodayTasks();
    expect(ranges).toEqual([0, 500]);
    expect(result.tasks).toEqual([]);
    expect(
      mocks.from.mock.calls.every(([table]) => table.startsWith("b2c_")),
    ).toBe(true);
  });
});
