import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMyClassOverview } from "@/features/student/server/queries";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("server-only", () => ({}));

describe("getMyClassOverview", () => {
  const maybeSingle = vi.fn();
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn((projection: string) => {
    void projection;
    return { eq };
  });
  const from = vi.fn((table: string) => {
    void table;
    return { select };
  });

  beforeEach(() => {
    vi.clearAllMocks();
    maybeSingle.mockResolvedValue({ data: null, error: null });
    vi.mocked(createClient).mockResolvedValue({ from } as never);
  });

  it("chỉ lấy thông tin lớp và giáo viên, không query roster học viên", async () => {
    await getMyClassOverview("11111111-1111-4111-8111-111111111111");

    expect(from).toHaveBeenCalledWith("classes");
    expect(eq).toHaveBeenCalledWith(
      "id",
      "11111111-1111-4111-8111-111111111111",
    );

    const projection = String(select.mock.calls[0]?.[0] ?? "");
    expect(projection).toContain("class_teachers");
    expect(projection).toContain("class_schedules");
    expect(projection).not.toMatch(/students|enrollments/);
  });
});
