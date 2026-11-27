import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  B2C_HOMEWORK_BUCKET,
  B2C_HOMEWORK_MAX_BYTES,
} from "@/features/b2c/domain/homework";

const mocks = vi.hoisted(() => ({
  role: vi.fn(), teaching: vi.fn(), rpc: vi.fn(), from: vi.fn(), info: vi.fn(),
  download: vi.fn(), uploadUrl: vi.fn(), fileUrl: vi.fn(), revalidate: vi.fn(), path: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({ requireRole: mocks.role, requireTeaching: mocks.teaching }));
vi.mock("@/features/b2c/server/permission-rpc", () => ({ permissionRpc: mocks.rpc }));
vi.mock("@/features/b2c/server/revalidate-views", () => ({ revalidateB2CViews: mocks.revalidate }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.path }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ storage: { from: mocks.from } }) }));

import {
  archiveB2CHomeworkAction,
  createB2CHomeworkAction,
  getB2CHomeworkFileUrlAction,
  prepareB2CHomeworkUploadAction,
  readB2CHomeworkAction,
  readB2CHomeworkSubmissionHistoryAction,
  readB2CHomeworkSubmissionsAction,
  submitB2CHomeworkAction,
  updateB2CHomeworkAction,
} from "@/features/b2c/server/homework-actions";

const id = "11111111-1111-4111-8111-111111111111";
const uploadId = "22222222-2222-4222-8222-222222222222";
const requestId = "33333333-3333-4333-8333-333333333333";
const path = `${id}/assignment/${uploadId}.pdf`;
const stored = { object_path: path, file_name: "Bài.pdf", mime_type: "application/pdf", size_bytes: 100, bucket: B2C_HOMEWORK_BUCKET };
const details = { title: "Bài đọc", description: "Đọc và trả lời.", due_at: "2026-11-28T20:30" };
const expected = "2026-11-27T10:00:00+00:00";
const prep = { class_id: id, homework_id: null, kind: "assignment", file_name: "Bài.pdf", mime_type: "application/pdf", size_bytes: 100, request_id: requestId };
function form(values: Record<string, string>) {
  const result = new FormData();
  for (const [name, value] of Object.entries(values)) result.set(name, value);
  return result;
}
function blob(signature = [0x25, 0x50, 0x44, 0x46, 0x2d], size = 100) {
  return { size, slice: () => ({ arrayBuffer: async () => new Uint8Array(signature).buffer }) };
}
const createForm = () => form({ ...details, upload_id: uploadId, request_id: requestId });
const submitForm = () => form({ homework_id: id, upload_id: uploadId, request_id: requestId });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role.mockResolvedValue({ id });
  mocks.teaching.mockResolvedValue({ id });
  mocks.from.mockReturnValue({ info: mocks.info, download: mocks.download, createSignedUploadUrl: mocks.uploadUrl, createSignedUrl: mocks.fileUrl });
  mocks.info.mockResolvedValue({ data: { contentType: "application/pdf", size: 100 }, error: null });
  mocks.download.mockResolvedValue({ data: blob(), error: null });
  mocks.uploadUrl.mockResolvedValue({ data: { path, token: "signed-token" }, error: null });
  mocks.fileUrl.mockResolvedValue({ data: { signedUrl: "https://storage.example/private/signed" }, error: null });
  mocks.rpc.mockImplementation(async (name: string) => name === "read_b2c_homework_file" ? stored
    : name === "prepare_b2c_homework_upload" ? { id: uploadId, object_path: path, bucket: B2C_HOMEWORK_BUCKET } : id);
});

