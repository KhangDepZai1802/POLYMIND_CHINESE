import ExcelJS from "exceljs";

import { INVOICE_STATUS_LABELS } from "@/lib/domain/labels";

import type { AdminTuitionReport } from "./server/admin-queries";

const headers = [
  "Mã hóa đơn",
  "Ngày phát hành",
  "Hạn thanh toán",
  "Mã học viên",
  "Học viên",
  "Mã lớp",
  "Lớp",
  "Trạng thái",
  "Tổng tiền",
  "Đã thanh toán",
  "Còn lại",
] as const;

function safeSpreadsheetText(value: string) {
  return /^[=+\-@]/.test(value) ? `'${value}` : value;
}

function values(report: AdminTuitionReport) {
  return report.rows.map((row) => [
    safeSpreadsheetText(row.invoice_code ?? ""),
    row.issue_date ?? "",
    row.due_date ?? "",
    safeSpreadsheetText(row.student?.student_code ?? ""),
    safeSpreadsheetText(row.student?.full_name ?? ""),
    safeSpreadsheetText(row.class?.code ?? ""),
    safeSpreadsheetText(row.class?.name ?? ""),
    row.status ? INVOICE_STATUS_LABELS[row.status] : "",
    row.total,
    row.paid_amount,
    row.balance,
  ]);
}

function csvCell(value: string | number) {
  const text = String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function createReportCsv(report: AdminTuitionReport) {
  const lines = [headers, ...values(report)].map((row) =>
    row.map(csvCell).join(","),
  );
  return `\uFEFF${lines.join("\r\n")}`;
}

export async function createReportXlsx(report: AdminTuitionReport) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "POLYMIND CHINESE";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Học phí");
  sheet.addRow([...headers]);
  for (const row of values(report)) sheet.addRow(row);

  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: "K1" };
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF2563EB" },
  };
  sheet.columns = [16, 15, 15, 16, 26, 14, 26, 18, 18, 18, 18].map(
    (width) => ({ width }),
  );
  for (const column of [9, 10, 11]) {
    sheet.getColumn(column).numFmt = "#,##0 [$₫-vi-VN]";
  }

  return workbook.xlsx.writeBuffer();
}
