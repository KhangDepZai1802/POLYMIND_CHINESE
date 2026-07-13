import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Báo cáo" };

export default async function AdminReportsPage() {
  await requireRole("super_admin");

  return (
    <>
      <PageHeader title="Báo cáo" description="Báo cáo và export." />
      <ComingSoon phase="Phase 6 (P6-T7)" />
    </>
  );
}