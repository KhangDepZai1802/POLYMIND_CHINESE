import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Lớp học" };

export default async function AdminClassesPage() {
  await requireRole("super_admin");

  return (
    <>
      <PageHeader title="Lớp học" description="Lớp triển khai, sĩ số, giáo viên." />
      <ComingSoon phase="Phase 3 (P3-T6)" />
    </>
  );
}