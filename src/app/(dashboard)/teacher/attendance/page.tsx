import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Điểm danh" };

export default async function TeacherAttendancePage() {
  await requireRole("teacher");

  return (
    <>
      <PageHeader title="Điểm danh" description="Điểm danh theo buổi học." />
      <ComingSoon phase="Phase 4 (P4-T4)" />
    </>
  );
}