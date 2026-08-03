import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { isManagerRole } from "@/types/roles";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { createReportCsv, createReportXlsx } from "@/features/reports/export";
import {
  parseAdminReportFilters,
  type AdminReportFilters,
} from "@/features/reports/schema";
import { getAdminTuitionReport } from "@/features/reports/server/admin-queries";

export const dynamic = "force-dynamic";

// Cạnh database (Supabase `ap-northeast-1`). Route Handler KHÔNG thừa kế
// `preferredRegion` từ layout - xem `src/app/layout.tsx`.
export const preferredRegion = "hnd1";

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
  if (format !== "csv" && format !== "xlsx") {
    return NextResponse.json({ error: "Định dạng export không hợp lệ." }, { status: 400 });
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
  const stamp = new Date().toISOString().slice(0, 10);

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
