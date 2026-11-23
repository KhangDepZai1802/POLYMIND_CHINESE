import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClassJournalPreview } from "@/features/b2c/components/class-journal-preview";
import { readJournalPreviewMeetings } from "@/features/b2c/server/class-journal-preview";

vi.mock("@/features/b2c/server/class-journal-preview", () => ({
  readJournalPreviewMeetings: vi.fn(),
}));
const cls = {
  id: "current-class-id",
  code: "CURRENT-321",
  name: "Lớp đang có trong hệ thống",
  program_slug: "tieng-trung",
  status: "active",
  weekdays_text: "T7",
  time_text: "08:30–10:00",
};
const meeting = {
  id: "current-meeting-id",
  starts_at: "2026-11-21T01:30:00Z",
  ends_at: "2026-11-21T03:00:00Z",
  teacher_name: "Giáo viên được phân công",
  status: "completed",
} as const;
function mount(canCompose = true) {
  render(
    <ClassJournalPreview
      classes={[cls]}
      actorName="Người soạn"
      canCompose={canCompose}
      classBase="/teacher/b2c-classes"
    />,
  );
  return userEvent.setup();
}
async function openClass(
  user: ReturnType<typeof userEvent.setup>,
  branch = "Báo bài",
) {
  await user.click(
    screen.getByRole("button", { name: new RegExp(`${branch} các lớp`) }),
  );
  expect(
    screen.queryByRole("button", { name: /Tiếng Anh/ }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole("button", { name: `${branch} Tiếng Trung 1 lớp` }),
  );
  await user.click(
    screen.getByRole("button", {
      name: /Lớp đang có trong hệ thống CURRENT-321/,
    }),
  );
}

describe("B2C journal preview with existing classes", () => {
  beforeEach(() => {
    vi.mocked(readJournalPreviewMeetings).mockResolvedValue({
      rows: [meeting],
      total: 1,
    });
  });
  it("uses only supplied classes and opens the existing attendance meeting", async () => {
    const user = mount();
    await openClass(user, "Điểm danh");
    expect(
      await screen.findByRole("link", { name: "Mở điểm danh" }),
    ).toHaveAttribute(
      "href",
      "/teacher/b2c-classes/current-class-id?tab=attendance&meeting=current-meeting-id",
    );
    expect(readJournalPreviewMeetings).toHaveBeenCalledWith(cls.id, 0);
    expect(screen.getByText("08:30–10:00")).toBeInTheDocument();
  });
  it("keeps drafts out of recipient view and opens the sent preview from its notification", async () => {
    const user = mount();
    await openClass(user);
    await user.click(await screen.findByRole("button", { name: "Mở báo bài" }));
    await user.type(
      screen.getByLabelText("Nội dung đã học"),
      "Nội dung thuộc đúng buổi học.",
    );
    await user.upload(
      screen.getByLabelText("File đính kèm"),
      new File(["lesson"], "bai-hoc.pdf", { type: "application/pdf" }),
    );
    await user.click(screen.getByRole("button", { name: "Lưu nháp thử" }));
    await user.click(
      screen.getByRole("button", { name: "Xem như người nhận" }),
    );
    expect(
      screen.getByText(/Chưa có báo bài được gửi thử/),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nội dung thuộc đúng buổi học."),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Soạn báo bài" }));
    await user.click(screen.getByRole("button", { name: "Thử gửi cho lớp" }));
    await user.click(screen.getByRole("button", { name: "Thông báo thử (1)" }));
    await user.click(
      screen.getByRole("button", {
        name: /Lớp đang có trong hệ thống có báo bài mới/,
      }),
    );
    expect(
      screen.getByText("Nội dung thuộc đúng buổi học."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "bai-hoc.pdf" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Thử gửi cho lớp" }),
    ).not.toBeInTheDocument();
  });
  it("shows a read error instead of inventing a class schedule", async () => {
    vi.mocked(readJournalPreviewMeetings).mockRejectedValue(
      new Error("Denied"),
    );
    const user = mount();
    await openClass(user);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không tải được buổi học",
    );
    expect(
      screen.queryByRole("button", { name: "Mở báo bài" }),
    ).not.toBeInTheDocument();
  });
  it("does not offer composition to viewers", async () => {
    const user = mount(false);
    await openClass(user);
    await user.click(
      await screen.findByRole("button", { name: "Xem báo bài" }),
    );
    expect(screen.queryByLabelText("Nội dung đã học")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Thử gửi cho lớp" }),
    ).not.toBeInTheDocument();
  });
  it("ignores a schedule response after leaving its class", async () => {
    let resolve!: (data: { rows: (typeof meeting)[]; total: number }) => void;
    vi.mocked(readJournalPreviewMeetings).mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const user = mount();
    await openClass(user);
    await user.click(
      screen.getByRole("button", { name: "Điểm danh + Báo bài" }),
    );
    resolve({ rows: [meeting], total: 1 });
    await waitFor(() =>
      expect(screen.queryByRole("table")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /Báo bài các lớp 1 lớp/ }),
    ).toBeInTheDocument();
  });
});
