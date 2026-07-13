import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tổng quan" };

export default async function StudentDashboardPage() {
  const user = await requireRole("student");

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description="Buổi học kế tiếp, bài sắp đến hạn và tiến độ của bạn."
      />
      <ComingSoon phase="Phase 5 (P5-T1)" />
    </>
  );
}
