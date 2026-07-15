import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { StudentTuitionOverview } from "@/features/tuition/components/student-tuition-overview";
import { getTuitionInvoices } from "@/features/tuition/server/queries";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Học phí" };

export default async function StudentTuitionPage() {
  await requireRole("student");

  // Không nhận student_id từ URL/form. RLS chỉ trả hóa đơn đã phát hành,
  // payment và receipt của chính học viên đang đăng nhập.
  const invoices = await getTuitionInvoices();

  return (
    <>
      <PageHeader
        title="Học phí"
        description="Theo dõi hóa đơn, số dư, thanh toán và phiếu thu của bạn."
      />
      <StudentTuitionOverview invoices={invoices} />
    </>
  );
}
