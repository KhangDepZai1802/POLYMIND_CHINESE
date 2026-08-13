import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PrintButton } from "@/features/reports/components/print-button";
import { BLANK, buildReportSections } from "@/features/session-reports/domain/render";
import { getReportForRender } from "@/features/session-reports/server/queries";
import { requireManager } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Báo cáo buổi dạy" };

/**
 * Bản xem một báo cáo — cũng CHÍNH LÀ bản in PDF.
 *
 * Không dựng thêm một trang in riêng: `PrintButton` + print stylesheet của
 * module báo cáo đã có sẵn, và `data-noprint` gỡ phần chrome khi in. Một trang,
 * hai công dụng — bản in không bao giờ lệch bản xem.
 *
 * Nội dung đi qua `buildReportSections()`, đúng hàm mà bản DOCX dùng.
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

  const sections = buildReportSections(data);

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
            <PrintButton />
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

      <div className="grid gap-4">
        {sections.map((section) => (
          <Card key={section.number}>
            <CardContent className="py-4">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
                <span className="bg-primary text-primary-foreground grid size-5 place-items-center rounded font-mono text-xs">
                  {section.number}
                </span>
                {section.title}
              </h2>

              <dl className="grid gap-2">
                {section.lines.map((line) => (
                  <div
                    key={line.label}
                    className="grid gap-0.5 border-t pt-2 first:border-t-0 first:pt-0 sm:grid-cols-[16rem_minmax(0,1fr)] sm:gap-3"
                  >
                    <dt className="text-text-secondary text-sm">{line.label}</dt>
                    <dd
                      className={
                        line.value === BLANK
                          ? "text-muted-foreground text-sm"
                          : "text-sm font-medium"
                      }
                    >
                      {/* Dãy chấm chỉ vị trí trên thang — thay 5 dòng ☐ của mẫu Word. */}
                      {line.scale && (
                        <span
                          className="text-primary mr-2 font-mono tracking-widest"
                          aria-hidden
                        >
                          {"●".repeat(line.scale.value)}
                          {"○".repeat(line.scale.max - line.scale.value)}
                        </span>
                      )}
                      <span className="whitespace-pre-wrap">{line.value}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
