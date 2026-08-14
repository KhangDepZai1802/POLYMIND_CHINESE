import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import JSZip from "jszip";
import sharp from "sharp";

import type { ReportForRender } from "@/features/session-reports/domain/render";
import { buildSessionReportDocx } from "@/features/session-reports/server/export-docx";
import type { EvidenceImage } from "@/features/session-reports/server/evidence-images";

/**
 * 🔴 `TEACHER-REPORT-3` — user báo 2026-08-14: mục 8 của file DOCX chỉ có dòng
 * chữ *"3 tệp đính kèm"*, ba tấm ảnh giáo viên gửi lên KHÔNG có trong file.
 *
 * Bài này mở file Word ra bằng `JSZip` và đếm `word/media/*` — tức đo THỨ THẬT
 * nằm trong file, không phải đo "hàm có được gọi không". Nếu ai đó lỡ tay bỏ
 * `renderEvidence` hoặc truyền nhầm định dạng cho `ImageRun`, phần này đỏ.
 *
 * ⚠️ Cũng chính là bài canh cái bẫy đã gây ra lỗi: `docx` KHÔNG nhận WebP, mà
 * ảnh minh chứng tải lên lại là WebP. Ở đây ảnh vào ở dạng PNG/JPEG đã chuẩn
 * hoá — việc chuyển đổi là phần của `loadEvidenceImages`.
 */

const META = { periodLabel: "Tháng 08/2026", generatedAt: "14/08/2026 09:00" };

function report(evidence: ReportForRender["evidence"]): ReportForRender {
  return {
    session: {
      classCode: "LOP-02",
      className: "Sơ cấp 2",
      teacherName: "Cô Lan",
      startsAt: "14/08/2026",
      endsAt: "19:30",
      sessionNumber: 12,
      lessonTitle: "Bài 11",
      lessonLog: "Đã dạy xong",
      teacherNote: null,
    },
    report: { evidence_kinds: ["classroom_photo"], confirmed: true },
    students: [],
    evidence,
    snapshot: null,
  };
}

function file(id: string, fileName: string) {
  return {
    id,
    fileName,
    bytes: 204_800,
    storagePath: `uid/session/${id}-${fileName}`,
    url: null,
  };
}

/** Ảnh thật, không phải buffer giả — `docx` đọc header để dựng quan hệ ảnh. */
async function pngImage(width: number, height: number): Promise<EvidenceImage> {
  const data = await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 20, g: 90, b: 160 },
    },
  })
    .png()
    .toBuffer();

  return { data, type: "png", width, height };
}

/**
 * Các TỆP trong `word/media` — chỗ Word cất ảnh nhúng.
 *
 * Lọc `dir` chứ không chỉ so tiền tố: JSZip liệt kê cả mục thư mục
 * (`"word/media/"`), đếm luôn cả nó là mọi con số lệch đúng 1.
 */
async function mediaEntries(buffer: Buffer): Promise<string[]> {
  const zip = await JSZip.loadAsync(buffer);
  return Object.entries(zip.files)
    .filter(([name, entry]) => !entry.dir && name.startsWith("word/media/"))
    .map(([name]) => name);
}

describe("DOCX mục 8 — ảnh minh chứng nằm THẬT trong file Word", () => {
  it("🔴 ba tệp đính kèm ⇒ ba ảnh trong word/media", async () => {
    const files = [
      file("a", "bang-giang.png"),
      file("b", "bai-tap.png"),
      file("c", "tai-lieu.png"),
    ];
    // Ba ảnh KHÁC kích thước: ba bản sao y hệt có thể bị gộp làm một, và lúc đó
    // bài kiểm sẽ xanh vì lý do sai.
    const images = new Map([
      ["a", await pngImage(800, 600)],
      ["b", await pngImage(640, 480)],
      ["c", await pngImage(500, 500)],
    ]);

    const buffer = await buildSessionReportDocx([report(files)], META, images);

    expect(await mediaEntries(buffer)).toHaveLength(3);
  });

  it("báo cáo không có minh chứng ⇒ không ảnh nào, file vẫn dựng được", async () => {
    const buffer = await buildSessionReportDocx([report([])], META);
    expect(await mediaEntries(buffer)).toHaveLength(0);
  });

  it("🔴 ảnh chuẩn hoá hỏng (thiếu khoá) KHÔNG đánh sập cả lượt xuất", async () => {
    // Đây là nhánh fail-open: `loadEvidenceImages` bỏ qua ảnh không tải/không
    // giải mã được, và file Word vẫn phải ra — chỉ thiếu đúng tấm ảnh đó.
    const image = await pngImage(400, 300);
    const files = [file("a", "co-anh.png"), file("b", "hong.png")];

    const buffer = await buildSessionReportDocx(
      [report(files)],
      META,
      new Map([["a", image]]),
    );

    expect(await mediaEntries(buffer)).toHaveLength(1);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

/**
 * Vế còn lại của cùng một lỗi: `docx` chỉ nhận `jpg | png | gif | bmp`. Bài này
 * ghim rằng WebP — định dạng mà bộ nén ở trình duyệt sinh ra — phải được CHUYỂN
 * trước khi tới `ImageRun`, chứ không phải nhét thẳng vào.
 */
describe("WebP phải được chuyển trước khi vào file Word", () => {
  it("sharp đọc được WebP và đổi sang PNG/JPEG giữ nguyên kích thước", async () => {
    const webp = await sharp({
      create: { width: 640, height: 480, channels: 3, background: "#0f5aa8" },
    })
      .webp()
      .toBuffer();

    expect((await sharp(webp).metadata()).format).toBe("webp");

    const { data, info } = await sharp(webp)
      .jpeg({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    expect(info.format).toBe("jpeg");
    expect(info.width).toBe(640);
    expect(info.height).toBe(480);

    // Và bản đã chuyển thì nhúng được thật.
    const buffer = await buildSessionReportDocx(
      [report([file("a", "anh-lop.webp")])],
      META,
      new Map([["a", { data, type: "jpg", width: info.width, height: info.height }]]),
    );

    expect(await mediaEntries(buffer)).toHaveLength(1);
  });
});