describe("B2C homework direct upload", () => {
  it("signs only the path authorized and issued by the database", async () => {
    expect(await prepareB2CHomeworkUploadAction(prep)).toEqual({ data: { uploadId, path, token: "signed-token", bucket: B2C_HOMEWORK_BUCKET } });
    expect(mocks.teaching).toHaveBeenCalledWith("super_admin");
    expect(mocks.rpc).toHaveBeenCalledWith("prepare_b2c_homework_upload", {
      p_class_id: id, p_homework_id: null, p_kind: "assignment", p_file_name: "Bài.pdf",
      p_mime_type: "application/pdf", p_size_bytes: 100, p_request_id: requestId,
    });
    expect(mocks.uploadUrl).toHaveBeenCalledWith(path, { upsert: false });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("requires the student role for submission tickets", async () => {
    expect(await prepareB2CHomeworkUploadAction({ ...prep, homework_id: id, kind: "submission" })).toHaveProperty("data");
    expect(mocks.role).toHaveBeenLastCalledWith("student");
    expect(mocks.teaching).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledWith("prepare_b2c_homework_upload", expect.objectContaining({ p_class_id: id, p_homework_id: id, p_kind: "submission" }));
  });

  it("rejects a submission ticket without its homework class scope", async () => {
    expect(await prepareB2CHomeworkUploadAction({ ...prep, class_id: null, homework_id: id, kind: "submission" })).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.uploadUrl).not.toHaveBeenCalled();
  });

  it.each([{ size_bytes: B2C_HOMEWORK_MAX_BYTES + 1 }, { mime_type: "text/html" }, { file_name: "../Bài.pdf" }, { class_id: null }, { request_id: "bad" }])(
    "rejects malformed metadata before granting an upload %j", async (change) => {
      expect(await prepareB2CHomeworkUploadAction({ ...prep, ...change })).toHaveProperty("error");
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.uploadUrl).not.toHaveBeenCalled();
    },
  );

  it("does not mint a URL after a denied class scope", async () => {
    mocks.rpc.mockRejectedValue(new Error("Bạn không có quyền giao bài."));
    expect(await prepareB2CHomeworkUploadAction(prep)).toEqual({ error: "Bạn không có quyền giao bài." });
    expect(mocks.uploadUrl).not.toHaveBeenCalled();
  });

  it("returns signing failures without publishing a homework", async () => {
    mocks.uploadUrl.mockResolvedValue({ data: null, error: { message: "Storage unavailable" } });
    expect(await prepareB2CHomeworkUploadAction(prep)).toHaveProperty("error");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});

describe("B2C homework publication and submission", () => {
  it("verifies actual file metadata and magic bytes before publishing with UTC deadline", async () => {
    expect(await createB2CHomeworkAction({}, createForm())).toHaveProperty("success");
    expect(mocks.rpc).toHaveBeenNthCalledWith(1, "read_b2c_homework_file", { p_kind: "upload", p_id: uploadId });
    expect(mocks.info).toHaveBeenCalledWith(path);
    expect(mocks.download).toHaveBeenCalledWith(path, {}, expect.objectContaining({ cache: "no-store" }));
    expect(mocks.rpc).toHaveBeenLastCalledWith("create_b2c_homework", {
      p_upload_id: uploadId, p_title: "Bài đọc", p_description: "Đọc và trả lời.",
      p_due_at: "2026-11-28T13:30:00.000Z", p_request_id: requestId,
    });
    expect(mocks.revalidate).toHaveBeenCalledTimes(1);
    expect(mocks.path).toHaveBeenCalledWith("/student/b2c-homework");
  });

  it("submits using the uploaded ID and stable retry key, without a client student ID", async () => {
    expect(await submitB2CHomeworkAction({}, submitForm())).toHaveProperty("success");
    expect(mocks.role).toHaveBeenCalledWith("student");
    expect(mocks.rpc).toHaveBeenLastCalledWith("submit_b2c_homework", { p_homework_id: id, p_upload_id: uploadId, p_request_id: requestId });
  });

  it("accepts a PNG submission after validating its actual signature", async () => {
    mocks.rpc.mockImplementation(async (name: string) => name === "read_b2c_homework_file" ? { ...stored, file_name: "Bài.png", mime_type: "image/png" } : id);
    mocks.info.mockResolvedValue({ data: { contentType: "image/png", size: 100 }, error: null });
    mocks.download.mockResolvedValue({ data: blob([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), error: null });
    expect(await submitB2CHomeworkAction({}, submitForm())).toHaveProperty("success");
  });

  it.each([createB2CHomeworkAction, submitB2CHomeworkAction])("does not finalize when actual Storage metadata differs", async (action) => {
    mocks.info.mockResolvedValue({ data: { contentType: "application/pdf", size: 101 }, error: null });
    expect(await action({}, action === createB2CHomeworkAction ? createForm() : submitForm())).toHaveProperty("error");
    expect(mocks.download).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it.each([
    { data: { contentType: "text/html", size: 100 }, error: null },
    { data: null, error: { message: "Missing" } },
    { data: { contentType: "application/pdf", size: B2C_HOMEWORK_MAX_BYTES + 1 }, error: null },
  ])("rejects missing or mismatched Storage metadata %j", async (result) => {
    mocks.info.mockResolvedValue(result);
    expect(await createB2CHomeworkAction({}, createForm())).toHaveProperty("error");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it.each([
    { data: blob([60, 104, 116, 109, 108]), error: null },
    { data: blob([0x25, 0x50, 0x44, 0x46, 0x2d], 99), error: null },
    { data: null, error: { message: "Download unavailable" } },
  ])("rejects false signatures, truncated or unreadable files", async (result) => {
    mocks.download.mockResolvedValue(result);
    expect(await createB2CHomeworkAction({}, createForm())).toHaveProperty("error");
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("does not publish an image as an assignment, even with a valid owned upload", async () => {
    mocks.rpc.mockResolvedValue({ ...stored, file_name: "Bài.png", mime_type: "image/png" });
    expect(await createB2CHomeworkAction({}, createForm())).toEqual({ error: "Đề bài phải là tệp PDF." });
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("preserves deadline failures from DB instead of reporting a successful submission", async () => {
    mocks.rpc.mockImplementation(async (name: string) => {
      if (name === "read_b2c_homework_file") return stored;
      throw new Error("Đã quá hạn nộp bài.");
    });
    expect(await submitB2CHomeworkAction({}, submitForm())).toEqual({ error: "Đã quá hạn nộp bài." });
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });

  it("rejects malformed dates before reading Storage or mutating", async () => {
    const input = createForm(); input.set("due_at", "2026-02-30T10:00");
    expect(await createB2CHomeworkAction({}, input)).toHaveProperty("fieldErrors.due_at");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("edits metadata with a stale-data guard and never replaces the assignment file", async () => {
    expect(await updateB2CHomeworkAction({}, form({ ...details, id, expected_updated_at: expected }))).toHaveProperty("success");
    expect(mocks.rpc).toHaveBeenCalledWith("update_b2c_homework", {
      p_id: id, p_title: details.title, p_description: details.description,
      p_due_at: "2026-11-28T13:30:00.000Z", p_expected_updated_at: expected,
    });
    expect(mocks.info).not.toHaveBeenCalled();
  });

  it("archives by ID and expected timestamp without deleting historical files", async () => {
    expect(await archiveB2CHomeworkAction({}, form({ id, expected_updated_at: expected }))).toHaveProperty("success");
    expect(mocks.rpc).toHaveBeenCalledWith("archive_b2c_homework", { p_id: id, p_expected_updated_at: expected });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("does not swallow an authentication redirect", async () => {
    mocks.teaching.mockRejectedValue(new Error("NEXT_REDIRECT"));
    await expect(createB2CHomeworkAction({}, createForm())).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe("B2C homework reads and private file links", () => {
  it("passes class scope and pagination through the authenticated RPC", async () => {
    const result = { rows: [], total: 0 }; mocks.rpc.mockResolvedValue(result);
    expect(await readB2CHomeworkAction(null, 2)).toEqual(result);
    expect(mocks.rpc).toHaveBeenCalledWith("read_b2c_homework_page", { p_class_id: null, p_page: 2 });
    await readB2CHomeworkSubmissionsAction(id, 1);
    expect(mocks.teaching).toHaveBeenCalledWith("super_admin");
    expect(mocks.rpc).toHaveBeenLastCalledWith("read_b2c_homework_submissions", { p_homework_id: id, p_page: 1 });
  });

  it("throws read errors rather than replacing them with an empty list", async () => {
    mocks.rpc.mockRejectedValue(new Error("Không có quyền xem lớp."));
    await expect(readB2CHomeworkAction(id)).rejects.toThrow("Không có quyền xem lớp.");
    await expect(readB2CHomeworkSubmissionsAction(id)).rejects.toThrow("Không có quyền xem lớp.");
    await expect(readB2CHomeworkSubmissionHistoryAction(id)).rejects.toThrow("Không có quyền xem lớp.");
  });

  it("requests own history through a null enrollment and preserves explicit staff roster scope", async () => {
    const result = { rows: [], total: 0 }; mocks.rpc.mockResolvedValue(result);
    expect(await readB2CHomeworkSubmissionHistoryAction(id)).toEqual(result);
    expect(mocks.rpc).toHaveBeenCalledWith("read_b2c_homework_submission_history", { p_homework_id: id, p_enrollment_id: null, p_page: 0 });
    await readB2CHomeworkSubmissionHistoryAction(id, uploadId, 2);
    expect(mocks.rpc).toHaveBeenLastCalledWith("read_b2c_homework_submission_history", { p_homework_id: id, p_enrollment_id: uploadId, p_page: 2 });
  });

  it("rejects malformed page and IDs before calling the database", async () => {
    await expect(readB2CHomeworkAction("bad", 0)).rejects.toThrow();
    await expect(readB2CHomeworkAction(id, -1)).rejects.toThrow();
    await expect(readB2CHomeworkSubmissionsAction(id, 1.5)).rejects.toThrow();
    await expect(readB2CHomeworkSubmissionHistoryAction(id, "bad", 0)).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("signs a short-lived file URL only after checking the assignment ID", async () => {
    expect(await getB2CHomeworkFileUrlAction("assignment", id)).toEqual({ url: "https://storage.example/private/signed", fileName: "Bài.pdf" });
    expect(mocks.rpc).toHaveBeenCalledWith("read_b2c_homework_file", { p_kind: "assignment", p_id: id });
    expect(mocks.fileUrl).toHaveBeenCalledWith(path, 120);
  });

  it("does not expose pending-upload or arbitrary-path download URLs", async () => {
    expect(await getB2CHomeworkFileUrlAction("upload", id)).toHaveProperty("error");
    expect(await getB2CHomeworkFileUrlAction("assignment", path)).toHaveProperty("error");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.fileUrl).not.toHaveBeenCalled();
  });

  it("does not sign a link when authorization is revoked", async () => {
    mocks.rpc.mockRejectedValue(new Error("Không có quyền xem tệp."));
    expect(await getB2CHomeworkFileUrlAction("submission", id)).toEqual({ error: "Không có quyền xem tệp." });
    expect(mocks.fileUrl).not.toHaveBeenCalled();
  });
});
