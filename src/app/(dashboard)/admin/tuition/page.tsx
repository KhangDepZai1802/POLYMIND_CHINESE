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
    <Card>
      <CardContent className="space-y-1 p-4">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p
          className={`text-2xl font-semibold tabular-nums ${danger ? "text-destructive" : ""}`}
        >
          {value}
        </p>
        <p className="text-muted-foreground text-xs">{note}</p>
      </CardContent>
    </Card>
  );
}
