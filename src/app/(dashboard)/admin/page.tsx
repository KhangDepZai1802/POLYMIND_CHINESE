import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Tổng quan" };

export default async function AdminDashboardPage() {
  const user = await requireRole("super_admin");

  return (
    <>
      <PageHeader
        title={`Xin chào, ${user.fullName}`}
        description="Tổng quan toàn trung tâm."
      />
      <ComingSoon phase="Phase 3 (P3-T9)" />
    </>
  );
}
