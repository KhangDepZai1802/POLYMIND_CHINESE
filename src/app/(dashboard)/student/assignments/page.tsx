import type { Metadata } from "next";

import { ComingSoon } from "@/components/shared/coming-soon";
import { PageHeader } from "@/components/shared/page-header";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Bài tập" };

export default async function StudentAssignmentsPage() {
  await requireRole("student");

  return (
    <>
      <PageHeader title="Bài tập" description="Bài tập được giao và bài đã nộp." />
      <ComingSoon phase="Phase 5 (P5-T4)" />
    </>
  );
}