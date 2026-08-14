import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { isManagerRole } from "@/types/roles";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createReportCsv, createReportXlsx } from "@/features/reports/export";
import {
  createLearningReportCsv,
  createLearningReportXlsx,
} from "@/features/reports/learning-export";
import { resolveLearningPeriod } from "@/features/reports/learning";
import {
  parseAdminReportFilters,
  parseLearningReportFilters,
  type AdminReportFilters,
} from "@/features/reports/schema";
import { getAdminTuitionReport } from "@/features/reports/server/admin-queries";
import {
  getLearningOverview,
  getLearningStudentRows,
} from "@/features/reports/server/learning-queries";
import { parseTeacherReportFilters } from "@/features/session-reports/schema";
import { loadEvidenceImages } from "@/features/session-reports/server/evidence-images";
import { buildSessionReportDocx } from "@/features/session-reports/server/export-docx";
import { getReportsForExport } from "@/features/session-reports/server/queries";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

// Cạnh database (Supabase `ap-northeast-1`). Route Handler KHÔNG thừa kế
// `preferredRegion` từ layout - xem `src/app/layout.tsx`.
export const preferredRegion = "hnd1";

/**
 * `report=tuition` (MẶC ĐỊNH khi vắng mặt — link export cũ không được gãy) →
 * báo cáo học phí như trước. `report=learning` → báo cáo học tập
 * (`REPORT-REDESIGN-1`), nhận `from/to/range` — export GIỮ ĐÚNG kỳ đang lọc
 * trên trang (bài học `BUG_M16_01`).
 */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Trang Báo cáo thuộc 9 mục của giáo vụ (`D-2`), mà nút CSV/XLSX trên đó gọi
  // thẳng route này. Gác `super_admin` thì UI bày nút còn API trả 403
  // (`GIAOVU-REPORT-003`, Codex tìm ra 2026-08-03). Dùng chung một khái niệm
  // "quản lý" với `requireManager()` và `app.is_manager()`.
  if (!isManagerRole(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const supabase = await createClient();
  if (!(await consumeRateLimit(supabase, "report_export"))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const url = new URL(request.url);
  const format = url.searchParams.get("format");
  if (format !== "csv" && format !== "xlsx" && format !== "docx") {
    return NextResponse.json({ error: "Định dạng export không hợp lệ." }, { status: 400 });
  }

  const reportKind = url.searchParams.get("report") ?? "tuition";
  if (
    reportKind !== "tuition" &&
    reportKind !== "learning" &&
    reportKind !== "teacher-reports"
  ) {
    return NextResponse.json({ error: "Loại báo cáo không hợp lệ." }, { status: 400 });
  }

  const stamp = new Date().toISOString().slice(0, 10);

  /*
   * Báo cáo buổi dạy của giáo viên (`TEACHER-REPORT-1`).
   *
   * 🔴 Bộ lọc đọc từ CHÍNH query string mà nút trên màn hình dựng ra, và kỳ mặc
   * định giống hệt trang (`Tháng này`). Gõ tay URL export không kèm kỳ vẫn phải
   * ra đúng cái người dùng đang thấy — `BUG_M16_01`.
   *
   * PDF KHÔNG đi qua đây: nó là bản in của trình duyệt (`PrintButton` + print
   * stylesheet), không thêm thư viện nào.
   */
  if (reportKind === "teacher-reports") {
    if (format !== "docx") {
      return NextResponse.json(
        { error: "Báo cáo buổi dạy chỉ xuất được DOCX (PDF dùng bản in của trình duyệt)." },
        { status: 400 },
      );
    }

    const params: Record<string, string | string[] | undefined> = {};
    for (const key of ["from", "to", "range", "class", "teacher", "state"] as const) {
      params[key] = url.searchParams.get(key) || undefined;
    }

    const parsed = parseTeacherReportFilters(params);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 },
      );
    }

    const period = resolveLearningPeriod(parsed.data, todayISO(), "month");
    const reports = await getReportsForExport({
      ...parsed.data,
      from: period.from ?? undefined,
      to: period.to ?? undefined,
    });

    // Mục 8 phải mang theo ẢNH THẬT, không chỉ dòng chữ "3 tệp đính kèm"
    // (`TEACHER-REPORT-3`). Tải ở đây chứ không trong `getReportsForExport`:
    // bản xem/bản in đọc ảnh qua URL ký, chỉ file Word mới cần nhị phân, và
    // kéo vài MB ảnh cho mỗi lượt mở trang là phí.
    const evidenceImages = await loadEvidenceImages(reports);

    const buffer = await buildSessionReportDocx(
      reports,
      {
        periodLabel: period.label,
        generatedAt: new Date().toLocaleString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
        }),
      },
      evidenceImages,
    );

    return new Response(buffer as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="bao-cao-buoi-day-${stamp}.docx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  if (format === "docx") {
    return NextResponse.json(
      { error: "Chỉ báo cáo buổi dạy mới xuất được DOCX." },
      { status: 400 },
    );
  }

  if (reportKind === "learning") {
    const input: Record<string, string | undefined> = {};
    for (const key of ["from", "to", "range"] as const) {
      input[key] = url.searchParams.get(key) || undefined;
    }
    const parsed = parseLearningReportFilters(input);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message },
        { status: 400 },
      );
    }
    // Cùng mặc định "Tháng này" với trang admin — URL export gõ tay không kèm
    // kỳ phải ra đúng cái người dùng đang thấy trên màn hình.
    const period = resolveLearningPeriod(parsed.data, todayISO(), "month");

    if (format === "csv") {
      const rows = await getLearningStudentRows(period);
      return new Response(createLearningReportCsv(rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="bao-cao-hoc-tap-${stamp}.csv"`,
          "Cache-Control": "private, no-store",
        },
      });
    }

    const [overview, rows] = await Promise.all([
      getLearningOverview(period),
      getLearningStudentRows(period),
    ]);
    const buffer = await createLearningReportXlsx(overview, rows);
    return new Response(buffer as BodyInit, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="bao-cao-hoc-tap-${stamp}.xlsx"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const input: Record<string, string | undefined> = {};
  for (const key of ["from", "to", "status", "class_id"] as const) {
    input[key] = url.searchParams.get(key) || undefined;
  }
  const parsed = parseAdminReportFilters(input);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const report = await getAdminTuitionReport(parsed.data as AdminReportFilters);

  if (format === "csv") {
    return new Response(createReportCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bao-cao-hoc-phi-${stamp}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  const buffer = await createReportXlsx(report);
  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bao-cao-hoc-phi-${stamp}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
