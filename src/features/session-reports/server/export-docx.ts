// `docx` chỉ chạy phía server. Chặn cứng ở đây: lỡ bị import từ Client
// Component thì build đỏ ngay thay vì âm thầm nhồi cả thư viện vào bundle của
// trình duyệt — cùng cách `features/reports/export.ts` giữ `exceljs`.
import "server-only";

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from "docx";

import { formatEvidenceBytes } from "../domain/evidence";
import { CONFIRMATION_TEXT } from "../domain/labels";
import {
  BLANK,
  buildReportSections,
  type RenderEvidence,
  type ReportForRender,
} from "../domain/render";
import type { EvidenceImage } from "./evidence-images";

const BRAND = "1A5FA8";
const INK = "10243F";
const MUTED = "5B6B80";
const LINE = "DDE5EE";

/**
 * =============================================================================
 * 🔴 BỀ NGANG BẢNG PHẢI TÍNH BẰNG TWIP, KHÔNG BAO GIỜ BẰNG PHẦN TRĂM
 * =============================================================================
 *
 * User báo 2026-08-14 kèm ảnh: file DOCX mở ra thì cả bảng co lại thành một dải
 * hẹp ở mép trái, *"LOP-03 — VCB — Tiếng Trung ngân hàng (Lớp 03)"* xuống **năm
 * dòng**, còn 70% bề ngang trang thì bỏ trắng.
 *
 * Nguyên nhân đọc được thẳng trong `word/document.xml` của file sinh ra:
 *
 *   <w:tblGrid><w:gridCol w:w="100"/><w:gridCol w:w="100"/></w:tblGrid>
 *   <w:tblW w:type="pct" w:w="100%"/>
 *
 * `w:tblGrid` là thứ Word DỰNG BẢNG THEO, và nó đang khai mỗi cột **100 twip
 * ≈ 0,18 cm** — cả bảng 0,35 cm. `docx` sinh ra con số đó vì ta không truyền
 * `columnWidths`, nên nó không có gì để suy ra bề ngang thật. Vế `w:tblW` khai
 * `"100%"` cũng sai kiểu: `w:w` của `pct` phải là **số nguyên phần-năm-mươi của
 * một phần trăm** (5000 = 100%), chuỗi `"100%"` chỉ vài trình đọc chấp nhận —
 * Word trên điện thoại thì không.
 *
 * Nên: khai bề ngang **tuyệt đối bằng twip** cho cả bảng lẫn từng ô, kèm
 * `layout: FIXED` để Word dựng đúng con số đã khai thay vì tự co giãn theo nội
 * dung. Phần trăm ở đây không có gì để bám vào, còn twip thì có: khổ giấy.
 */

/** A4 rộng 210mm, lề 20mm mỗi bên ⇒ lòng trang 170mm. 1mm = 56,7 twip. */
const CONTENT_WIDTH = Math.round(170 * 56.7); // 9639

/** Cột nhãn 38% · cột giá trị 62% — đúng tỉ lệ bản xem trên web. */
const LABEL_WIDTH = Math.round(CONTENT_WIDTH * 0.38);
const VALUE_WIDTH = CONTENT_WIDTH - LABEL_WIDTH;

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
 *
 * `images` là nhị phân ảnh minh chứng đã chuẩn hoá (`loadEvidenceImages`), tra
 * theo `evidence.id`. Thiếu khoá nào thì mục 8 in một dòng chữ nêu tên tệp thay
 * cho ảnh — xem `renderEvidence`.
 */
