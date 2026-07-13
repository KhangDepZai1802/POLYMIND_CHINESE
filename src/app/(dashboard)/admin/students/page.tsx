import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Học viên" };

export default async function AdminStudentsPage() {
  await requireRole("super_admin");

  return (
    <>
      <PageHeader title="Học viên" description="Hồ sơ học viên toàn trung tâm." />
      <ComingSoon phase="Phase 3 (P3-T5)" />
    </>
  );
}