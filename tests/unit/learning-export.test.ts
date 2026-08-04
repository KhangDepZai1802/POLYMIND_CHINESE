import { describe, expect, it, vi } from "vitest";

// Cùng lý do `report-export.test.ts`: vô hiệu hoá guard "server-only" ngoài RSC.
vi.mock("server-only", () => ({}));

import {
  createLearningReportCsv,
  createLearningReportXlsx,
} from "@/features/reports/learning-export";
import type {
  LearningOverview,
  LearningStudentRow,
} from "@/features/reports/server/learning-queries";

const studentRows: LearningStudentRow[] = [
  {
    studentCode: "HV001",
    fullName: "Nguyễn Văn Ngà",
    classCode: "LOP-01",
    className: "Tiếng Trung cơ bản",
    enrollmentStatus: "active",
    attendance: {
      present: 8,
      late: 1,
      absent: 1,
      excused: 0,
      unmarked: 0,
      totalSessions: 10,
      rate: 90,
    },
    periodAvgScore: 82.5,
    submittedExercises: 5,
    totalExercises: 6,
    progressPercent: 78.4,
    riskReasons: [],
  },
  {
    // Tên bắt đầu bằng "=" phải bị vô hiệu hóa formula như export học phí.
    studentCode: "=HV002",
    fullName: "Trần Bích",
    classCode: "LOP-01",
    className: "Tiếng Trung cơ bản",
    enrollmentStatus: "active",
    attendance: {
      present: 2,
      late: 0,
      absent: 8,
      excused: 0,
      unmarked: 0,
      totalSessions: 10,
      rate: 20,
    },
    periodAvgScore: null,
    submittedExercises: 1,
    totalExercises: 6,
    progressPercent: 21.3,
    riskReasons: ["Chuyên cần thấp", "Thiếu bài tập"],
  },
];

const overview = {
  period: { from: "2026-08-01", to: "2026-08-31", preset: "month", label: "Tháng 8/2026" },
  kpis: {
    activeStudents: 2,
    attendanceRate: 55,
    avgScore: 82.5,
    atRiskCount: 1,
    sessionsHeld: 10,
  },
  classes: [
    {
      id: "c1",
      code: "LOP-01",
      name: "Tiếng Trung cơ bản",
      status: "in_progress",
      activeStudents: 2,
      sessionsInPeriod: 10,
      attendanceRate: 55,
      avgScore: 82.5,
      progressPercent: 49.9,
      atRiskCount: 1,
    },
  ],
  atRisk: [],
  trend: [],
} as unknown as LearningOverview;

describe("learning export", () => {
  it("CSV có BOM UTF-8, giữ tiếng Việt, vô hiệu hóa formula, đủ chỉ số kỳ", () => {
    const csv = createLearningReportCsv(studentRows);
    // Ký tự đầu phải là BOM U+FEFF — so bằng mã để không giấu ký tự vô hình
    // trong source test.
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Nguyễn Văn Ngà");
    expect(csv).toContain("'=HV002");
    expect(csv).toContain("Chuyên cần thấp · Thiếu bài tập");
    // rate null → ô rỗng chứ không phải "null".
    expect(csv).not.toContain("null");
  });

  it("XLSX là workbook thật với 2 sheet Theo lớp / Theo học viên", async () => {
    const buffer = Buffer.from(
      await createLearningReportXlsx(overview, studentRows),
    );
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
    expect(buffer.byteLength).toBeGreaterThan(1000);

    // Đọc ngược lại bằng chính ExcelJS để ghim cấu trúc 2 sheet (AC4.3).
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
      "Theo lớp",
      "Theo học viên",
    ]);
    expect(workbook.getWorksheet("Theo học viên")?.rowCount).toBe(
      1 + studentRows.length,
    );
  });
});
