import { beforeEach, describe, expect, it, vi } from "vitest";
import { readJournalPreviewMeetings } from "@/features/b2c/server/class-journal-preview";
import { requireTeaching } from "@/lib/auth/session";
import { readTeacherWorkspaceAction } from "@/features/b2c/server/teacher-management-actions";
import { readClassWorkspaceAction } from "@/features/b2c/server/class-workspace-read";

vi.mock("@/lib/auth/session", () => ({ requireTeaching: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/features/b2c/server/teacher-class-queries", () => ({
  getMyB2CClasses: vi.fn(),
}));
vi.mock("@/features/b2c/server/permission-rpc", () => ({
  permissionRpc: vi.fn(),
}));
vi.mock("@/features/b2c/server/teacher-management-actions", () => ({
  readTeacherWorkspaceAction: vi.fn(),
}));
vi.mock("@/features/b2c/server/class-workspace-read", () => ({
  readClassWorkspaceAction: vi.fn(),
}));

describe("Journal preview read scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireTeaching).mockResolvedValue({
      id: "actor",
      role: "teacher",
      fullName: "Teacher",
      email: "teacher@example.test",
      avatarPath: null,
    });
  });
  it("does not fall back to a manager query when the teacher cannot read a class", async () => {
    vi.mocked(readTeacherWorkspaceAction).mockRejectedValue(
      new Error("Forbidden"),
    );
    await expect(
      readJournalPreviewMeetings("77364cda-d5ab-403a-b2de-0dd43b0cc023", 0),
    ).rejects.toThrow("Forbidden");
    expect(readTeacherWorkspaceAction).toHaveBeenCalledWith(
      "77364cda-d5ab-403a-b2de-0dd43b0cc023",
      { tab: "schedule", page: "0" },
    );
    expect(readClassWorkspaceAction).not.toHaveBeenCalled();
  });
  it("rejects invalid identifiers before querying the workspace", async () => {
    await expect(readJournalPreviewMeetings("invalid", 0)).rejects.toThrow();
    expect(readTeacherWorkspaceAction).not.toHaveBeenCalled();
  });
});
