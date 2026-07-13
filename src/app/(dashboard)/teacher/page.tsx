import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Hôm nay" };

export default async function TeacherDashboardPage() {
  const user = await requireRole("teacher");

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description="Lịch dạy hôm nay, buổi chưa điểm danh và bài chờ chấm."
      />
      <ComingSoon phase="Phase 4 (P4-T1)" />
    </>
  );
}
