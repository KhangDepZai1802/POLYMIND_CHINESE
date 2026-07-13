import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Lịch học" };

export default async function AdminSchedulePage() {
  await requireRole("super_admin");

  return (
    <>
      <PageHeader title="Lịch học" description="Lịch lặp và buổi học." />
      <ComingSoon phase="Phase 3 (P3-T7)" />
    </>
  );
}