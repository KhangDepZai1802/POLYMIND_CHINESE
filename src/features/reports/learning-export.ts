// ExcelJS nặng ~1MB — cùng lý do `export.ts`: chặn cứng khỏi bundle client.
import "server-only";

import ExcelJS from "exceljs";

import { ENROLLMENT_STATUS_LABELS } from "@/lib/domain/labels";
import type { Database } from "@/types/database";

import { csvCell, safeSpreadsheetText } from "./export";
import type {
  LearningOverview,
  LearningStudentRow,
} from "./server/learning-queries";

type EnrollmentStatus = Database["public"]["Enums"]["enrollment_status"];

/**
 * Export báo cáo HỌC TẬP (AC4.2/AC4.3) — giữ đúng kỳ đang lọc (bài học
 * `BUG_M16_01`): route nhận cùng bộ tham số `from/to/range` với trang.
 *
 * XLSX có HAI sheet: "Theo lớp" (tổng hợp) + "Theo học viên" (mỗi em một
 * dòng). CSV không có khái niệm sheet nên chỉ chứa phần theo học viên — phần
 * dữ liệu chi tiết mà người nhận file cần xử lý tiếp.
 */

const CLASS_HEADERS = [
  "Mã lớp",
  "Lớp",
  "Sĩ số đang học",
  "Buổi trong kỳ",
  "Chuyên cần kỳ (%)",
  "Điểm TB kỳ (/100)",
  "Tiến độ khóa (%)",
  "Cần chú ý",
] as const;

const STUDENT_HEADERS = [
  "Mã học viên",
  "Học viên",
  "Mã lớp",
  "Lớp",
  "Trạng thái ghi danh",
  "Buổi trong kỳ",
  "Có mặt",
  "Đi muộn",
  "Vắng",
  "Có phép",
  "Chưa điểm danh",
  "Chuyên cần kỳ (%)",
  "Điểm TB kỳ (/100)",
  "Bài đã nộp",
  "Tổng bài tập",
  "Tiến độ khóa (%)",
  "Lý do cần chú ý",
] as const;

function classValues(overview: LearningOverview) {
  return overview.classes.map((row) => [
    safeSpreadsheetText(row.code),
    safeSpreadsheetText(row.name),
    row.activeStudents,
    row.sessionsInPeriod,
    row.attendanceRate ?? "",
    row.avgScore ?? "",
    row.progressPercent ?? "",
    row.atRiskCount,
  ]);
}

function studentValues(rows: LearningStudentRow[]) {
  return rows.map((row) => [
    safeSpreadsheetText(row.studentCode),
    safeSpreadsheetText(row.fullName),
    safeSpreadsheetText(row.classCode),
    safeSpreadsheetText(row.className),
    ENROLLMENT_STATUS_LABELS[row.enrollmentStatus as EnrollmentStatus] ??
      row.enrollmentStatus,
    row.attendance.totalSessions,
    row.attendance.present,
    row.attendance.late,
    row.attendance.absent,
    row.attendance.excused,
    row.attendance.unmarked,
    row.attendance.rate ?? "",
    row.periodAvgScore ?? "",
    row.submittedExercises,
    row.totalExercises,
    row.progressPercent ?? "",
    safeSpreadsheetText(row.riskReasons.join(" · ")),
  ]);
}

const CSV_BOM = String.fromCharCode(0xfeff);
const CSV_EOL = String.fromCharCode(13, 10);

export function createLearningReportCsv(rows: LearningStudentRow[]) {
  const lines = [STUDENT_HEADERS as readonly (string | number)[]]
    .concat(studentValues(rows))
    .map((row) => row.map(csvCell).join(","));
  // BOM + CRLF để Excel trên Windows nhận UTF-8 — cùng lý do `createReportCsv`.
  return CSV_BOM + lines.join(CSV_EOL);
}

export async function createLearningReportXlsx(
  overview: LearningOverview,
  rows: LearningStudentRow[],
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "POLYMIND CHINESE";
  workbook.created = new Date();

  const styleHeader = (sheet: ExcelJS.Worksheet, lastColumn: string) => {
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: "A1", to: `${lastColumn}1` };
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF2563EB" },
    };
  };

  const classSheet = workbook.addWorksheet("Theo lớp");
  classSheet.addRow([...CLASS_HEADERS]);
  for (const row of classValues(overview)) classSheet.addRow(row);
  styleHeader(classSheet, "H");
  classSheet.columns = [12, 30, 14, 14, 18, 18, 16, 12].map((width) => ({
    width,
  }));

  const studentSheet = workbook.addWorksheet("Theo học viên");
  studentSheet.addRow([...STUDENT_HEADERS]);
  for (const row of studentValues(rows)) studentSheet.addRow(row);
  styleHeader(studentSheet, "Q");
  studentSheet.columns = [
    14, 26, 10, 26, 18, 12, 9, 9, 9, 9, 14, 16, 16, 12, 12, 16, 30,
  ].map((width) => ({ width }));

  return workbook.xlsx.writeBuffer();
}
