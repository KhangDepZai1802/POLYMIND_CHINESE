import { beforeEach, describe, expect, it, vi } from "vitest";

import StudentScheduleRedirect from "@/app/(dashboard)/student/schedule/page";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("StudentScheduleRedirect", () => {
  beforeEach(() => vi.clearAllMocks());

  it("giữ link lịch cũ và chuyển về Lớp của tôi", () => {
    StudentScheduleRedirect();
    expect(redirect).toHaveBeenCalledWith("/student/class");
  });
});
