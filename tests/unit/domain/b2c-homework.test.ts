import { describe, expect, it } from "vitest";
import {
  B2C_HOMEWORK_BUCKET,
  B2C_HOMEWORK_MAX_BYTES,
  b2cHomeworkCreateSchema,
  b2cHomeworkStoredFileSchema,
  b2cHomeworkUploadSchema,
  homeworkDeadlineToUtc,
  homeworkFileSignatureMatches,
} from "@/features/b2c/domain/homework";

const id = "11111111-1111-4111-8111-111111111111";
const upload = {
  class_id: id, homework_id: null, kind: "assignment", file_name: "Bài tập.pdf",
  mime_type: "application/pdf", size_bytes: 100, request_id: id,
};

describe("B2C homework validation", () => {
  it("converts a Vietnamese local deadline to UTC independently of host timezone", () => {
    expect(homeworkDeadlineToUtc("2026-11-27T20:30")).toBe("2026-11-27T13:30:00.000Z");
    expect(homeworkDeadlineToUtc("2028-02-29T00:15")).toBe("2028-02-28T17:15:00.000Z");
  });

  it.each(["2026-02-29T10:00", "2026-04-31T10:00", "2026-11-27T24:00", "2026-11-27T10:60", "2026-11-27T20:30Z", "2026-11-27", "", "1899-12-01T10:00"])(
    "rejects nonexistent or ambiguous local deadline %s", (value) => {
      expect(() => homeworkDeadlineToUtc(value)).toThrow();
    },
  );

  it("allows PDF assignment and all supported student file formats", () => {
    expect(b2cHomeworkUploadSchema.safeParse(upload).success).toBe(true);
    for (const [file_name, mime_type] of [["BÀI.PDF", "application/pdf"], ["bai.jpg", "image/jpeg"], ["bai.jpeg", "image/jpeg"], ["bai.png", "image/png"]]) {
      expect(b2cHomeworkUploadSchema.safeParse({ ...upload, kind: "submission", homework_id: id, file_name, mime_type }).success).toBe(true);
    }
  });

  it.each([
    { file_name: "bad.pdf.exe" }, { file_name: "../bai.pdf" }, { file_name: "dir\\bai.pdf" },
    { file_name: "bai\u0000.pdf" }, { file_name: "bad.jpg", mime_type: "image/jpeg" },
    { mime_type: "text/html" }, { mime_type: "application/pdf; charset=utf-8" },
    { size_bytes: 0 }, { size_bytes: 1.5 }, { size_bytes: B2C_HOMEWORK_MAX_BYTES + 1 },
    { size_bytes: "100" }, { class_id: null }, { homework_id: id }, { request_id: "bad" },
  ])("rejects unsupported or malformed assignment upload %j", (change) => {
    expect(b2cHomeworkUploadSchema.safeParse({ ...upload, ...change }).success).toBe(false);
  });

  it("requires a homework ID for student uploads and accepts the exact size limit", () => {
    expect(b2cHomeworkUploadSchema.safeParse({ ...upload, kind: "submission" }).success).toBe(false);
    expect(b2cHomeworkUploadSchema.safeParse({ ...upload, kind: "submission", homework_id: id, class_id: null }).success).toBe(false);
    expect(b2cHomeworkUploadSchema.safeParse({ ...upload, size_bytes: B2C_HOMEWORK_MAX_BYTES }).success).toBe(true);
  });

  it("validates file signatures rather than trusting extensions", () => {
    const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(homeworkFileSignatureMatches(pdf, "application/pdf")).toBe(true);
    expect(homeworkFileSignatureMatches(jpg, "image/jpeg")).toBe(true);
    expect(homeworkFileSignatureMatches(png, "image/png")).toBe(true);
    expect(homeworkFileSignatureMatches(jpg, "application/pdf")).toBe(false);
    expect(homeworkFileSignatureMatches(pdf.subarray(0, 4), "application/pdf")).toBe(false);
    expect(homeworkFileSignatureMatches(pdf, "text/html")).toBe(false);
    expect(homeworkFileSignatureMatches(new Uint8Array([60, 104, 116, 109, 108]), "application/pdf")).toBe(false);
  });

  it("accepts only the private bucket and a valid server-issued object path", () => {
    const stored = { object_path: `${id}/assignment/${id}.pdf`, file_name: "Bài.pdf", mime_type: "application/pdf", size_bytes: 100, bucket: B2C_HOMEWORK_BUCKET };
    expect(b2cHomeworkStoredFileSchema.safeParse(stored).success).toBe(true);
    for (const change of [{ bucket: "public-files" }, { object_path: "../file.pdf" }, { object_path: "/file.pdf" }, { object_path: "a//file.pdf" }, { object_path: "a\\file.pdf" }]) {
      expect(b2cHomeworkStoredFileSchema.safeParse({ ...stored, ...change }).success).toBe(false);
    }
  });

  it("requires a title, upload ID and retry ID for publication", () => {
    const base = { title: "Bài đọc", description: "Đọc và trả lời.", due_at: "2026-11-27T20:30", upload_id: id, request_id: id };
    expect(b2cHomeworkCreateSchema.safeParse(base).success).toBe(true);
    for (const change of [{ title: " " }, { upload_id: "" }, { request_id: "" }, { description: "a".repeat(4001) }]) {
      expect(b2cHomeworkCreateSchema.safeParse({ ...base, ...change }).success).toBe(false);
    }
  });
});
