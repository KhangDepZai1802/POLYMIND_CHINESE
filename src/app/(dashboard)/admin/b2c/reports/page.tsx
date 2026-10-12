import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { B2CMonthlyReportDashboard } from "@/features/b2c/components/monthly-report-dashboard";
import { getB2CMonthlyReports } from "@/features/b2c/server/queries";
import { requireManager } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Báo cáo hoạt động B2C" };

export default async function B2CReportsPage() {
  await requireManager();
  const reports = await getB2CMonthlyReports();
  return (
    <>
      <PageHeader
        title="Báo cáo hoạt động B2C"
        description="Theo dõi học viên, số tiết, doanh thu, chi phí và lợi nhuận theo tháng của riêng khối trung tâm."
      />
      <B2CMonthlyReportDashboard reports={reports} />
    </>
  );
}
