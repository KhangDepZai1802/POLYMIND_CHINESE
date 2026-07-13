import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Khóa học" };

export default async function AdminCoursesPage() {
  await requireRole("super_admin");

  return (
    <>
      <PageHeader title="Khóa học" description="Level, khóa học, module và bài học." />
      <ComingSoon phase="Phase 3 (P3-T2)" />
    </>
  );
}