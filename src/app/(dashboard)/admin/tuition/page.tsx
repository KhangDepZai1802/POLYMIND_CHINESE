import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { TuitionInvoiceManager } from "@/features/tuition/components/invoice-manager";
import {
  getTuitionInvoices,
  getTuitionStudentOptions,
} from "@/features/tuition/server/queries";
import { requireRole } from "@/lib/auth/session";
import { formatCurrency, todayISO } from "@/lib/dates";

export const metadata: Metadata = { title: "Học phí" };

export default async function AdminTuitionPage() {
  await requireRole("super_admin");
  const [invoices, students] = await Promise.all([
    getTuitionInvoices(),
    getTuitionStudentOptions(),
  ]);

  const draftCount = invoices.filter(
    (invoice) => invoice.status === "draft",
  ).length;
  const overdueCount = invoices.filter((invoice) => invoice.is_overdue).length;
  const outstanding = invoices
    .filter(
      (invoice) =>
        invoice.status !== "draft" &&
        invoice.status !== "cancelled" &&
        invoice.status !== "refunded",
    )
    .reduce((sum, invoice) => sum + invoice.balance, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Học phí"
        description="Lập hóa đơn, quản lý khoản mục và phát hành cho học viên."
      />

      <section aria-labelledby="tuition-summary-heading">
        <h2 id="tuition-summary-heading" className="sr-only">
          Tổng hợp học phí
        </h2>
        {/*
         * Grid là `<div>`, và **mỗi thẻ tự chứa `<dl>` của riêng nó**.
         * Không bọc `<dl>` ra ngoài các `Card`: `<dl>` chỉ được chứa trực tiếp
         * `<dt>`/`<dd>` hoặc `<div>` bọc một cặp, mà `Card > CardContent > dt`
         * đã sâu hai cấp — axe báo `definition-list` + `dlitem` (9 node) mức
         * `serious`. Bài kiểm bắt được trước khi giao.
         */}
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard
            label="Tổng hóa đơn"
            value={String(invoices.length)}
            note={`${draftCount} bản nháp`}
          />
          <SummaryCard
            label="Còn phải thu"
            value={formatCurrency(outstanding)}
            note="Tính từ hóa đơn đã phát hành"
          />
          <SummaryCard
            label="Quá hạn"
            value={String(overdueCount)}
            note="Có số dư và đã qua hạn đóng"
            danger={overdueCount > 0}
          />
        </div>
      </section>

      <TuitionInvoiceManager
        invoices={invoices}
        students={students}
        defaultIssueDate={todayISO()}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  note,
  danger = false,
}: {
  label: string;
  value: string;
  note: string;
  danger?: boolean;
}) {
  return (
    <Card className="h-full py-0">
      <CardContent className="p-4">
        {/*
         * `<dl>` nằm TRONG thẻ, bọc đúng một cặp nhãn–giá trị.
         *
         * `text-sm` chứ không `text-xs`: đây là nhãn và cách giải thích của CON
         * SỐ TIỀN — người đọc phải biết "Còn phải thu" tính từ đâu mới dám tin
         * nó. Cùng lỗi đã sửa ở M26 (`P15-T7`).
         */}
        <dl className="space-y-1">
          <dt className="text-text-secondary text-sm">{label}</dt>
          <dd
            className={`text-2xl font-semibold tabular-nums ${danger ? "text-danger-ink" : ""}`}
          >
            {value}
          </dd>
          <dd className="text-text-secondary text-sm">{note}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
