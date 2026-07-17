import ExcelJS from "exceljs";
import { requireRole } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function GET() {
  await requireRole("teacher", "super_admin");
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Questions");
  sheet.addRow(["title", "question_type", "skill", "difficulty", "prompt_text", "options", "answer", "explanation"]);
  sheet.addRow(["Chào hỏi cơ bản", "single_choice", "reading", "easy", "你好 nghĩa là gì?", "Xin chào|Tạm biệt|Cảm ơn", "1", "你好 = Xin chào"]);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = [24, 22, 16, 14, 42, 48, 26, 42].map((width) => ({ width }));
  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="polymind-question-import-template.xlsx"',
      "Cache-Control": "private, no-store",
    },
  });
}