export async function buildSessionReportDocx(
  reports: ReportForRender[],
  meta: { periodLabel: string; generatedAt: string },
  images: Map<string, EvidenceImage> = new Map(),
): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [];

  reports.forEach((report, index) => {
    if (index > 0) {
      children.push(new Paragraph({ text: "", pageBreakBefore: true }));
    }
    children.push(...renderOne(report, meta, images));
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
  images: Map<string, EvidenceImage>,
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
        width: { size: CONTENT_WIDTH, type: WidthType.DXA },
        columnWidths: [LABEL_WIDTH, VALUE_WIDTH],
        layout: TableLayoutType.FIXED,
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
                  width: { size: LABEL_WIDTH, type: WidthType.DXA },
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
                  width: { size: VALUE_WIDTH, type: WidthType.DXA },
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

    // Ảnh minh chứng đi NGAY SAU bảng của chính mục đó, không dồn xuống cuối
    // file: dòng "Tải file/hình ảnh" nói có 3 tệp thì 3 tệp phải nằm ngay đó.
    if (section.images?.length) {
      out.push(...renderEvidence(section.images, images));
    }
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

// =============================================================================
// Mục 8 — ẢNH THẬT, không phải con số đếm
// =============================================================================

/** Hai ảnh một hàng: bốn ảnh khổ trang thì báo cáo nào cũng dài thêm 4 trang. */
const EVIDENCE_COLUMNS = 2;

/** Cùng luật twip với bảng nhãn/giá trị — xem khối chú thích ở đầu file. */
const EVIDENCE_COLUMN_WIDTH = Math.floor(CONTENT_WIDTH / EVIDENCE_COLUMNS);

/**
 * Khung tối đa cho mỗi ảnh, tính bằng pixel ở 96 DPI — đúng đơn vị mà
 * `transformation` của `docx` nhận.
 *
 * A4 lề 20mm còn 170mm ≈ 643px bề ngang; chia đôi rồi trừ lề ô còn ~290px.
 */
const EVIDENCE_BOX = { width: 290, height: 220 };

/** Thu ảnh vừa khung, GIỮ ĐÚNG TỈ LỆ và không bao giờ phóng to. */
function fitEvidenceBox(image: EvidenceImage): { width: number; height: number } {
  const ratio = Math.min(
    EVIDENCE_BOX.width / image.width,
    EVIDENCE_BOX.height / image.height,
    1,
  );
  return {
    width: Math.max(1, Math.round(image.width * ratio)),
    height: Math.max(1, Math.round(image.height * ratio)),
  };
}

function renderEvidence(
  items: RenderEvidence[],
  images: Map<string, EvidenceImage>,
): (Paragraph | Table)[] {
  const rows: TableRow[] = [];

  for (let index = 0; index < items.length; index += EVIDENCE_COLUMNS) {
    const slice = items.slice(index, index + EVIDENCE_COLUMNS);
    rows.push(
      new TableRow({
        // Một ảnh bị cắt đôi qua hai trang là bản in bỏ đi.
        cantSplit: true,
        children: Array.from({ length: EVIDENCE_COLUMNS }, (_, column) => {
          const item = slice[column];
          return new TableCell({
            width: { size: EVIDENCE_COLUMN_WIDTH, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            // Ô trống khi lô lẻ — bảng vẫn phải đủ cột, thiếu ô là Word vẽ lệch.
            children: item
              ? evidenceCell(item, images.get(item.id))
              : [new Paragraph({ text: "" })],
          });
        }),
      }),
    );
  }

  return [
    new Paragraph({
      children: [
        new TextRun({ text: "Ảnh minh chứng đính kèm", color: MUTED, size: 20 }),
      ],
      spacing: { before: 160, after: 60 },
      keepNext: true,
    }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: Array.from({ length: EVIDENCE_COLUMNS }, () => EVIDENCE_COLUMN_WIDTH),
      layout: TableLayoutType.FIXED,
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: LINE },
        bottom: { style: BorderStyle.NONE, size: 0, color: LINE },
        left: { style: BorderStyle.NONE, size: 0, color: LINE },
        right: { style: BorderStyle.NONE, size: 0, color: LINE },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: LINE },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: LINE },
      },
      rows,
    }),
  ];
}

function evidenceCell(
  item: RenderEvidence,
  image: EvidenceImage | undefined,
): Paragraph[] {
  const caption = new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: `${item.fileName} · ${formatEvidenceBytes(item.bytes)}`,
        size: 16,
        color: MUTED,
      }),
    ],
    spacing: { before: 40 },
  });

  // Ảnh không chuẩn hoá được thì NÓI RA, đừng để một ô trắng. Người đọc phải
  // phân biệt được "báo cáo không có ảnh" với "ảnh có mà file này không mang
  // theo được" — chỉ trường hợp thứ hai mới cần mở bản trên hệ thống.
  if (!image) {
    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({
            text: "[Không nhúng được ảnh — xem bản trên hệ thống]",
            size: 18,
            color: MUTED,
            italics: true,
          }),
        ],
      }),
      caption,
    ];
  }

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new ImageRun({
          type: image.type,
          data: image.data,
          transformation: fitEvidenceBox(image),
          altText: {
            name: item.fileName,
            title: item.fileName,
            description: `Minh chứng buổi học — ${item.fileName}`,
          },
        }),
      ],
    }),
    caption,
  ];
}
