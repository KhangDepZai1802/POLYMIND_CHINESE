import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Thông báo" };

export default async function AdminNotificationsPage() {
  await requireRole("super_admin");

  return (
    <>
      <PageHeader title="Thông báo" description="Thông báo và announcement." />
      <ComingSoon phase="Phase 6 (P6-T4)" />
    </>
  );
}