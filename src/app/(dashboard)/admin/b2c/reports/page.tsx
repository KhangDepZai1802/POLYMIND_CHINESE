import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { B2CMonthlyReportDashboard } from "@/features/b2c/components/monthly-report-dashboard";
import { getB2CMonthlyReports } from "@/features/b2c/server/queries";
import { requireManager } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Báo cáo hoạt động" };

export default async function B2CReportsPage() {
  await requireManager();
  const reports = await getB2CMonthlyReports();
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Ho_Chi_Minh", month: "numeric", year: "numeric",
  }).formatToParts(new Date());
  const initialPeriod = {
    month: Number(parts.find((part) => part.type === "month")!.value),
    year: Number(parts.find((part) => part.type === "year")!.value),
  };
  return (
    <>
      <PageHeader
        title="Báo cáo hoạt động"
        description="Theo dõi học viên, số tiết, doanh thu, chi phí và lợi nhuận theo tháng của riêng khối trung tâm."
      />
      <B2CMonthlyReportDashboard reports={reports} initialPeriod={initialPeriod} />
    </>
  );
}
