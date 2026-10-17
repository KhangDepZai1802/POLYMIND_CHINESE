import ExcelJS from "exceljs";
import type { CertificateMarketingRow } from "./domain/certificate-results";

export function buildCertificateMarketingWorkbook(rows: CertificateMarketingRow[]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Kết quả chứng chỉ");
  sheet.columns = [
    { header: "Mã học viên", key: "student_code", width: 20 },
    { header: "Học viên", key: "full_name", width: 32 },
    { header: "Loại chứng chỉ", key: "certificate_type", width: 24 },
    { header: "Cấp độ / Bài thi", key: "level", width: 24 },
    { header: "Điểm / Xếp loại", key: "score", width: 22 },
    { header: "Ngày thi", key: "exam_date", width: 18 },
  ];
  for (const r of rows) sheet.addRow({ student_code: r.student_code, full_name: r.full_name, certificate_type: r.certificate_type, level: r.level, score: r.score, exam_date: r.exam_date.split("-").reverse().join("/") });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = "A1:F1";
  return workbook;
}
