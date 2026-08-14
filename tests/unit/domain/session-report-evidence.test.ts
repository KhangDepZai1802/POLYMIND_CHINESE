import { describe, expect, it } from "vitest";

import {
  evidenceFileName,
  formatEvidenceBytes,
} from "@/features/session-reports/domain/evidence";
import {
  BLANK,
  buildReportSections,
  type RenderEvidence,
  type ReportForRender,
} from "@/features/session-reports/domain/render";

/**
 * 🔴 `TEACHER-REPORT-3` — ghim lại lỗi user báo 2026-08-14: mục 8 của bản DOCX
 * và bản in chỉ hiện dòng *"3 tệp đính kèm"*, còn ba tệp đó thì không thấy đâu.
 *
 * Gốc lỗi nằm ở tầng dựng nội dung: `ReportForRender` chỉ mang theo một con số
 * `evidenceCount`, nên KHÔNG bề mặt nào có thể hiện ảnh kể cả khi muốn. Bài kiểm
 * ở đây canh đúng chỗ đó — mục 8 phải mang theo cả danh sách tệp.
 */

function evidence(overrides: Partial<RenderEvidence> = {}): RenderEvidence {
  return {
    id: "ev-1",
    fileName: "IMG_2201.webp",
    bytes: 204_800,
    storagePath: "uid/session/uuid-IMG_2201.webp",
    url: "https://storage.example/signed",
    ...overrides,
  };
}

function report(overrides: Partial<ReportForRender> = {}): ReportForRender {
  return {
    session: {
      classCode: "LOP-02",
      className: "Sơ cấp 2",
      teacherName: "Cô Lan",
      startsAt: "14/08/2026",
      startTime: "18:00",
      endsAt: "19:30",
      sessionNumber: 12,
      lessonTitle: "Bài 11",
      lessonLog: "Đã dạy xong",
      teacherNote: null,
    },
    report: { evidence_kinds: ["classroom_photo"] },
    students: [],
    evidence: [],
    snapshot: null,
    ...overrides,
  };
}

function section8(data: ReportForRender) {
  return buildReportSections(data).find((item) => item.number === 8)!;
}

describe("mục 8 — bản in/DOCX phải mang theo CHÍNH các tệp, không chỉ con số", () => {
  it("🔴 ba tệp đính kèm ⇒ mục 8 mang theo cả ba, kèm tên đọc được", () => {
    const files = [
      evidence({ id: "a", fileName: "bang-giang.webp" }),
      evidence({ id: "b", fileName: "bai-tap.webp" }),
      evidence({ id: "c", fileName: "tai-lieu.webp" }),
    ];

    const section = section8(report({ evidence: files }));

    // Đây là vế mà bản cũ không có: danh sách tệp đi kèm mục.
    expect(section.images).toHaveLength(3);
    expect(section.images?.map((item) => item.id)).toEqual(["a", "b", "c"]);

    // Và dòng chữ nêu ĐÍCH DANH ba tệp, không chỉ đếm — bản in đen trắng gửi
    // cấp trên phải đọc được "ba tệp đó là gì".
    const line = section.lines.find((item) => item.label === "Tải file/hình ảnh");
    expect(line?.value).toContain("3 tệp đính kèm");
    expect(line?.value).toContain("bang-giang.webp");
    expect(line?.value).toContain("tai-lieu.webp");
  });

  it("không có tệp nào ⇒ in dấu gạch, KHÔNG bỏ dòng đi", () => {
    const section = section8(report({ evidence: [] }));

    expect(section.lines.find((item) => item.label === "Tải file/hình ảnh")?.value).toBe(
      BLANK,
    );
    expect(section.images).toHaveLength(0);
  });

  it("URL ký hỏng KHÔNG làm tệp biến mất khỏi mục — vẫn còn tên để đối chiếu", () => {
    const section = section8(
      report({ evidence: [evidence({ url: null, fileName: "anh-lop.webp" })] }),
    );

    expect(section.images).toHaveLength(1);
    expect(section.images?.[0]?.url).toBeNull();
    expect(
      section.lines.find((item) => item.label === "Tải file/hình ảnh")?.value,
    ).toContain("anh-lop.webp");
  });
});

describe("tên tệp minh chứng — bỏ chi tiết kỹ thuật, giữ thứ người đọc cần", () => {
  it("cắt tiền tố uuid do lúc tải lên sinh ra", () => {
    expect(
      evidenceFileName(
        "9f1c0f2e-1111-4222-8333-444455556666/6b1e/3a7d2c19-2b4e-4f0a-9c11-0a1b2c3d4e5f-IMG_2201.webp",
      ),
    ).toBe("IMG_2201.webp");
  });

  it("tệp không có tiền tố uuid ⇒ giữ nguyên đoạn cuối", () => {
    expect(evidenceFileName("uid/session/bang-giang.png")).toBe("bang-giang.png");
  });

  it("tên gốc mang dấu gạch ngang vẫn còn đủ chữ", () => {
    expect(
      evidenceFileName(
        "uid/session/3a7d2c19-2b4e-4f0a-9c11-0a1b2c3d4e5f-anh-bang-buoi-12.webp",
      ),
    ).toBe("anh-bang-buoi-12.webp");
  });

  it("đường dẫn chỉ có mỗi uuid + đuôi ⇒ KHÔNG trả về chuỗi rỗng", () => {
    // Cắt sạch thành "" thì bản in hiện một dòng trống không nói lên gì; thà
    // hiện một cái tên xấu.
    const raw = "3a7d2c19-2b4e-4f0a-9c11-0a1b2c3d4e5f-";
    expect(evidenceFileName(`uid/session/${raw}`)).toBe(raw);
  });
});

describe("cỡ tệp đọc bằng mắt", () => {
  it("đổi đơn vị theo ngưỡng", () => {
    expect(formatEvidenceBytes(512)).toBe("512 B");
    expect(formatEvidenceBytes(204_800)).toBe("200 KB");
    expect(formatEvidenceBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });

  it("số vô nghĩa ⇒ dấu gạch, không phải 'NaN B'", () => {
    expect(formatEvidenceBytes(0)).toBe("—");
    expect(formatEvidenceBytes(Number.NaN)).toBe("—");
  });
});
