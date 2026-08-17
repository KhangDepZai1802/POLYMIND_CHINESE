import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import {
  AutoPrintOnLoad,
  ExportReportPdfButton,
} from "@/features/session-reports/components/report-print";
import { SessionReportPrintable } from "@/features/session-reports/components/session-report-printable";
import { sessionReportFileBase } from "@/features/session-reports/domain/file-name";
import { getReportForRenderBySession } from "@/features/session-reports/server/queries";
import { requireTeaching } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Xuất báo cáo buổi dạy" };

/**
 * BẢN IN / XUẤT PDF CỦA GIÁO VIÊN (`TEACHER-REPORT-5`, user chốt 2026-08-17).
 *
 * =============================================================================
 * VÌ SAO LÀ MỘT TRANG RIÊNG, KHÔNG PHẢI MỘT CÁI NÚT TRÊN BIỂU MẪU
 * =============================================================================
 *
 * `/teacher/reports/[sessionId]` là **biểu mẫu 9 mục** — 35 ô nhập, mục lục dính,
 * nút Gửi. In nguyên nó ra là in một cái form, không phải một bản báo cáo: các ô
 * `<input>`/`<textarea>` in ra khung viền rỗng và chữ bị cắt ở đáy ô. Trang này
 * dựng đúng bản mà giáo vụ đang đọc (`SessionReportPrintable`), nên cái giáo
 * viên xuất ra CHÍNH LÀ cái cấp trên nhận được.
 *
 * =============================================================================
 * ⛔ CHỈ BÁO CÁO ĐÃ GỬI
 * =============================================================================
 *
 * `getReportForRenderBySession()` trả `null` cho bản nháp ⇒ 404. Xuất một bản
 * nháp ra PDF rồi gửi đi là việc không có đường lùi, và chính hàng đợi cũng chỉ
 * bày nút *"Xuất báo cáo"* ở buổi đã gửi.
 *
 * Không có lớp kiểm quyền nào ở app ngoài `requireTeaching`: buổi của lớp khác
 * bị RLS chặn từ trong truy vấn, nên nó cũng ra 404.
 */
export default async function TeacherSessionReportPrintPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireTeaching("super_admin");
  const { sessionId } = await params;

  const data = await getReportForRenderBySession(sessionId);
  if (!data) notFound();

  const fileName = sessionReportFileBase({
    classCode: data.session.classCode,
    sessionNumber: data.session.sessionNumber,
    startsAt: data.session.startsAtISO,
  });

  return (
    <>
      {/*
        Hộp thoại In bật sẵn với tên file đã đặt. Giáo viên bấm "Xuất báo cáo" ở
        danh sách là để in — không bắt họ tìm thêm một cái nút nữa.
      */}
      <AutoPrintOnLoad fileName={fileName} />

      <Link
        href="/teacher/reports"
        data-noprint
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mb-4 inline-flex items-center gap-1 rounded-md text-sm focus-visible:ring-2 focus-visible:outline-none"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Về danh sách báo cáo
      </Link>

      <PageHeader
        title={`Báo cáo · Buổi ${data.session.sessionNumber}`}
        description={`${data.session.classCode} — ${data.session.className} · ${data.session.startsAt} · ${data.session.startTime}–${data.session.endsAt}`}
        action={
          /*
            Nút vẫn còn dù hộp thoại đã tự bật: người dùng bấm Huỷ, hoặc trình
            duyệt chặn `print()` tự động, thì phải có đường in lại — chứ không
            phải tải lại trang bằng tay (`UX-MOBILE-3`: đừng để ngõ cụt).
          */
          <div data-noprint className="flex flex-wrap gap-2">
            <ExportReportPdfButton fileName={fileName} label="In lại" />
          </div>
        }
      />

      {/*
        Câu hướng dẫn NÓI ĐÚNG TÊN FILE sẽ ra. Hộp thoại In có hai đích (máy in
        và "Lưu thành PDF"); giáo viên bấm "Xuất báo cáo" là muốn cái thứ hai, mà
        đích mặc định lại thường là máy in.
      */}
      <p
        data-noprint
        className="text-text-secondary bg-surface-sunken mb-4 rounded-lg border p-3 text-sm"
      >
        Trong hộp thoại vừa mở, chọn <strong>đích in là “Lưu thành PDF”</strong>{" "}
        rồi bấm Lưu. File sẽ có tên{" "}
        <strong className="text-foreground font-mono">{fileName}.pdf</strong>.
      </p>

      <SessionReportPrintable data={data} />
    </>
  );
}
