import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Lớp của tôi" };

export default async function TeacherClassesPage() {
  await requireRole("teacher");

  return (
    <>
      <PageHeader title="Lớp của tôi" description="Các lớp bạn được phân công." />
      <ComingSoon phase="Phase 4 (P4-T2)" />
    </>
  );
}