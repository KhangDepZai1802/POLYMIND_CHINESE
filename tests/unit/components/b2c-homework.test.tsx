import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  B2CHomework,
  B2CHomeworkPage,
} from "@/features/b2c/domain/homework";

const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  roster: vi.fn(),
  history: vi.fn(),
  prepare: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  archive: vi.fn(),
  submit: vi.fn(),
  fileUrl: vi.fn(),
  upload: vi.fn(),
  bucket: vi.fn(),
}));
vi.mock("@/features/b2c/server/homework-actions", () => ({
  readB2CHomeworkAction: mocks.read,
  readB2CHomeworkSubmissionsAction: mocks.roster,
  readB2CHomeworkSubmissionHistoryAction: mocks.history,
  prepareB2CHomeworkUploadAction: mocks.prepare,
  createB2CHomeworkAction: mocks.create,
  updateB2CHomeworkAction: mocks.update,
  archiveB2CHomeworkAction: mocks.archive,
  submitB2CHomeworkAction: mocks.submit,
  getB2CHomeworkFileUrlAction: mocks.fileUrl,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ storage: { from: mocks.bucket } }),
}));

import { HomeworkPanel } from "@/features/b2c/components/homework-panel";
import { StudentHomework } from "@/features/b2c/components/student-homework";

const assignment: B2CHomework = {
  id: "homework-1",
  class_id: "class-1",
  class_name: "Lớp thử",
  title: "Ôn tập bài 1",
  description: "Làm các câu 1 đến 5.",
  due_at: "2026-11-28T11:00:00Z",
  created_at: "2026-11-27T01:00:00Z",
  updated_at: "2026-11-27T01:00:00Z",
  file_name: "de-bai.pdf",
  mime_type: "application/pdf",
  size_bytes: 8,
  created_by_name: "Giáo viên thử",
  can_manage: true,
  can_submit: true,
  submission_count: 0,
  student_count: 2,
  latest_submission: null,
};
const submitted = {
  id: "submission-1",
  revision: 1,
  file_name: "bai-lam.pdf",
  mime_type: "application/pdf",
  size_bytes: 8,
  submitted_at: "2026-11-27T02:00:00Z",
  due_at_snapshot: assignment.due_at,
};
function page(
  rows = [assignment],
  overrides: Partial<B2CHomeworkPage> = {},
): B2CHomeworkPage {
  return {
    rows,
    total: rows.length,
    class: { id: "class-1", code: "TEST", name: "Lớp thử" },
    schedules: [],
    linked_student: { id: "student-1", full_name: "Học viên thử" },
    classes: [{ id: "class-1", code: "TEST", name: "Lớp thử" }],
    server_now: "2026-11-27T03:00:00Z",
    ...overrides,
  };
}
const pdf = () =>
  new File(["%PDF-1.7"], "de-bai.pdf", { type: "application/pdf" });
