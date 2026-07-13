import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Học phí" };

export default async function AdminTuitionPage() {
  await requireRole("super_admin");

  return (
    <>
      <PageHeader title="Học phí" description="Hóa đơn, thanh toán và phiếu thu." />
      <ComingSoon phase="Phase 6 (P6-T1)" />
    </>
  );
}