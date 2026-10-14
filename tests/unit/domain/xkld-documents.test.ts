import { describe, it, expect } from "vitest";
import {
  documentStatus,
  hasDocumentSignature,
  uploadSchema,
  type DocumentRow,
} from "@/features/xkld/domain/documents";
const row = {
  requirement: { expects_expiry: true },
  document: { submitted_on: "2026-10-01", expires_on: "2026-10-20" },
} as DocumentRow;
describe("XKLĐ documents", () => {
  it("uses explicit submission and expiry dates", () => {
    expect(documentStatus({ ...row, document: null }, "2026-10-14")).toBe(
      "Chưa nộp",
    );
    expect(documentStatus(row, "2026-10-14")).toBe("Sắp hết hạn");
    expect(documentStatus(row, "2026-10-21")).toBe("Hết hạn");
    expect(
      documentStatus(
        { ...row, document: { ...row.document!, expires_on: null } },
        "2026-10-14",
      ),
    ).toBe("Thiếu ngày hết hạn");
  });
  it("keeps the 30-day boundary inclusive across months", () => {
    expect(
      documentStatus(
        { ...row, document: { ...row.document!, expires_on: "2026-11-13" } },
        "2026-10-14",
      ),
    ).toBe("Sắp hết hạn");
    expect(
      documentStatus(
        { ...row, document: { ...row.document!, expires_on: "2026-11-14" } },
        "2026-10-14",
      ),
    ).toBe("Đã nộp");
  });
  it("rejects renamed or truncated file signatures", () => {
    expect(
      hasDocumentSignature(
        new Uint8Array([37, 80, 68, 70, 45]),
        "application/pdf",
      ),
    ).toBe(true);
    expect(
      hasDocumentSignature(
        new Uint8Array([60, 104, 116, 109, 108]),
        "application/pdf",
      ),
    ).toBe(false);
    expect(hasDocumentSignature(new Uint8Array([137, 80]), "image/png")).toBe(
      false,
    );
    expect(
      hasDocumentSignature(new Uint8Array([255, 216, 255]), "image/jpeg"),
    ).toBe(true);
  });
  it("rejects file paths, oversized files, and mismatched extensions", () => {
    const value = {
      candidate_id: "73000000-0000-4000-8000-000000000001",
      requirement_id: "73000000-0000-4000-8000-000000000002",
      request_id: "73000000-0000-4000-8000-000000000003",
      file_name: "hồ sơ.pdf",
      mime_type: "application/pdf",
      size_bytes: 1024,
    };
    expect(uploadSchema.safeParse(value).success).toBe(true);
    for (const patch of [
      { file_name: "../a.pdf" },
      { size_bytes: 10485761 },
      { file_name: "a.html" },
      { mime_type: "text/html" },
    ])
      expect(uploadSchema.safeParse({ ...value, ...patch }).success).toBe(
        false,
      );
  });
});