function data(mock: ReturnType<typeof vi.fn>, index = 0) {
  return Object.fromEntries(
    (mock.mock.calls[index]?.[1] as FormData).entries(),
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.read.mockResolvedValue(page());
  mocks.roster.mockResolvedValue({ rows: [], total: 0 });
  mocks.history.mockResolvedValue({ rows: [submitted], total: 1 });
  mocks.prepare.mockResolvedValue({
    data: {
      uploadId: "upload-1",
      path: "owned/random.pdf",
      token: "signed-token",
      bucket: "b2c-homework-files",
    },
  });
  mocks.bucket.mockReturnValue({ uploadToSignedUrl: mocks.upload });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.create.mockResolvedValue({ success: "Đã giao bài." });
  mocks.update.mockResolvedValue({ success: "Đã lưu." });
  mocks.archive.mockResolvedValue({ success: "Đã ẩn." });
  mocks.submit.mockResolvedValue({ success: "Đã nộp." });
  mocks.fileUrl.mockResolvedValue({
    url: "https://example.test/signed-file",
    fileName: "de-bai.pdf",
  });
  vi.spyOn(window, "open").mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function openCreate() {
  render(<HomeworkPanel classId="class-1" canManage />);
  await screen.findByText("Ôn tập bài 1");
  fireEvent.click(screen.getByRole("button", { name: "Giao bài tập" }));
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByLabelText("Tên bài tập *"), {
    target: { value: "Bài mới" },
  });
  fireEvent.change(within(dialog).getByLabelText("Hướng dẫn"), {
    target: { value: "Đọc đề và làm bài." },
  });
  const deadline = within(dialog).getByLabelText("Hạn nộp *");
  expect(deadline).toHaveTextContent("dd/mm/yyyy --:--");
  expect(within(dialog).queryByText(/giờ Việt Nam/i)).not.toBeInTheDocument();
  fireEvent.click(deadline);
  fireEvent.click(
    screen.getByRole("button", {
      name: /28.*tháng 11.*2026/i,
    }),
  );
  fireEvent.change(screen.getByLabelText("Giờ"), {
    target: { value: "18:00" },
  });
  expect(deadline).toHaveTextContent("28/11/2026 18:00");
  return dialog;
}

describe("B2C homework staff UI", () => {
  it("shows assignments and VN deadlines without exposing edit controls to a viewer", async () => {
    render(<HomeworkPanel classId="class-1" canManage={false} />);
    expect(await screen.findByText("Ôn tập bài 1")).toBeInTheDocument();
    expect(mocks.read).toHaveBeenCalledWith("class-1", 0);
    expect(screen.getByText(/Hạn nộp:/)).toHaveTextContent("18:00");
    expect(screen.getByText("Đã nộp 0/2 học viên")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Giao bài tập" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sửa bài tập" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ẩn bài tập" }),
    ).not.toBeInTheDocument();
  });

  it("shows load failures and supports retry instead of pretending the class is empty", async () => {
    mocks.read.mockRejectedValueOnce(new Error("Không tải được bài tập."));
    render(<HomeworkPanel classId="class-1" canManage />);
    expect(screen.getByRole("status")).toHaveTextContent("Đang tải");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không tải được",
    );
    expect(screen.queryByText("Lớp chưa có bài tập.")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Ôn tập bài 1")).toBeInTheDocument();
  });

  it("uploads a PDF directly before creating homework and keeps bytes out of the server form", async () => {
    const dialog = await openCreate();
    const file = pdf();
    fireEvent.change(within(dialog).getByLabelText("Đề bài PDF *"), {
      target: { files: [file] },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Giao bài tập" }),
    );
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1));
    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "assignment",
        class_id: "class-1",
        homework_id: null,
        mime_type: "application/pdf",
        size_bytes: 8,
        request_id: expect.any(String),
      }),
    );
    expect(mocks.upload).toHaveBeenCalledWith(
      "owned/random.pdf",
      "signed-token",
      file,
      { contentType: "application/pdf", upsert: false },
    );
    expect(data(mocks.create)).toEqual({
      title: "Bài mới",
      description: "Đọc đề và làm bài.",
      due_at: "2026-11-28T18:00",
      upload_id: "upload-1",
      request_id: expect.any(String),
    });
    expect(data(mocks.create).request_id).not.toBe(
      mocks.prepare.mock.calls[0]?.[0].request_id,
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("retains file, fields and request identity after finalize failure without uploading twice", async () => {
    mocks.create.mockResolvedValueOnce({
      error: "Kết nối gián đoạn. Thử lại.",
    });
    const dialog = await openCreate();
    fireEvent.change(within(dialog).getByLabelText("Đề bài PDF *"), {
      target: { files: [pdf()] },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Giao bài tập" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Kết nối gián đoạn",
    );
    expect(within(dialog).getByLabelText("Tên bài tập *")).toHaveValue(
      "Bài mới",
    );
    expect(within(dialog).getByText("Đã chọn: de-bai.pdf")).toBeInTheDocument();
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Giao bài tập" }),
    );
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(2));
    expect(mocks.prepare).toHaveBeenCalledTimes(1);
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(data(mocks.create, 1).request_id).toBe(
      data(mocks.create).request_id,
    );
  });

  it("rejects a non-PDF assignment and an oversized PDF before requesting upload permission", async () => {
    const dialog = await openCreate();
    const input = within(dialog).getByLabelText("Đề bài PDF *");
    fireEvent.change(input, {
      target: { files: [new File(["image"], "de.png", { type: "image/png" })] },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Chọn tệp PDF");
    const oversized = pdf();
    Object.defineProperty(oversized, "size", { value: 20 * 1024 * 1024 + 1 });
    fireEvent.change(input, { target: { files: [oversized] } });
    expect(screen.getByRole("alert")).toHaveTextContent("20 MB");
    expect(
      within(dialog).getByRole("button", { name: "Giao bài tập" }),
    ).toBeDisabled();
    expect(mocks.prepare).not.toHaveBeenCalled();
  });

  it("edits only homework metadata with the expected version", async () => {
    render(<HomeworkPanel classId="class-1" canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Sửa bài tập" }));
    const deadline = screen.getByLabelText("Hạn nộp *");
    expect(deadline).toHaveTextContent("28/11/2026 18:00");
    expect(screen.queryByLabelText("Đề bài PDF *")).not.toBeInTheDocument();
    fireEvent.click(deadline);
    fireEvent.click(
      screen.getByRole("button", {
        name: /29.*tháng 11.*2026/i,
      }),
    );
    expect(deadline).toHaveTextContent("29/11/2026 18:00");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    expect(data(mocks.update)).toMatchObject({
      id: assignment.id,
      expected_updated_at: assignment.updated_at,
      due_at: "2026-11-29T18:00",
    });
    expect(mocks.prepare).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("lists submitted files alongside students who still need an account", async () => {
    mocks.roster.mockResolvedValue({
      rows: [
        {
          enrollment_id: "e1",
          student_id: "s1",
          student_code: "HV001",
          full_name: "An",
          has_account: true,
          submission: submitted,
        },
        {
          enrollment_id: "e2",
          student_id: "s2",
          student_code: "HV002",
          full_name: "Bình",
          has_account: false,
          submission: null,
        },
      ],
      total: 2,
    });
    render(<HomeworkPanel classId="class-1" canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Bài đã nộp" }));
    expect(await screen.findByText("Bình")).toBeInTheDocument();
    expect(screen.getByText(/Chưa có tài khoản học viên/)).toBeInTheDocument();
    expect(screen.getByText("bai-lam.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mở bài nộp" }));
    await waitFor(() =>
      expect(mocks.fileUrl).toHaveBeenCalledWith("submission", "submission-1"),
    );
    expect(
      await screen.findByRole("link", { name: /Tệp đã sẵn sàng/ }),
    ).toHaveAttribute("href", "https://example.test/signed-file");
  });

  it("requires confirmation before archiving the expected homework version", async () => {
    render(<HomeworkPanel classId="class-1" canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Ẩn bài tập" }));
    expect(mocks.archive).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận ẩn" }));
    await waitFor(() => expect(mocks.archive).toHaveBeenCalledTimes(1));
    expect(data(mocks.archive)).toEqual({
      id: assignment.id,
      expected_updated_at: assignment.updated_at,
    });
  });

  it("opens a student's submission history using the roster enrollment ID", async () => {
    mocks.roster.mockResolvedValue({ rows: [{ enrollment_id: "enrollment-specific", student_id: "student-other", student_code: "HV001", full_name: "An", has_account: true, submission: submitted }], total: 1 });
    render(<HomeworkPanel classId="class-1" canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Bài đã nộp" }));
    fireEvent.click(await screen.findByRole("button", { name: "Lịch sử nộp bài" }));
    await waitFor(() => expect(mocks.history).toHaveBeenCalledWith(assignment.id, "enrollment-specific", 0));
    expect(await screen.findByRole("heading", { name: "Lịch sử nộp bài" })).toBeInTheDocument();
  });

  it("reports revoked file access without producing a download link", async () => {
    mocks.fileUrl.mockResolvedValue({ error: "Bạn không còn quyền xem tệp này." });
    render(<HomeworkPanel classId="class-1" canManage />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở đề PDF" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("không còn quyền");
    expect(screen.queryByRole("link", { name: /Tệp đã sẵn sàng/ })).not.toBeInTheDocument();
  });
});

describe("B2C homework student UI", () => {
  it.each([
    [
      page([], { linked_student: null, classes: [] }),
      "Tài khoản chưa được liên kết",
    ],
    [page([], { classes: [] }), "Bạn chưa có lớp trung tâm"],
    [page([]), "Chưa có bài tập được giao"],
  ] as const)(
    "distinguishes missing access/class/homework",
    async (model, text) => {
      mocks.read.mockResolvedValue(model);
      render(<StudentHomework />);
      expect(await screen.findByText(new RegExp(text))).toBeInTheDocument();
      expect(mocks.read).toHaveBeenCalledWith(null, 0);
      expect(
        screen.queryByRole("button", { name: "Nộp bài" }),
      ).not.toBeInTheDocument();
    },
  );

  it("shows a read error separately from a student with no assignments", async () => {
    mocks.read.mockRejectedValueOnce(new Error("Không tải được bài tập."));
    render(<StudentHomework />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không tải được",
    );
    expect(
      screen.queryByText("Chưa có bài tập được giao."),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(await screen.findByText("Ôn tập bài 1")).toBeInTheDocument();
  });

  it("uses server eligibility to prevent submission after the deadline", async () => {
    mocks.read.mockResolvedValue(
      page([{ ...assignment, can_submit: false }], {
        server_now: "2026-11-29T01:00:00Z",
      }),
    );
    render(<StudentHomework />);
    expect(await screen.findByText("Quá hạn")).toBeInTheDocument();
    expect(screen.getByText("Đã hết hạn nộp bài.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Chọn bài nộp")).not.toBeInTheDocument();
    expect(mocks.submit).not.toHaveBeenCalled();
  });

  it("uploads a student's image then submits only homework/upload/request IDs", async () => {
    render(<StudentHomework />);
    expect(
      await screen.findByRole("complementary", { name: "Bài tập của bạn" }),
    ).toBeInTheDocument();
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], "bai-lam.jpg", {
      type: "image/jpeg",
    });
    fireEvent.change(await screen.findByLabelText("Chọn bài nộp"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "submission",
        class_id: assignment.class_id,
        homework_id: assignment.id,
        mime_type: "image/jpeg",
      }),
    );
    expect(mocks.upload).toHaveBeenCalledWith(
      "owned/random.pdf",
      "signed-token",
      file,
      { contentType: "image/jpeg", upsert: false },
    );
    expect(data(mocks.submit)).toEqual({
      homework_id: assignment.id,
      upload_id: "upload-1",
      request_id: expect.any(String),
    });
    expect(
      await screen.findByText("Đã nộp bài “Ôn tập bài 1”."),
    ).toBeInTheDocument();
  });

  it("preserves the last submission while retrying a new version with the same request ID", async () => {
    mocks.read.mockResolvedValue(
      page([{ ...assignment, latest_submission: submitted }]),
    );
    mocks.submit.mockResolvedValue({ error: "Chưa ghi nhận được. Thử lại." });
    render(<StudentHomework />);
    fireEvent.change(await screen.findByLabelText("Chọn bài nộp mới"), {
      target: { files: [pdf()] },
    });
    fireEvent.click(screen.getByRole("button", { name: "Nộp lại bài" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Chưa ghi nhận được",
    );
    expect(screen.getByText("Bài nộp gần nhất · Lần 1")).toBeInTheDocument();
    expect(screen.getByText("bai-lam.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nộp lại bài" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(2));
    expect(data(mocks.submit, 1).request_id).toBe(
      data(mocks.submit).request_id,
    );
    expect(mocks.upload).toHaveBeenCalledTimes(1);
    expect(mocks.prepare).toHaveBeenCalledTimes(1);
  });

  it("prevents duplicate in-flight submissions even if the form is submitted twice", async () => {
    let resolve!: (value: { error: null }) => void;
    mocks.upload.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<StudentHomework />);
    const input = await screen.findByLabelText("Chọn bài nộp");
    fireEvent.change(input, { target: { files: [pdf()] } });
    const form = input.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Đang nộp…" })).toBeDisabled();
    resolve({ error: null });
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
  });

  it("loads the next student page in the student scope", async () => {
    mocks.read.mockResolvedValue(page([assignment], { total: 21 }));
    render(<StudentHomework />);
    fireEvent.click(await screen.findByRole("button", { name: "Sau" }));
    await waitFor(() => expect(mocks.read).toHaveBeenCalledWith(null, 1));
  });

  it("shows prior revisions in the student's own scope and opens the selected historic file", async () => {
    const latest = { ...submitted, id: "submission-2", revision: 2, file_name: "lan-2.pdf" };
    mocks.read.mockResolvedValue(page([{ ...assignment, latest_submission: latest }]));
    mocks.history.mockResolvedValue({ rows: [latest, submitted], total: 2 });
    render(<StudentHomework />);
    fireEvent.click(await screen.findByRole("button", { name: "Lịch sử nộp bài" }));
    expect(await screen.findByText("Lần nộp 1")).toBeInTheDocument();
    expect(mocks.history).toHaveBeenCalledWith(assignment.id, null, 0);
    const oldRevision = screen.getByText("Lần nộp 1").closest("article")!;
    fireEvent.click(within(oldRevision).getByRole("button", { name: "Mở bài nộp" }));
    await waitFor(() => expect(mocks.fileUrl).toHaveBeenCalledWith("submission", "submission-1"));
  });

  it("retries an uncertain upload on its original path and lets the server verify an existing object", async () => {
    mocks.upload.mockResolvedValueOnce({ error: { statusCode: "503" } }).mockResolvedValueOnce({ error: { statusCode: "409" } });
    render(<StudentHomework />);
    fireEvent.change(await screen.findByLabelText("Chọn bài nộp"), { target: { files: [pdf()] } });
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Không tải được tệp");
    expect(mocks.submit).not.toHaveBeenCalled();
    expect(screen.getByText("Đã chọn: de-bai.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Nộp bài" }));
    await waitFor(() => expect(mocks.submit).toHaveBeenCalledTimes(1));
    expect(mocks.prepare).toHaveBeenCalledTimes(1);
    expect(mocks.upload.mock.calls[1]?.[0]).toBe(mocks.upload.mock.calls[0]?.[0]);
    expect(data(mocks.submit).upload_id).toBe("upload-1");
  });
});
