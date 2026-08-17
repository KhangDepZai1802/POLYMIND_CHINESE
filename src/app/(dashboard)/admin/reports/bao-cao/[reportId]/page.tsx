import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { sessionReportFileBase } from "@/features/session-reports/domain/file-name";
import { ExportReportPdfButton } from "@/features/session-reports/components/report-print";
import { SessionReportPrintable } from "@/features/session-reports/components/session-report-printable";
import { getReportForRender } from "@/features/session-reports/server/queries";
import { requireManager } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Báo cáo buổi dạy" };

/**
 * Bản xem một báo cáo — cũng CHÍNH LÀ bản in PDF.
 *
 * Không dựng thêm một trang in riêng: print stylesheet của module báo cáo đã có
 * sẵn, và `data-noprint` gỡ phần chrome khi in. Một trang, hai công dụng — bản
 * in không bao giờ lệch bản xem.
 *
 * Nội dung nằm ở `SessionReportPrintable`, dùng CHUNG với bản in của giáo viên
 * (`/teacher/reports/[sessionId]/ban-in`) — hai trang, một cách dựng nội dung.
 */
export default async function AdminSessionReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  await requireManager();
  const { reportId } = await params;

  const data = await getReportForRender(reportId);
  if (!data) notFound();

  // Cùng một hàm với trang giáo viên ⇒ hai bề mặt xuất ra file CÙNG TÊN, đúng
  // yêu cầu của user 2026-08-17.
  const fileName = sessionReportFileBase({
    classCode: data.session.classCode,
    sessionNumber: data.session.sessionNumber,
    startsAt: data.session.startsAtISO,
  });

  return (
    <>
      <Link
        href="/admin/reports?tab=bao-cao-gv"
        data-noprint
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-4 inline-flex items-center gap-1 rounded-md text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Về danh sách báo cáo
      </Link>

      <PageHeader
        title={`Báo cáo · Buổi ${data.session.sessionNumber}`}
        description={`${data.session.classCode} — ${data.session.className} · ${data.session.teacherName} · ${data.session.startsAt}`}
        action={
          <div data-noprint className="flex flex-wrap gap-2">
            <ExportReportPdfButton fileName={fileName} />
            <Button asChild variant="outline">
              <a
                href={`/api/export/reports?report=teacher-reports&format=docx&class=${
                  (data.report as { class_id?: string }).class_id ?? ""
                }`}
              >
                <Download className="size-4" aria-hidden />
                Tải DOCX
              </a>
            </Button>
          </div>
        }
      />

      <SessionReportPrintable data={data} />
    </>
  );
}
