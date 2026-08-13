// `docx` chỉ chạy phía server. Chặn cứng ở đây: lỡ bị import từ Client
// Component thì build đỏ ngay thay vì âm thầm nhồi cả thư viện vào bundle của
// trình duyệt — cùng cách `features/reports/export.ts` giữ `exceljs`.
import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { CONFIRMATION_TEXT } from "../domain/labels";
import { BLANK, buildReportSections, type ReportForRender } from "../domain/render";

const BRAND = "1A5FA8";
const INK = "10243F";
const MUTED = "5B6B80";
const LINE = "DDE5EE";

/**
 * Bản xuất DOCX của báo cáo buổi dạy (`D-43` điểm 3).
 *
 * =============================================================================
 * NỘI DUNG ĐÚNG Y MẪU · TRÌNH BÀY THIẾT KẾ LẠI
 * =============================================================================
 *
 * Nội dung lấy từ `buildReportSections()` — CÙNG hàm mà bản xem trên web và bản
 * in PDF dùng. Ba đường xuất mà lắp nội dung ba lần là có ngày nói ba chuyện
 * khác nhau về cùng một buổi dạy.
 *
 * Trình bày thì không copy khuôn Word gốc: tiêu đề mục có số trong ô xanh, mỗi
 * mục là một bảng hai cột nhãn/giá trị, thang điểm in đúng dòng được chọn kèm
 * dãy chấm chỉ vị trí. Ô trống in `—` chứ không bỏ dòng.
 */
export async function buildSessionReportDocx(
  reports: ReportForRender[],
  meta: { periodLabel: string; generatedAt: string },
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  reports.forEach((report, index) => {
    if (index > 0) {
      children.push(new Paragraph({ text: "", pageBreakBefore: true }));
    }
    children.push(...renderOne(report, meta));
  });

  if (reports.length === 0) {
    children.push(
      new Paragraph({
        text: "Không có báo cáo nào trong kỳ đang chọn.",
        spacing: { before: 400 },
      }),
    );
  }

  const doc = new Document({
    creator: "POLYMIND CHINESE",
    title: "Báo cáo sau buổi học — Giáo viên",
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 24, color: INK },
          paragraph: { spacing: { line: 276 } },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            // A4, lề 20mm — 1mm = 56.7 twip.
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

function renderOne(
  data: ReportForRender,
  meta: { periodLabel: string; generatedAt: string },
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];

  // --- Đầu trang -------------------------------------------------------------
  out.push(
    new Paragraph({
      children: [
        new TextRun({
          text: "POLYMIND CHINESE",
          bold: true,
          size: 18,
          color: BRAND,
        }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [
        new TextRun({
          text: "BÁO CÁO SAU BUỔI HỌC — GIÁO VIÊN",
          bold: true,
          size: 30,
          color: INK,
        }),
      ],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 12, color: BRAND, space: 6 },
      },
      spacing: { after: 160 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${data.session.classCode} · Buổi ${data.session.sessionNumber} · ${data.session.startsAt}`,
          size: 20,
          color: MUTED,
        }),
      ],
      spacing: { after: 200 },
    }),
  );

  // --- Chín mục --------------------------------------------------------------
  for (const section of buildReportSections(data)) {
    out.push(
      new Paragraph({
        children: [
          new TextRun({ text: `${section.number}. `, bold: true, color: BRAND, size: 24 }),
          new TextRun({ text: section.title.toUpperCase(), bold: true, size: 24 }),
        ],
        spacing: { before: 260, after: 80 },
        keepNext: true,
      }),
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 2, color: LINE },
          bottom: { style: BorderStyle.SINGLE, size: 2, color: LINE },
          left: { style: BorderStyle.NONE, size: 0, color: LINE },
          right: { style: BorderStyle.NONE, size: 0, color: LINE },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: LINE },
          insideVertical: { style: BorderStyle.NONE, size: 0, color: LINE },
        },
        rows: section.lines.map(
          (line) =>
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 38, type: WidthType.PERCENTAGE },
                  margins: { top: 60, bottom: 60, left: 80, right: 80 },
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({ text: line.label, color: MUTED, size: 21 }),
                      ],
                    }),
                  ],
                }),
                new TableCell({
                  width: { size: 62, type: WidthType.PERCENTAGE },
                  margins: { top: 60, bottom: 60, left: 80, right: 80 },
                  children: [
                    new Paragraph({
                      children: [
                        // Dãy chấm chỉ vị trí trên thang — thay cho 5 dòng ☐ của
                        // bản mẫu Word. Không mất chữ nào, bớt 4 dòng thừa.
                        ...(line.scale
                          ? [
                              new TextRun({
                                text:
                                  "●".repeat(line.scale.value) +
                                  "○".repeat(line.scale.max - line.scale.value) +
                                  "  ",
                                color: BRAND,
                                size: 20,
                              }),
                            ]
                          : []),
                        new TextRun({
                          text: line.value,
                          size: 21,
                          bold: line.value !== BLANK && Boolean(line.scale),
                          color: line.value === BLANK ? MUTED : INK,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
        ),
      }),
    );
  }

  // --- Xác nhận --------------------------------------------------------------
  out.push(
    new Paragraph({
      children: [new TextRun({ text: "XÁC NHẬN", bold: true, size: 24, color: BRAND })],
      spacing: { before: 320, after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: data.report.confirmed ? `☑ ${CONFIRMATION_TEXT}` : `☐ ${CONFIRMATION_TEXT}`,
          size: 21,
        }),
      ],
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `Người gửi: ${data.session.teacherName}`,
          size: 20,
          color: MUTED,
        }),
      ],
      spacing: { before: 60 },
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [
        new TextRun({
          text: `Kỳ báo cáo: ${meta.periodLabel} · Xuất lúc ${meta.generatedAt}`,
          size: 18,
          color: MUTED,
        }),
      ],
      spacing: { before: 240 },
    }),
  );

  return out;
}
