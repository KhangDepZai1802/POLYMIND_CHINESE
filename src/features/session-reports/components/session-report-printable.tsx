import { formatDateTime } from "@/lib/dates";
import { Card, CardContent } from "@/components/ui/card";

import { formatEvidenceBytes } from "../domain/evidence";
import {
  BLANK,
  buildConfirmationLine,
  buildReportSections,
  type ReportForRender,
} from "../domain/render";

/**
 * BẢN XEM = BẢN IN của một báo cáo buổi dạy.
 *
 * =============================================================================
 * MỘT COMPONENT, HAI BỀ MẶT (`TEACHER-REPORT-5`)
 * =============================================================================
 *
 * Giáo vụ xem ở `/admin/reports/bao-cao/[reportId]`; giáo viên xuất PDF ở
 * `/teacher/reports/[sessionId]/ban-in`. Trước đợt này chỉ có bản của giáo vụ và
 * nó viết thẳng trong file `page.tsx`. Copy sang trang giáo viên là có ngày hai
 * bên in ra hai bản khác nhau cho cùng một buổi dạy — đúng hình dạng
 * `BUG_M10_01`, và lần này còn tệ hơn vì hai bản đó đều được gửi ra ngoài.
 *
 * Nội dung vẫn đi qua `buildReportSections()` — đúng hàm mà bản DOCX dùng.
 *
 * =============================================================================
 * 🔴 KHÔNG DÙNG `next/image`
 * =============================================================================
 *
 * Bản in mới là bề mặt chính của trang này, mà `next/image` tải lười: bấm Ctrl+P
 * lúc ảnh chưa vào khung nhìn là in ra ô trắng (`TEACHER-REPORT-3a`).
 * `loading="eager"` buộc tải trước, và `AutoPrintOnLoad` còn CHỜ từng ảnh xong
 * mới gọi `window.print()`.
 */
export function SessionReportPrintable({ data }: { data: ReportForRender }) {
  const sections = buildReportSections(data);
  const report = data.report as {
    submitted_at?: string | null;
  };
  const confirmation = buildConfirmationLine(
    data,
    data.session.teacherName,
    report.submitted_at ? formatDateTime(report.submitted_at) : BLANK,
  );

  return (
    /*
      `data-report-print` là neo cho khối cỡ chữ bản in trong `globals.css`.
      Neo bằng data-attribute chứ không bằng class Tailwind: đây là thứ CHỈ bản
      in ghi đè, và nếu neo theo cấu trúc DOM thì hỏng ngay lần ai đó bọc thêm
      một lớp div.
    */
    <div data-report-print className="grid gap-4">
      {sections.map((section) => (
        <Card key={section.number}>
          <CardContent className="py-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide uppercase">
              {/*
                🔴 `data-report-number` là neo để BẢN IN đổi con số này thành chữ
                đậm viền tròn (user báo 2026-08-17: *"cái màu của số đang bị chìm
                quá"*). Trên màn hình là số trắng trên nền xanh; khi in, trình
                duyệt bỏ nền theo mặc định nên còn lại **chữ trắng trên giấy
                trắng**. Xem khối `@media print` trong `globals.css`.
              */}
              <span
                data-report-number
                className="bg-primary text-primary-foreground grid size-5 place-items-center rounded font-mono text-xs"
              >
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

            {/*
              Mục 8 — ẢNH THẬT ngay dưới dòng "Tải file/hình ảnh"
              (`TEACHER-REPORT-3`). Bản trước chỉ có con số đếm, nên bản in gửi
              cấp trên không mang theo minh chứng nào.
            */}
            {section.images && section.images.length > 0 && (
              <ul
                data-report-evidence
                className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3"
              >
                {section.images.map((item) => (
                  <li key={item.id} className="grid gap-1">
                    {item.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.url}
                        alt={`Minh chứng buổi học — ${item.fileName}`}
                        loading="eager"
                        className="bg-surface-sunken w-full rounded-lg border object-contain"
                      />
                    ) : (
                      <span className="text-muted-foreground bg-surface-sunken grid aspect-[4/3] place-items-center rounded-lg border px-2 text-center text-xs">
                        Không mở được ảnh
                      </span>
                    )}
                    <span className="text-muted-foreground truncate text-xs">
                      {item.fileName} · {formatEvidenceBytes(item.bytes)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ))}

      {/*
        Dòng XÁC NHẬN — `buildConfirmationLine()`, đúng hàm mà mẫu Word có và
        bản DOCX in ra.

        🔴 Bản in TỪNG THIẾU khối này trong khi DOCX có: hai bề mặt xuất ra từ
        cùng một báo cáo mà một bên mang dấu vết ký, một bên không. Đây là lỗ
        thật của "một nguồn cho ba bề mặt", phát hiện lúc tách component dùng
        chung cho trang giáo viên.
      */}
      <Card>
        <CardContent className="py-4">
          <h2 className="mb-2 text-sm font-bold tracking-wide uppercase">
            {confirmation.label}
          </h2>
          <p
            className={
              confirmation.value === BLANK
                ? "text-muted-foreground text-sm"
                : "text-sm font-medium"
            }
          >
            {confirmation.value}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
